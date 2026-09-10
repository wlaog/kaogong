import {db,response,readJson,errorResponse,HttpError} from '@/lib/server-db';
import {requireUser} from '@/lib/auth';
import {defaultProfile,initialResources,lessonById} from '@/lib/study-data';
export async function GET(request:Request){try{
const user=await requireUser(request),d=db();
await d.batch(initialResources.map(r=>d.prepare('INSERT OR IGNORE INTO resources (id,url,title,source,kind,subject,year,summary,collected_at,origin) VALUES (?,?,?,?,?,?,?,?,?,?)').bind(r.id,r.url,r.title,r.source,r.kind,r.subject,r.year,r.summary,r.collectedAt,r.origin)));
await d.prepare('INSERT OR IGNORE INTO user_profiles(user_id,value) VALUES (?,?)').bind(user.id,JSON.stringify(defaultProfile())).run();
const [profile,progress,resources,bookmarks,notes,answers,collection]=await d.batch<Record<string,unknown>>([
d.prepare('SELECT value FROM user_profiles WHERE user_id=?').bind(user.id),
d.prepare('SELECT id FROM user_progress WHERE user_id=? AND done=1').bind(user.id),
d.prepare('SELECT id,url,title,source,kind,subject,year,summary,collected_at AS collectedAt,origin FROM resources ORDER BY collected_at DESC LIMIT 500'),
d.prepare('SELECT id FROM user_bookmarks WHERE user_id=?').bind(user.id),
d.prepare('SELECT id,subject,text,created_at AS createdAt FROM user_notes WHERE user_id=? ORDER BY created_at DESC LIMIT 200').bind(user.id),
d.prepare('SELECT id,choice,correct FROM user_answers WHERE user_id=?').bind(user.id),
d.prepare("SELECT value FROM settings WHERE id='collection'")
]);
return response({profile:JSON.parse(String(profile.results[0].value)),progress:progress.results.map(r=>r.id),resources:resources.results,bookmarks:bookmarks.results.map(r=>r.id),notes:notes.results,answers:answers.results,collection:collection.results.length?JSON.parse(String(collection.results[0].value)):null});
}catch(e){return errorResponse(e,'学习记录暂时没有连上，请稍后重试')}}
export async function POST(request:Request){try{
const user=await requireUser(request),a=await readJson(request),d=db();
if(a.type==='profile'){
const p=a.value as Record<string,unknown>|undefined;
if(!p||!['通用备考','国考','省考'].includes(String(p.target))||typeof p.province!=='string'||p.province.length>20||![2,3,4,6].includes(p.hours as number)||typeof p.startDate!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(p.startDate)||!Number.isFinite(Date.parse(p.startDate))||new Date(p.startDate).toISOString().slice(0,10)!==p.startDate)throw new HttpError(400,'请检查考试目标、时长和日期');
await d.prepare('INSERT INTO user_profiles(user_id,value) VALUES (?,?) ON CONFLICT(user_id) DO UPDATE SET value=excluded.value').bind(user.id,JSON.stringify({target:p.target,province:p.province.trim(),hours:p.hours,startDate:p.startDate})).run();
}else if(a.type==='progress'){
if(typeof a.id!=='string'||!/^([1-9]|[12]\d|30)-[012]$/.test(a.id)||typeof a.done!=='boolean')throw new HttpError(400,'任务不存在');
await d.prepare('INSERT INTO user_progress(user_id,id,done) VALUES (?,?,?) ON CONFLICT(user_id,id) DO UPDATE SET done=excluded.done').bind(user.id,a.id,a.done?1:0).run();
}else if(a.type==='bookmark'){
if(typeof a.id!=='string'||typeof a.done!=='boolean'||!await d.prepare('SELECT id FROM resources WHERE id=?').bind(a.id).first())throw new HttpError(400,'资料不存在');
await (a.done?d.prepare('INSERT OR IGNORE INTO user_bookmarks(user_id,id) VALUES (?,?)'):d.prepare('DELETE FROM user_bookmarks WHERE user_id=? AND id=?')).bind(user.id,a.id).run();
}else if(a.type==='note'){
if(typeof a.text!=='string'||!a.text.trim()||a.text.length>4000||typeof a.subject!=='string'||a.subject.length>30)throw new HttpError(400,'笔记需要 1—4000 个字');
const note={id:crypto.randomUUID(),subject:a.subject,text:a.text.trim(),createdAt:new Date().toISOString()};await d.prepare('INSERT INTO user_notes(user_id,id,subject,text,created_at) VALUES (?,?,?,?,?)').bind(user.id,note.id,note.subject,note.text,note.createdAt).run();return response({ok:true,note});
}else if(a.type==='answer'){
if(typeof a.id!=='string')throw new HttpError(400,'练习不存在');
const lesson=lessonById(a.id),q=lesson.question;if(lesson.id!==a.id||!q||!Number.isInteger(a.choice)||Number(a.choice)<0||Number(a.choice)>=q.options.length)throw new HttpError(400,'请先选一个答案');
const correct=a.choice===q.answer;await d.prepare('INSERT INTO user_answers(user_id,id,choice,correct,updated_at) VALUES (?,?,?,?,?) ON CONFLICT(user_id,id) DO UPDATE SET choice=excluded.choice,correct=excluded.correct,updated_at=excluded.updated_at').bind(user.id,a.id,a.choice,correct?1:0,new Date().toISOString()).run();return response({ok:true,correct});
}else throw new HttpError(400,'不支持的操作');
return response({ok:true});
}catch(e){return errorResponse(e,'这次没有保存成功，请稍后重试')}}

