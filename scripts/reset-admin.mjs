// 管理员密码重置脚本（在服务器项目根目录执行）：
//   node scripts/reset-admin.mjs            # 自动生成随机密码
//   node scripts/reset-admin.mjs "新密码"    # 指定新密码（10—128 个字符）
// 重置后所有管理员的登录会话失效，需重新登录。
// 建议先 pm2 stop kaogong，执行完再 pm2 start，避免数据库写入冲突。
import {randomBytes, scryptSync} from 'node:crypto';
import {writeFileSync, existsSync} from 'node:fs';
import {execFileSync} from 'node:child_process';

const password = process.argv[2] || randomBytes(12).toString('base64url') + 'aA1';
if (password.length < 10 || password.length > 128) {
  console.error('密码长度需为 10—128 个字符');
  process.exit(1);
}
if (!existsSync('node_modules/wrangler/bin/wrangler.js')) {
  console.error('请在项目根目录执行此脚本');
  process.exit(1);
}

// 哈希格式与 lib/auth-crypto.ts 的 hashPassword 完全一致：
// scrypt(password, salt, 32, {N:16384,r:8,p:5})，salt 为 16 字节随机数的 hex 字符串
const salt = randomBytes(16).toString('hex');
const key = scryptSync(password, salt, 32, {N: 16384, r: 8, p: 5, maxmem: 32 * 1024 * 1024});
const stored = `scrypt$16384$8$5$${salt}$${key.toString('hex')}`;

const sql =
  `UPDATE auth_users SET password_hash='${stored}' WHERE role='admin';` +
  `DELETE FROM auth_sessions WHERE user_id IN (SELECT id FROM auth_users WHERE role='admin');`;

const sqlFile = '.wrangler/reset-admin.sql';
writeFileSync(sqlFile, sql);
execFileSync(
  process.execPath,
  ['node_modules/wrangler/bin/wrangler.js', 'd1', 'execute', 'DB', '--local', '-y',
   '--config', 'dist/server/wrangler.json', '--persist-to', '.wrangler/state', '--file', sqlFile],
  {stdio: 'pipe', encoding: 'utf8'},
);

console.log('管理员密码已重置，新密码：');
console.log(password);
console.log('\n请立即登录并尽快在"账号"里改成自己的密码。');
