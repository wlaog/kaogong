V1.1 迁移至腾讯云部署，node+pm2

# 软软上岸

面向零基础阅读的 30 天考公学习站，带邀请码注册和独立账号。

## 使用流程

1. 打开网站，选择“邀请码注册”，填写用户名、昵称、密码和邀请码。
2. 用户名为 3—24 位字母、数字或下划线，大小写视为同一账号；密码为 10—128 个字符。
3. 管理员登录后，侧栏的“邀请码管理”可以生成邀请、查看注册成员或停用邀请。支持 1 / 5 / 10 / 20 / 50 人及 1 / 7 / 30 天有效期。
4. 完整邀请码只在创建时显示一次，可复制。数据库仅存摘要；停用邀请不会删除已经注册的账号。
5. 每个账号分别保存设置、任务进度、收藏、练习结果和复盘笔记。资料库和收集记录共用，只有登录用户可以调用。
6. 账号页可改昵称、改密码和退出。改密码会撤销该账号其他会话，当前设备获得新会话。未接入短信、邮件或自助找回密码。

## 首次管理员

本地迁移完成后运行 `node scripts/bootstrap-owner.mjs`。脚本生成一个只能使用一次、有效期七天的站主邀请码，保存在忽略提交的 `.local/owner-invite.txt`。不会创建默认密码，也不会让第一个无邀请访问者成为管理员。已生成时不会覆盖。

只有通过 `bootstrap-owner` 邀请注册的管理员可以继承旧版单人学习记录。旧表完整保留，普通成员无法读取。继承操作与注册在同一数据库事务完成。

部署前，在 Sites 的服务器秘密配置中设置 `BOOTSTRAP_INVITE_HASH`，值来自 `.local/bootstrap-hosting.env`。只设置归一化邀请码的 SHA-256 摘要，不上传原始邀请码。首次账号请求会建立一条七天有效、单次使用的管理员邀请。首次创建后修改该环境变量不会覆盖既有邀请。

本地数据库与正式数据库互相独立。账号系统不会自动改变 Sites 外层访问范围；目前站点仍未发布，外层配置仍只允许站主访问。后续开放给受邀成员前，需要明确发布和访问范围。

## 学习功能

- 30 天、90 个公共科目任务，支持每天 2 / 3 / 4 / 6 小时；模考日保留本科正式时长，复盘可移到次日。
- 9 节原创小课、5 道带解析的原创入门练习，错题进入个人复盘本。
- 真题、大纲和经验资料的原文链接、分类、搜索、收藏。
- 每天首次打开自动检查，保持打开期间每小时检查是否跨天；手动检查间隔五分钟。关闭网站后不抓取。
- 四个固定公开来源：华图真题索引、132 公考申论、QZZN 行测版块、官方大纲入口。只收录标题和原文链接，不下载或转载完整试卷及帖子。
- 来源允许列表、robots 检查、重定向校验、超时、大小上限、去重、收集锁与逐来源结果。

## 本地开发与验证

使用锁文件安装：`npm ci`。启动：`npm run dev`。构建：`npm run build`。

数据库结构在 `db/schema.ts`；增量迁移在 `drizzle/`。旧迁移不可修改。首次本地运行需按顺序应用迁移；正式迁移由 Sites 部署执行。可用本地配置：

```json
{"name":"ruanruan-local","compatibility_date":"2026-05-15","compatibility_flags":["nodejs_compat"],"d1_databases":[{"binding":"DB","database_name":"site-creator-d1","database_id":"00000000-0000-4000-8000-000000000000"}]}
```

保存在忽略提交的 `work/wrangler.json` 后，使用 `wrangler d1 execute DB --local --config work/wrangler.json --persist-to .wrangler/state --file drizzle/文件名.sql` 按序执行。

验证命令：

```text
node node_modules/typescript/bin/tsc --noEmit --incremental false
npm run build
node --experimental-strip-types --test tests/auth.integration.mjs tests/collector.test.mjs
```

认证集成测试在独立临时 Miniflare 数据库运行，不使用或消耗本地站主的邀请码和记录。覆盖邀请码并发兑换、失效/停用、注册与重复用户名、登录、数据隔离、旧数据继承、管理员权限、CSRF、输入上限、猜测限流、修改密码和退出后的会话撤销。

## 账号实现

密码使用独立随机盐和 scrypt（N=16384, r=8, p=5, 32 字节输出）；登录 token 使用 32 字节随机数，数据库存 SHA-256 摘要。HTTPS 使用 __Host- 前缀、Secure、HttpOnly、SameSite=Lax、Path=/ 的七天绝对期限 cookie；仅本地 HTTP 预览使用开发 cookie。会话和角色始终在服务端校验，所有个人查询绑定会话中的用户 ID，忽略调用方提供的用户 ID。

注册通过 D1 批处理事务完成邀请码校验、账号插入、用量递增及会话写入；同一邀请码并发兑换时不会超发。登录对账号和来源进行十五分钟窗口限流。写接口检查同源 Origin、JSON 类型和请求大小。

密码参数参考 [OWASP Password Storage](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html)；运行时兼容性参考 [Cloudflare node:crypto](https://developers.cloudflare.com/workers/runtime-apis/nodejs/crypto/)。

## 内容范围

默认路线覆盖公共科目通用方法，不把省份检索冒充当地专用大纲，专业科目另排。本站原创练习、第三方真题整理与回忆版分别标记。30 天是训练周期，不承诺考试结果。

资料最初核对日期为 2026-09-09。来源记录在 `lib/study-data.ts`，自动更新范围在 `lib/collector.ts`。官方来源目前检查已收录的大纲入口，不是全国公告全网监控；来源改版、限流或要求登录时显示真实结果。

