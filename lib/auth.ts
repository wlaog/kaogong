import {env} from 'cloudflare:workers';
import {db,HttpError,response} from './server-db';
import {digest,newToken} from './auth-crypto';
import type {AuthUser} from './auth-types';
export const SESSION_MS=7*86400000;
const cookieName=(request:Request)=>new URL(request.url).protocol==='https:'?'__Host-ruanruan_session':'ruanruan_session_dev';
export function sessionCookie(request:Request,token:string,clear=false){return cookieName(request)+'='+token+'; Path=/; HttpOnly; SameSite=Lax; Max-Age='+(clear?0:SESSION_MS/1000)+(new URL(request.url).protocol==='https:'?'; Secure':'')}
export function sessionToken(request:Request){const name=cookieName(request);const token=(request.headers.get('cookie')||'').split(';').map(x=>x.trim()).find(x=>x.startsWith(name+'='))?.slice(name.length+1)||'';return /^[A-Za-z0-9_-]{43}$/.test(token)?token:''}
export async function currentUser(request:Request):Promise<AuthUser|null>{const token=sessionToken(request);if(!token)return null;return db().prepare('SELECT u.id,u.username,u.display_name AS displayName,u.role FROM auth_sessions s JOIN auth_users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>?').bind(digest(token),Date.now()).first<AuthUser>()}
export async function requireUser(request:Request){const user=await currentUser(request);if(!user)throw new HttpError(401,'登录已过期，请重新登录');return user}
export async function requireAdmin(request:Request){const user=await requireUser(request);if(user.role!=='admin')throw new HttpError(403,'只有管理员可以管理邀请码');return user}
export async function limit(request:Request,action:string,account?:string){const d=db(),now=Date.now(),window=15*60000;const identity=request.headers.get('cf-connecting-ip')||'local-or-proxy';const scopes=[{key:action+':ip:'+digest(identity),max:action==='register'?12:action==='login'?40:30}];if(account)scopes.push({key:action+':account:'+digest(account),max:action==='login'?10:10});
for(const scope of scopes){const key=scope.key+':'+Math.floor(now/window);const row=await d.prepare('INSERT INTO auth_limits(id,count,expires_at) VALUES (?,1,?) ON CONFLICT(id) DO UPDATE SET count=count+1 RETURNING count').bind(key,now+window).first<{count:number}>();if(row&&row.count>scope.max)throw new HttpError(429,'尝试次数有点多，请 15 分钟后再试')}
await d.prepare('DELETE FROM auth_limits WHERE expires_at<?').bind(now).run();
await d.prepare('DELETE FROM auth_sessions WHERE expires_at<?').bind(now).run();
}
export async function ensureBootstrap(){const hash=env.BOOTSTRAP_INVITE_HASH;if(!hash||!/^[a-f0-9]{64}$/.test(hash))return;await db().prepare("INSERT OR IGNORE INTO auth_invites(id,code_hash,prefix,label,role,max_uses,used,expires_at,revoked,created_at,created_by) VALUES ('bootstrap-owner',?,'首次管理员','站主专用','admin',1,0,?,0,?,NULL)").bind(hash,Date.now()+7*86400000,Date.now()).run()}
