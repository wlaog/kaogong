// 生产环境入口：用 Miniflare（workerd 运行时）在本服务器运行 vinext 构建出的 Worker。
// D1 数据库持久化为本地 SQLite 文件（.wrangler/state/v3），业务代码零改动。
// 用法：先 npm run build，再 node server/prod.mjs（或 PM2 守护）。
import fs from 'node:fs';
import path from 'node:path';
import { Miniflare } from 'miniflare';

const port = Number(process.env.PORT || 3000);
const host = process.env.HOST || '0.0.0.0';
const configPath = path.resolve('dist/server/wrangler.json');
const migrationPath = path.resolve('drizzle/0000_fuzzy_onslaught.sql');

if (!fs.existsSync(configPath)) {
  console.error('未找到 dist/server/wrangler.json，请先执行 npm run build');
  process.exit(1);
}

const mf = new Miniflare({
  wranglerConfigPath: configPath,
  // 与 wrangler dev 使用同一状态目录，本地调试和线上数据互通
  persist: path.resolve('.wrangler/state/v3'),
  listen: { port, hostname: host },
});

await mf.ready;

// 首次启动自动应用 drizzle 迁移（幂等：已有表则跳过）
const d1 = await mf.getD1Database('DB');
const hasTables = await d1
  .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='settings'")
  .first();
if (!hasTables) {
  const sql = fs.readFileSync(migrationPath, 'utf8');
  const statements = sql
    .split('--> statement-breakpoint')
    .map((s) => s.trim())
    .filter(Boolean);
  for (const stmt of statements) {
    await d1.prepare(stmt).run();
  }
  console.log('数据库表已初始化');
}

console.log(`软软上岸 已启动: http://${host === '0.0.0.0' ? '127.0.0.1' : host}:${port}`);
