export const sources=[
{id:'huatu',name:'华图 · 历年真题',url:'https://ah.huatu.com/zt/gkztxz/',kind:'历年真题'},
{id:'shenlun',name:'132 公考 · 申论',url:'https://www.132gk.com/web/exercise/shenlun/exam',kind:'历年真题'},
{id:'qzzn',name:'QZZN · 考友经验',url:'https://bbs.qzzn.com/forum-8-1.html',kind:'经验分享'},
{id:'official',name:'官方考试大纲',url:'https://www.forestry.gov.cn/c/www/gsgg/645383.jhtml',kind:'官方信息'}
];
const hosts=new Set(['ah.huatu.com','www.132gk.com','bbs.qzzn.com','www.forestry.gov.cn','forestry.gov.cn']);
export function normalizedUrl(input:string,base:string){try{const u=new URL(input,base);if(u.protocol!=='https:'||!hosts.has(u.hostname)||u.username||u.password||(u.port&&u.port!=='443'))return null;u.hash='';for(const k of [...u.searchParams.keys()])if(k.startsWith('utm_')||['from','source','spm'].includes(k))u.searchParams.delete(k);return u.href;}catch{return null}}
export function plain(input:string){return input.replace(/<[^>]*>/g,' ').replace(/&#(x[0-9a-f]+|\d+);/gi,(_,v)=>{const n=v[0].toLowerCase()==='x'?parseInt(v.slice(1),16):parseInt(v,10);return n>0&&n<=0x10ffff?String.fromCodePoint(n):''}).replace(/&nbsp;/gi,' ').replace(/&amp;/gi,'&').replace(/&quot;/gi,'"').replace(/&#39;/g,"'").replace(/&lt;/gi,'<').replace(/&gt;/gi,'>').replace(/\s+/g,' ').trim()}
export function extractLinks(html:string,source:typeof sources[number]){
const result:{title:string;url:string}[]=[];const seen=new Set<string>();const cleaned=html.replace(/<(script|style)\b[\s\S]*?<\/\1>/gi,'');
for(const m of cleaned.matchAll(/<a\b[^>]*\bhref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))[^>]*>([\s\S]*?)<\/a>/gi)){const title=plain(m[4]);const url=normalizedUrl(plain(m[1]||m[2]||m[3]||''),source.url);if(!url||seen.has(url)||title.length<8||title.length>130)continue;
const pass=source.kind==='经验分享'?/备考|经验|复习|上岸|行测|申论/.test(title)&&/thread-|tid=/.test(url):source.kind==='官方信息'?/公务员.*(大纲|考试)|公共科目/.test(title):/20\d{2}/.test(title)&&/行测|申论/.test(title)&&/试题|真题|公考.*题/.test(title);
if(!pass||/课程|直播|礼包|优惠|押题/.test(title))continue;seen.add(url);result.push({title,url});if(result.length>=35)break;
}return result;}
function matchRule(path:string,rule:string){const end=rule.endsWith('$');const escaped=rule.replace(/\$$/,'').split('*').map(s=>s.replace(/[.*+?^$\{\}()|[\]\\]/g,'\\$&')).join('.*');return new RegExp('^'+escaped+(end?'$':'')).test(path)}
export function robotsAllows(text:string,path:string){const groups:{agents:string[];rules:{allow:boolean;path:string}[]}[]=[];let g:{agents:string[];rules:{allow:boolean;path:string}[]}|null=null;let directives=false;
for(const raw of text.split(/\r?\n/)){const line=raw.split('#')[0].trim();const colon=line.indexOf(':');if(colon<0)continue;const key=line.slice(0,colon).trim().toLowerCase(),value=line.slice(colon+1).trim();if(key==='user-agent'){if(!g||directives){g={agents:[],rules:[]};groups.push(g);directives=false}g.agents.push(value.toLowerCase())}else if(g&&(key==='allow'||key==='disallow')){directives=true;if(value)g.rules.push({allow:key==='allow',path:value});}}
const exact=groups.filter(g=>g.agents.some(a=>a!=='*'&&'ruanruanstudybot'.includes(a)));const chosen=exact.length?exact:groups.filter(g=>g.agents.includes('*'));const rules=chosen.flatMap(g=>g.rules).filter(r=>matchRule(path,r.path)).sort((a,b)=>b.path.length-a.path.length||Number(b.allow)-Number(a.allow));return rules.length?rules[0].allow:true;}
export async function fetchPage(url:string,maxBytes=2000000){let current=url;const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),9000);try{
for(let i=0;i<4;i++){if(!normalizedUrl(current,current))throw new Error('来源跳转到未收录的网站');const r=await fetch(current,{headers:{'User-Agent':'RuanRuanStudyBot/1.0','Accept':'text/html,text/plain;q=0.9'},redirect:'manual',signal:controller.signal});if([301,302,303,307,308].includes(r.status)){const loc=r.headers.get('location');if(!loc)throw new Error('来源跳转异常');current=new URL(loc,current).href;continue;}if(!r.ok)return {status:r.status,text:''};if(!r.body)return {status:r.status,text:''};const reader=r.body.getReader();const chunks:Uint8Array[]=[];let size=0;try{while(true){const {value,done}=await reader.read();if(done)break;size+=value.length;if(size>maxBytes)throw new Error('页面过大，已跳过');chunks.push(value)}}finally{await reader.cancel().catch(()=>{})}
const bytes=new Uint8Array(size);let offset=0;for(const c of chunks){bytes.set(c,offset);offset+=c.length}const hint=r.headers.get('content-type')+' '+new TextDecoder().decode(bytes.slice(0,3000));const encoding=/charset\s*=\s*["']?\s*(gb2312|gbk|gb18030)/i.test(hint)?'gb18030':'utf-8';return {status:r.status,text:new TextDecoder(encoding).decode(bytes)};}throw new Error('来源跳转过多');
}finally{clearTimeout(timer)}}
export async function collectSource(source:typeof sources[number]){
const u=new URL(source.url);const robots=await fetchPage(u.origin+'/robots.txt',180000);
if(robots.status!==404&&robots.status!==410&&(robots.status!==200||!robotsAllows(robots.text,u.pathname+u.search)))return {status:'blocked',message:'来源不允许自动收集或访问受限，保留原站入口',links:[]};
const page=await fetchPage(source.url);if(page.status!==200)throw new Error('来源暂不可访问（'+page.status+'）');
if(source.id==='official'){const title=plain(page.text.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]||'');if(!/公务员.*大纲|公共科目笔试考试大纲/.test(title))throw new Error('页面内容变化，待人工核对');return {status:'ok',message:'已检查官方大纲入口',links:[{title:title.slice(0,120),url:source.url}]};}
const links=extractLinks(page.text,source);return {status:links.length?'ok':'empty',message:links.length?'已检查 '+links.length+' 个相关条目':'未发现可识别的公开条目，可能需要登录或页面发生变化',links};
}
