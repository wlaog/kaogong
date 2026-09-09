import {db,response,safeRequest} from '@/lib/server-db';
import {defaultProfile,initialResources,lessonById} from '@/lib/study-data';
export async function GET(){try{
const d=db();await d.batch(initialResources.map(r=>d.prepare('INSERT OR IGNORE INTO resources (id,url,title,source,kind,subject,year,summary,collected_at,origin) VALUES (?,?,?,?,?,?,?,?,?,?)').bind(r.id,r.url,r.title,r.source,r.kind,r.subject,r.year,r.summary,r.collectedAt,r.origin)));
await d.prepare("INSERT OR IGNORE INTO settings (id,value) VALUES ('profile',?)").bind(JSON.stringify(defaultProfile())).run();
const [settings,progress,resources,bookmarks,notes,answers]=await d.batch([d.prepare('SELECT * FROM settings'),d.prepare('SELECT * FROM progress WHERE done=1'),d.prepare('SELECT id,url,title,source,kind,subject,year,summary,collected_at AS collectedAt,origin FROM resources ORDER BY collected_at DESC LIMIT 500'),d.prepare('SELECT id FROM bookmarks'),d.prepare('SELECT id,subject,text,created_at AS createdAt FROM notes ORDER BY created_at DESC LIMIT 200'),d.prepare('SELECT * FROM answers')]);
const data=Object.fromEntries(settings.results.map((s:any)=>[s.id,s.value]));
return response({profile:JSON.parse(String(data.profile)),progress:progress.results.map((r:any)=>r.id),resources:resources.results,bookmarks:bookmarks.results.map((r:any)=>r.id),notes:notes.results,answers:answers.results,collection:data.collection?JSON.parse(String(data.collection)):null});
}catch(e){console.error('state load',e);return response({error:'学习记录暂时没有连上。可以先阅读小课与精选资料，稍后点重试。'},503)}}
export async function POST(request:Request){try{safeRequest(request);const body=await request.text();if(body.length>12000)return response({error:'内容太长，请缩短后保存'},413);const a=JSON.parse(body),d=db();
if(a.type==='profile'){
const p=a.value;if(!p||!['通用备考','国考','省考'].includes(p.target)||typeof p.province!=='string'||p.province.length>20||![2,3,4,6].includes(p.hours)||!/^\d{4}-\d{2}-\d{2}$/.test(p.startDate)||!Number.isFinite(Date.parse(p.startDate))||new Date(p.startDate).toISOString().slice(0,10)!==p.startDate)return response({error:'请检查考试目标、时长和日期'},400);
await d.prepare("INSERT INTO settings(id,value) VALUES ('profile',?) ON CONFLICT(id) DO UPDATE SET value=excluded.value").bind(JSON.stringify({target:p.target,province:p.province.trim(),hours:p.hours,startDate:p.startDate})).run();
}else if(a.type==='progress'){
if(typeof a.id!=='string'||!/^([1-9]|[12]\d|30)-[012]$/.test(a.id)||typeof a.done!=='boolean')return response({error:'任务不存在'},400);
await d.prepare('INSERT INTO progress(id,done) VALUES (?,?) ON CONFLICT(id) DO UPDATE SET done=excluded.done').bind(a.id,a.done?1:0).run();
}else if(a.type==='bookmark'){
if(typeof a.id!=='string'||typeof a.done!=='boolean'||!await d.prepare('SELECT id FROM resources WHERE id=?').bind(a.id).first())return response({error:'资料不存在'},400);
await (a.done?d.prepare('INSERT OR IGNORE INTO bookmarks(id) VALUES (?)'):d.prepare('DELETE FROM bookmarks WHERE id=?')).bind(a.id).run();
}else if(a.type==='note'){
if(typeof a.text!=='string'||!a.text.trim()||a.text.length>4000||typeof a.subject!=='string'||a.subject.length>30)return response({error:'笔记需要 1—4000 个字'},400);
const note={id:crypto.randomUUID(),subject:a.subject,text:a.text.trim(),createdAt:new Date().toISOString()};await d.prepare('INSERT INTO notes(id,subject,text,created_at) VALUES (?,?,?,?)').bind(note.id,note.subject,note.text,note.createdAt).run();return response({ok:true,note});
}else if(a.type==='answer'){
const lesson=lessonById(a.id),q=lesson.question;if(lesson.id!==a.id||!q||!Number.isInteger(a.choice)||a.choice<0||a.choice>=q.options.length)return response({error:'请先选一个答案'},400);
const correct=a.choice===q.answer;await d.prepare('INSERT INTO answers(id,choice,correct,updated_at) VALUES (?,?,?,?) ON CONFLICT(id) DO UPDATE SET choice=excluded.choice,correct=excluded.correct,updated_at=excluded.updated_at').bind(a.id,a.choice,correct?1:0,new Date().toISOString()).run();return response({ok:true,correct});
}else{return response({error:'不支持的操作'},400)}
return response({ok:true});
}catch(e){console.error('save',e);return response({error:'这次没有保存成功，请稍后重试。'},500)}}

