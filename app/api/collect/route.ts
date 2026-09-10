import {requireUser} from '@/lib/auth';
import {db,response,safeRequest,readJson,errorResponse} from '@/lib/server-db';
import {sources,collectSource} from '@/lib/collector';
const day=(date:string)=>new Date(new Date(date).getTime()+28800000).toISOString().slice(0,10);
export async function POST(request:Request){try{await requireUser(request);const d=db(),input=await readJson(request) as {force?:boolean};const old=await d.prepare("SELECT value FROM settings WHERE id='collection'").first<{value:string}>();const report=old?JSON.parse(old.value):null;const now=Date.now();
if(report&&(now-new Date(report.at).getTime()<300000||(!input.force&&day(report.at)===day(new Date().toISOString()))))return response({report,skipped:true});
const lock=await d.prepare("INSERT INTO settings(id,value) VALUES ('collection_lock',?) ON CONFLICT(id) DO UPDATE SET value=excluded.value WHERE CAST(settings.value AS INTEGER) < ?").bind(String(now+90000),now).run();if(!lock.meta.changes)return response({report,busy:true});
try{
const results=await Promise.all(sources.map(async s=>{try{const result=await collectSource(s);let added=0;if(result.links.length){const inserts=result.links.map(l=>{const subject=l.title.includes('申论')?'申论':l.title.includes('行测')?'行测':'综合';const year=l.title.match(/20\d{2}/)?.[0]||'未标注';return d.prepare('INSERT OR IGNORE INTO resources(id,url,title,source,kind,subject,year,summary,collected_at,origin) VALUES (?,?,?,?,?,?,?,?,?,?)').bind(crypto.randomUUID(),l.url,l.title,s.name,s.kind,subject,year,s.kind==='经验分享'?'公开经验帖，仅供方法参考。自动收录标题与链接，正文请在原站阅读。':s.kind==='官方信息'?'官方来源入口，适用范围以原文为准。':'第三方试题索引，可能含回忆版。请到来源站核对题目和使用条件。',new Date().toISOString(),'自动收集')});const batches=await d.batch(inserts);added=batches.reduce((n,r)=>n+(r.meta.changes||0),0)}return {source:s.name,url:s.url,status:result.status,message:result.message,found:result.links.length,added}}catch(e){return {source:s.name,url:s.url,status:'error',message:e instanceof Error&&e.name==='AbortError'?'来源响应超时，下次再试':e instanceof Error?e.message:'暂时无法收集',found:0,added:0}}}));
const report={at:new Date().toISOString(),added:results.reduce((n,r)=>n+r.added,0),sources:results};await d.prepare("INSERT INTO settings(id,value) VALUES ('collection',?) ON CONFLICT(id) DO UPDATE SET value=excluded.value").bind(JSON.stringify(report)).run();return response({report});
}finally{await d.prepare("UPDATE settings SET value='0' WHERE id='collection_lock'").run()}
}catch(e){return errorResponse(e,'暂时没有完成收集，已有资料仍然可以阅读。')}}

