import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {Miniflare} from 'miniflare';
import {digest,newInvite,normalizeInvite,hashPassword,verifyPassword} from '../lib/auth-crypto.ts';
test('password hashes use random salts and verify only the right secret',async()=>{
const a=await hashPassword('test-only-long-password'),b=await hashPassword('test-only-long-password');
assert.notEqual(a,b);assert(await verifyPassword('test-only-long-password',a));assert.equal(await verifyPassword('wrong-password-long',a),false);
});
test('invitation registration, sessions, admin permissions and private study data',async()=>{
const ownerCode=newInvite(),root=resolve(import.meta.dirname,'..');
const server=resolve(root,'dist/server');const paths=(await readdir(server,{recursive:true})).filter(p=>p.endsWith('.js')&&p!=='index.js');const modules=['index.js',...paths].map(path=>({type:'ESModule',path:resolve(server,path)}));
const mf=new Miniflare({modules,compatibilityDate:'2026-05-15',compatibilityFlags:['nodejs_compat'],d1Databases:['DB'],bindings:{BOOTSTRAP_INVITE_HASH:digest(normalizeInvite(ownerCode))}});
try{
const d=await mf.getD1Database('DB');
for(const migration of ['0000_fuzzy_onslaught.sql','0001_known_luminals.sql']){
const sql=await readFile(resolve(root,'drizzle',migration),'utf8');for(const statement of sql.split('--> statement-breakpoint').map(s=>s.trim()).filter(Boolean))await d.prepare(statement).run();
}
await d.prepare("INSERT INTO notes(id,subject,text,created_at) VALUES ('legacy-private','legacy','Only the owner should receive this note','2026-09-09T00:00:00Z')").run();
const base='https://study.test';
async function call(path,body,cookie='',origin=base){
const response=await mf.dispatchFetch(base+path,{method:body===undefined?'GET':'POST',headers:{...(body===undefined?{}:{'Content-Type':'application/json','Origin':origin}),...(cookie?{Cookie:cookie}:{})},body:body===undefined?undefined:JSON.stringify(body)});
const data=await response.json();return {status:response.status,data,cookie:response.headers.get('set-cookie')?.split(';')[0]||'',header:response.headers.get('set-cookie')||''};
}
const register=(name,invite,cookie='')=>call('/api/auth',{action:'register',username:name,password:'correct-test-password',displayName:name,invite,role:'admin'},cookie);
const signin=(username,password='correct-test-password')=>call('/api/auth',{action:'login',username,password});
const auth=await call('/api/auth');assert.equal(auth.status,200);assert.equal(auth.data.user,null);
assert.equal((await call('/api/state')).status,401);
assert.equal((await call('/api/collect',{})).status,401);
assert.equal((await call('/api/invites')).status,401);
assert.equal((await register('bad_code','not-valid')).status,400);
const owner=await register('test_owner',ownerCode);assert.equal(owner.status,201,JSON.stringify(owner.data));
assert.match(owner.header,/HttpOnly/);assert.match(owner.header,/Secure/);assert.match(owner.header,/SameSite=Lax/);assert.match(owner.cookie,/^__Host-/);
assert.equal((await call('/api/auth',undefined,owner.cookie)).data.user.role,'admin');
assert.equal((await call('/api/state',undefined,owner.cookie)).data.notes[0].id,'legacy-private');
assert.equal((await register('owner_again',ownerCode)).status,400);
async function invite(maxUses=5){const r=await call('/api/invites',{action:'create',label:'test group',days:7,maxUses,role:'admin'},owner.cookie);assert.equal(r.status,201,JSON.stringify(r.data));return r.data;}
const group=await invite();
const a=await register('student_a',group.code),b=await register('student_b',group.code);assert.equal(a.status,201);assert.equal(b.status,201);
const aUser=(await call('/api/auth',undefined,a.cookie)).data.user;
const bUser=(await call('/api/auth',undefined,b.cookie)).data.user;
assert.equal(aUser.role,'member');assert.equal(bUser.role,'member');
assert.equal((await call('/api/invites',undefined,a.cookie)).status,403);
assert.equal((await call('/api/invites',{action:'create',days:7,maxUses:1,label:''},a.cookie)).status,403);
const usedBefore=(await d.prepare('SELECT used FROM auth_invites WHERE id=?').bind(group.invite.id).first()).used;
assert.equal((await register('STUDENT_A',group.code)).status,409);
assert.equal((await d.prepare('SELECT used FROM auth_invites WHERE id=?').bind(group.invite.id).first()).used,usedBefore);
assert.equal((await call('/api/state',{type:'progress',id:'1-0',done:true,userId:bUser.id},a.cookie)).status,200);
assert.equal((await call('/api/state',{type:'note',subject:'private',text:'A private note',userId:bUser.id},a.cookie)).status,200);
assert.equal((await call('/api/state',{type:'bookmark',id:'official',done:true,userId:bUser.id},a.cookie)).status,200);
assert.equal((await call('/api/state',{type:'answer',id:'data',choice:0,userId:bUser.id},a.cookie)).status,200);
assert.equal((await call('/api/state',{type:'profile',value:{target:'省考',province:'广东',hours:2,startDate:'2026-09-10'},userId:bUser.id},a.cookie)).status,200);
const as=(await call('/api/state',undefined,a.cookie)).data,bs=(await call('/api/state?userId='+aUser.id,undefined,b.cookie)).data;
assert.deepEqual(as.progress,['1-0']);assert.equal(as.notes[0].text,'A private note');assert.equal(as.profile.province,'广东');assert(as.bookmarks.includes('official'));assert.equal(as.answers[0].correct,0);
assert.equal(bs.progress.length,0);assert.equal(bs.notes.length,0);assert.equal(bs.answers.length,0);assert.equal(bs.bookmarks.length,0);assert.equal(bs.profile.province,'');
const revoked=await invite(1);await call('/api/invites',{action:'revoke',id:revoked.invite.id},owner.cookie);
assert.equal((await register('revoked_user',revoked.code)).status,400);
const expired=await invite(1);await d.prepare('UPDATE auth_invites SET expires_at=0 WHERE id=?').bind(expired.invite.id).run();
assert.equal((await register('expired_user',expired.code)).status,400);
const single=await invite(1);const race=await Promise.all([register('race_one',single.code),register('race_two',single.code)]);
assert.deepEqual(race.map(r=>r.status).sort(),[201,400]);assert.equal((await d.prepare('SELECT used FROM auth_invites WHERE id=?').bind(single.invite.id).first()).used,1);
assert.equal((await signin('student_a','wrong-test-password')).status,401);
assert.equal((await signin('nobody_here','wrong-test-password')).status,401);
const a2=await signin('student_a');assert.equal(a2.status,200);
const passwordChange=await call('/api/auth',{action:'password',currentPassword:'correct-test-password',password:'new-correct-test-password'},a.cookie);assert.equal(passwordChange.status,200,JSON.stringify(passwordChange.data));
assert.equal((await call('/api/state',undefined,a.cookie)).status,401);
assert.equal((await call('/api/state',undefined,a2.cookie)).status,401);
assert.equal((await signin('student_a')).status,401);
const a3=await signin('student_a','new-correct-test-password');assert.equal(a3.status,200);
assert.equal((await call('/api/state',{type:'progress',id:'1-1',done:true},a3.cookie,'https://evil.test')).status,403);
assert.equal((await call('/api/state',{type:'note',subject:'x',text:'a'.repeat(18000)},a3.cookie)).status,413);
assert.equal((await call('/api/state',{type:'progress',id:'31-0',done:true},a3.cookie)).status,400);
await call('/api/auth',{action:'logout'},a3.cookie);assert.equal((await call('/api/state',undefined,a3.cookie)).status,401);
await d.prepare('UPDATE auth_sessions SET expires_at=0 WHERE user_id=?').bind(bUser.id).run();assert.equal((await call('/api/state',undefined,b.cookie)).status,401);
const userRow=await d.prepare('SELECT password_hash FROM auth_users WHERE id=?').bind(aUser.id).first();assert.match(userRow.password_hash,/^scrypt\$/);assert(!userRow.password_hash.includes('new-correct-test-password'));
const storedInvite=await d.prepare('SELECT code_hash FROM auth_invites WHERE id=?').bind(group.invite.id).first();assert.equal(storedInvite.code_hash,digest(normalizeInvite(group.code)));
let limited=false;for(let i=0;i<12;i++){const r=await signin('rate_limit_subject','never-correct-password');if(r.status===429){limited=true;break}assert.equal(r.status,401)}assert(limited,'Repeated guesses should be rate limited');
const list=(await call('/api/invites',undefined,owner.cookie)).data;assert(list.members.length>=4);assert(list.invites.every(i=>!('code_hash' in i)&&!('code' in i)));
console.log('Verified: single-use concurrency, invitation expiry/revocation, password/session rotation, data isolation, CSRF, input limits, admin permissions, rate limiting and legacy-owner migration.');
}finally{await mf.dispose()}
});

