import {db,response,readJson,errorResponse,HttpError} from '@/lib/server-db';
import {currentUser,requireUser,limit,ensureBootstrap,sessionCookie,sessionToken,SESSION_MS} from '@/lib/auth';
import {digest,newToken,normalizeInvite,normalizeUsername,validUsername,validPassword,hashPassword,verifyPassword} from '@/lib/auth-crypto';
import {defaultProfile} from '@/lib/study-data';
export async function GET(request:Request){try{await ensureBootstrap();return response({user:await currentUser(request)})}catch(e){return errorResponse(e,'账号服务暂时没有连上，请稍后重试')}}
export async function POST(request:Request){try{
const a=await readJson(request),d=db(),now=Date.now();
if(a.action==='logout'){const token=sessionToken(request);if(token)await d.prepare('DELETE FROM auth_sessions WHERE token_hash=?').bind(digest(token)).run();return response({ok:true},200,{'Set-Cookie':sessionCookie(request,'',true)})}
if(a.action==='register'){
const username=normalizeUsername(a.username),name=typeof a.displayName==='string'?a.displayName.trim():username;
if(!validUsername(username))throw new HttpError(400,'用户名请使用 3—24 位字母、数字或下划线');
if(!name||name.length>24)throw new HttpError(400,'昵称请填写 1—24 个字');
if(!validPassword(a.password))throw new HttpError(400,'密码请设置为 10—128 个字符');
if(typeof a.invite!=='string'||a.invite.length>100)throw new HttpError(400,'请填写有效的邀请码');
await limit(request,'register');await ensureBootstrap();
const inviteHash=digest(normalizeInvite(a.invite));
const invite=await d.prepare('SELECT id FROM auth_invites WHERE code_hash=? AND revoked=0 AND used<max_uses AND expires_at>?').bind(inviteHash,now).first<{id:string}>();
if(!invite)throw new HttpError(400,'邀请码无效、已过期或已用完，请联系邀请你的人');
const passwordHash=await hashPassword(a.password),id=crypto.randomUUID(),token=newToken();
const exists='EXISTS (SELECT 1 FROM auth_users WHERE id=?)';
const adopt="EXISTS (SELECT 1 FROM auth_users WHERE id=? AND invited_by='bootstrap-owner')";
let result;
try{result=await d.batch([
d.prepare('INSERT INTO auth_users(id,username,display_name,password_hash,role,invited_by,created_at) SELECT ?,?,?,?,role,id,? FROM auth_invites WHERE id=? AND code_hash=? AND revoked=0 AND used<max_uses AND expires_at>?').bind(id,username,name,passwordHash,now,invite.id,inviteHash,Date.now()),
d.prepare('UPDATE auth_invites SET used=used+1 WHERE id=? AND '+exists).bind(invite.id,id),
d.prepare('INSERT INTO auth_sessions(token_hash,user_id,expires_at,created_at) SELECT ?,?,?,? WHERE '+exists).bind(digest(token),id,now+SESSION_MS,now,id),
d.prepare("INSERT INTO user_profiles(user_id,value) SELECT ?,CASE WHEN invited_by='bootstrap-owner' THEN COALESCE((SELECT value FROM settings WHERE id='profile'),?) ELSE ? END FROM auth_users WHERE id=?").bind(id,JSON.stringify(defaultProfile()),JSON.stringify(defaultProfile()),id),
d.prepare('INSERT INTO user_progress(user_id,id,done) SELECT ?,id,done FROM progress WHERE '+adopt).bind(id,id),
d.prepare('INSERT INTO user_bookmarks(user_id,id) SELECT ?,id FROM bookmarks WHERE '+adopt).bind(id,id),
d.prepare('INSERT INTO user_notes(user_id,id,subject,text,created_at) SELECT ?,id,subject,text,created_at FROM notes WHERE '+adopt).bind(id,id),
d.prepare('INSERT INTO user_answers(user_id,id,choice,correct,updated_at) SELECT ?,id,choice,correct,updated_at FROM answers WHERE '+adopt).bind(id,id)
])}catch(e){if(String(e).includes('UNIQUE constraint failed: auth_users.username'))throw new HttpError(409,'这个用户名已经有人使用了，换一个试试');throw e}
if(!result[0].meta.changes)throw new HttpError(400,'邀请码刚刚已失效或用完，请换一个');
return response({ok:true},201,{'Set-Cookie':sessionCookie(request,token)});
}
if(a.action==='login'){
const username=normalizeUsername(a.username);
if(!validUsername(username)||!validPassword(a.password))throw new HttpError(401,'用户名或密码不正确');
await limit(request,'login',username);
const row=await d.prepare('SELECT id,password_hash FROM auth_users WHERE username=?').bind(username).first<{id:string;password_hash:string}>();
const matches=await verifyPassword(a.password,row?.password_hash||null);if(!row||!matches)throw new HttpError(401,'用户名或密码不正确');
const token=newToken();const inserted=await d.prepare('INSERT INTO auth_sessions(token_hash,user_id,expires_at,created_at) SELECT ?,id,?,? FROM auth_users WHERE id=? AND password_hash=?').bind(digest(token),now+SESSION_MS,now,row.id,row.password_hash).run();
if(!inserted.meta.changes)throw new HttpError(401,'账号凭据已更新，请重新登录');
return response({ok:true},200,{'Set-Cookie':sessionCookie(request,token)});
}
const user=await requireUser(request);
if(a.action==='password'){
if(!validPassword(a.password)||!validPassword(a.currentPassword))throw new HttpError(400,'请填写当前密码，新密码需为 10—128 个字符');
await limit(request,'password',user.id);
const row=await d.prepare('SELECT password_hash FROM auth_users WHERE id=?').bind(user.id).first<{password_hash:string}>();
if(!row||!await verifyPassword(a.currentPassword,row.password_hash))throw new HttpError(400,'当前密码不正确');
const hash=await hashPassword(a.password),token=newToken();
const exists='EXISTS (SELECT 1 FROM auth_users WHERE id=? AND password_hash=?)';
const result=await d.batch([
d.prepare('UPDATE auth_users SET password_hash=? WHERE id=? AND password_hash=?').bind(hash,user.id,row.password_hash),
d.prepare('DELETE FROM auth_sessions WHERE user_id=? AND '+exists).bind(user.id,user.id,hash),
d.prepare('INSERT INTO auth_sessions(token_hash,user_id,expires_at,created_at) SELECT ?,id,?,? FROM auth_users WHERE id=? AND password_hash=?').bind(digest(token),now+SESSION_MS,now,user.id,hash)
]);
if(!result[0].meta.changes)throw new HttpError(409,'密码刚刚发生变化，请重新登录');
return response({ok:true},200,{'Set-Cookie':sessionCookie(request,token)});
}
if(a.action==='profile'){
if(typeof a.displayName!=='string'||!a.displayName.trim()||a.displayName.trim().length>24)throw new HttpError(400,'昵称请填写 1—24 个字');
await d.prepare('UPDATE auth_users SET display_name=? WHERE id=?').bind(a.displayName.trim(),user.id).run();return response({ok:true});
}
throw new HttpError(400,'不支持的操作');
}catch(e){return errorResponse(e,'账号操作没有完成，请稍后再试')}}

