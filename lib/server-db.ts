import {env} from 'cloudflare:workers'; export function db(){if(!env.DB)throw new Error('学习记录暂时无法连接，请稍后再试');return env.DB;}
export function response(data:unknown,status=200){return Response.json(data,{status,headers:{'Cache-Control':'no-store'}})}
export function safeRequest(request:Request){const origin=request.headers.get('origin');if(origin&&new URL(origin).host!==new URL(request.url).host)throw new Error('请求来源不匹配');}

