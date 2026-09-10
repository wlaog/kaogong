// 生产环境入口（PM2 守护此文件）：
// 用项目官方支持的 wrangler dev（内含 workerd 运行时）运行构建产物，
// D1 以本地 SQLite 持久化（.wrangler/state/v3），业务代码零改动。
// 用法：npm run build 后，pm2 start server/prod.mjs --name kaogong
import fs from 'node:fs';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';

const port = process.env.PORT || '3000';
const host = process.env.HOST || '0.0.0.0';
const wranglerJs = 'node_modules/wrangler/bin/wrangler.js';
const configArgs = ['--config', 'dist/server/wrangler.json'];
const migrationsDir = 'drizzle';

if (!fs.existsSync(wranglerJs)) {
  console.error('未找到 wrangler，请先执行 npm install');
  process.exit(1);
}
if (!fs.existsSync('dist/server/wrangler.json')) {
  console.error('未找到 dist/server/wrangler.json，请先执行 npm run build');
  process.exit(1);
}

function wranglerD1(extraArgs) {
  return spawnSync(
    process.execPath,
    [wranglerJs, 'd1', 'execute', 'DB', '--local', '-y', ...configArgs, ...extraArgs],
    { stdio: 'pipe', encoding: 'utf8' },
  );
}

// 按 drizzle/_journal.json 顺序应用全部迁移（幂等：每文件记录 marker，表已存在视为已应用）
function applyMigrations() {
  const journal = JSON.parse(fs.readFileSync(path.join(migrationsDir, 'meta/_journal.json'), 'utf8'));
  const markerDir = '.wrangler/migrations';
  fs.mkdirSync(markerDir, { recursive: true });
  let applied = 0;
  for (const entry of journal.entries) {
    const file = path.join(migrationsDir, `${entry.tag}.sql`);
    const marker = path.join(markerDir, `${entry.tag}.done`);
    if (fs.existsSync(marker)) continue;
    console.log(`应用迁移 ${path.basename(file)} …`);
    const r = wranglerD1(['--file', file]);
    const out = (r.stdout || '') + (r.stderr || '');
    if (r.status !== 0 && !/already exists/i.test(out)) {
      console.error(`迁移 ${file} 失败：\n` + out);
      process.exit(1);
    }
    fs.writeFileSync(marker, 'ok');
    applied++;
  }
  if (applied) console.log(`数据库迁移完成（${applied} 个新迁移）`);
  else console.log('数据库迁移已是最新');
}

// 确保存在可用的"站长"邀请码：还没有管理员账号时自动生成/刷新一次性邀请码
function ensureOwnerInvite() {
  const query = "SELECT (SELECT COUNT(*) FROM auth_users WHERE role='admin') AS admins,(SELECT COUNT(*) FROM auth_invites WHERE id='bootstrap-owner' AND revoked=0 AND used<max_uses AND expires_at>strftime('%s','now')*1000) AS valid";
  const r = wranglerD1(['--json', '--command', query]);
  if (r.status !== 0) {
    console.error('检查站长邀请码失败：\n' + (r.stdout || '') + (r.stderr || ''));
    return;
  }
  let admins = 0, valid = 0;
  try {
    const rows = JSON.parse(r.stdout)[0]?.results || [];
    admins = Number(rows[0]?.admins || 0);
    valid = Number(rows[0]?.valid || 0);
  } catch { /* 解析失败则跳过，不阻塞启动 */ }
  if (admins > 0 || valid > 0) return;

  // 生成邀请码：RR-XXXX-XXXX-XXXX-XXXX，哈希方式与 lib/auth-crypto 保持一致
  const code = 'RR-' + randomBytes(16).toString('hex').toUpperCase().match(/.{1,4}/g).join('-');
  const hash = createHash('sha256').update(code.replace(/[\s-]/g, '').toUpperCase()).digest('hex');
  const now = Date.now();
  const expiry = now + 30 * 86400000; // 30 天有效
  const sql = `DELETE FROM auth_invites WHERE id='bootstrap-owner';INSERT INTO auth_invites(id,code_hash,prefix,label,role,max_uses,used,expires_at,revoked,created_at,created_by) VALUES ('bootstrap-owner','${hash}','owner','Initial owner','admin',1,0,${expiry},0,${now},NULL);`;
  fs.mkdirSync('.wrangler', { recursive: true });
  const sqlFile = '.wrangler/owner-bootstrap.sql';
  fs.writeFileSync(sqlFile, sql);
  const ins = wranglerD1(['--file', sqlFile]);
  if (ins.status !== 0) {
    console.error('创建站长邀请码失败：\n' + (ins.stdout || '') + (ins.stderr || ''));
    return;
  }
  fs.mkdirSync('.local', { recursive: true });
  fs.writeFileSync(
    '.local/owner-invite.txt',
    `软软上岸 · 站长注册邀请码\n\n${code}\n\n请在网站注册页使用，仅可注册一次（管理员账号）。有效期至 ${new Date(expiry).toLocaleString('zh-CN')}。\n`,
  );
  console.log(`已生成站长邀请码（有效期30天）：${code}`);
  console.log('同时保存在 .local/owner-invite.txt，注册成功前请勿删除');
}

applyMigrations();
ensureOwnerInvite();

// 拉起 wrangler dev（workerd），由本进程随 PM2 一起被守护
const child = spawn(
  process.execPath,
  [wranglerJs, 'dev', ...configArgs, '--port', String(port), '--ip', host],
  { stdio: 'inherit', env: { ...process.env, CI: 'true', WRANGLER_SEND_METRICS: 'false' } },
);
child.on('exit', (code) => process.exit(code ?? 1));
for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => child.kill(sig));
}
