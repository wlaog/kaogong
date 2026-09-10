import {db,response,readJson,errorResponse,HttpError} from '@/lib/server-db';
import {requireAdmin,limit} from '@/lib/auth';
import {digest,newInvite,normalizeInvite} from '@/lib/auth-crypto';
export async function GET(request:Request){try{await requireAdmin(request);const d=db();const [invites,members]=await d.batch([d.prepare("SELECT id,label,prefix,max_uses AS maxUses,used,expires_at AS expiresAt,revoked,created_at AS createdAt FROM auth_invites WHERE id!='bootstrap-owner' ORDER BY created_at DESC LIMIT 200"),d.prepare('SELECT id,username,display_name AS displayName,role,created_at AS createdAt FROM auth_users ORDER BY created_at DESC LIMIT 200')]);return response({invites:invites.results,members:members.results})}catch(e){return errorResponse(e)}}
export async function POST(request:Request){try{const user=await requireAdmin(request),a=await readJson(request),d=db();
if(a.action==='create'){
await limit(request,'invite-create',user.id);
if(![1,5,10,20,50].includes(a.maxUses as number)||![1,7,30].includes(a.days as number)||typeof a.label!=='string'||a.label.trim().length>40)throw new HttpError(400,'请检查可注册人数、有效期和备注');
const code=newInvite(),id=crypto.randomUUID(),createdAt=Date.now(),expiresAt=createdAt+Number(a.days)*86400000,label=a.label.trim()||'学习伙伴';
await d.prepare("INSERT INTO auth_invites(id,code_hash,prefix,label,role,max_uses,used,expires_at,revoked,created_at,created_by) VALUES (?,?,?,?,'member',?,0,?,0,?,?)").bind(id,digest(normalizeInvite(code)),code.slice(0,7)+'-…',label,a.maxUses,expiresAt,createdAt,user.id).run();
return response({ok:true,code,invite:{id,label,prefix:code.slice(0,7)+'-…',maxUses:a.maxUses,used:0,expiresAt,revoked:0,createdAt}},201);
}
if(a.action==='revoke'){
if(typeof a.id!=='string'||a.id==='bootstrap-owner')throw new HttpError(400,'无法停用这个邀请码');
const result=await d.prepare('UPDATE auth_invites SET revoked=1 WHERE id=?').bind(a.id).run();if(!result.meta.changes)throw new HttpError(404,'邀请码不存在');return response({ok:true});
}
throw new HttpError(400,'不支持的操作');
}catch(e){return errorResponse(e)}}

