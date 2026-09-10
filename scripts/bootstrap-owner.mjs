import {randomBytes,createHash} from 'node:crypto';
import {mkdir,writeFile,access} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {resolve} from 'node:path';
const root=resolve(import.meta.dirname,'..');
const directory=resolve(root,'.local');
await mkdir(directory,{recursive:true});
const file=resolve(directory,'owner-invite.txt');
try{await access(file);console.log('Owner invitation already exists at .local/owner-invite.txt; keeping it unchanged.');process.exit(0)}catch{}
const code='RR-'+randomBytes(16).toString('hex').toUpperCase().match(/.{1,4}/g).join('-');
const hash=createHash('sha256').update(code.replace(/[\s-]/g,'').toUpperCase()).digest('hex');
const now=Date.now(),expiry=now+7*86400000;
const sql="INSERT INTO auth_invites(id,code_hash,prefix,label,role,max_uses,used,expires_at,revoked,created_at,created_by) VALUES ('bootstrap-owner','"+hash+"','owner','Initial owner','admin',1,0,"+expiry+",0,"+now+",NULL);";
const sqlFile=resolve(directory,'bootstrap.sql');
await writeFile(sqlFile,sql,{flag:'wx'});
execFileSync(process.execPath,[resolve(root,'node_modules/wrangler/bin/wrangler.js'),'d1','execute','DB','--local','--config','work/wrangler.json','--persist-to','.wrangler/state','--file',sqlFile],{cwd:root,stdio:'pipe',env:{...process.env,WRANGLER_WRITE_LOGS:'false',WRANGLER_LOG_PATH:'.wrangler/logs'}});
await writeFile(file,'软软上岸 · 首个管理员邀请码\n\n'+code+'\n\n在网站注册页使用，仅可注册一次。有效期至 '+new Date(expiry).toLocaleString('zh-CN',{timeZone:'Asia/Shanghai'})+'（北京时间）。\n请由站主本人使用，注册后可在“邀请码管理”邀请普通成员。\n',{flag:'wx'});
await writeFile(resolve(directory,'bootstrap-hosting.env'),'BOOTSTRAP_INVITE_HASH='+hash+'\n',{flag:'wx'});
console.log('Created one-time owner invitation: .local/owner-invite.txt. Plaintext code was not printed.');

