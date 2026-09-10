// 生产环境入口（PM2 守护此文件）：
// 用项目官方支持的 wrangler dev（内含 workerd 运行时）运行构建产物，
// D1 以本地 SQLite 持久化（.wrangler/state/v3），业务代码零改动。
// 用法：npm run build 后，pm2 start server/prod.mjs --name kaogong
import fs from 'node:fs';
import { spawn, spawnSync } from 'node:child_process';

const port = process.env.PORT || '3000';
const host = process.env.HOST || '0.0.0.0';
const wranglerJs = 'node_modules/wrangler/bin/wrangler.js';
const configArgs = ['--config', 'dist/server/wrangler.json'];

if (!fs.existsSync(wranglerJs)) {
  console.error('未找到 wrangler，请先执行 npm install');
  process.exit(1);
}
if (!fs.existsSync('dist/server/wrangler.json')) {
  console.error('未找到 dist/server/wrangler.json，请先执行 npm run build');
  process.exit(1);
}

// 首次启动自动初始化数据库表（幂等：已有表则跳过）
const marker = '.wrangler/db-initialized';
if (!fs.existsSync(marker)) {
  console.log('首次启动：正在初始化数据库表…');
  const r = spawnSync(
    process.execPath,
    [wranglerJs, 'd1', 'execute', 'DB', '--local', '-y', '--file', 'drizzle/0000_fuzzy_onslaught.sql', ...configArgs],
    { stdio: 'pipe', encoding: 'utf8' },
  );
  const out = (r.stdout || '') + (r.stderr || '');
  if (r.status === 0 || /already exists/i.test(out)) {
    fs.mkdirSync('.wrangler', { recursive: true });
    fs.writeFileSync(marker, 'ok');
    console.log('数据库表已就绪');
  } else {
    console.error('数据库初始化失败：\n' + out);
    process.exit(1);
  }
}

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
