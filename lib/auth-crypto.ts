import {randomBytes,createHash,scrypt,timingSafeEqual} from 'node:crypto';
import {Buffer} from 'node:buffer';
export function digest(value:string){return createHash('sha256').update(value).digest('hex')}
export function newToken(){return randomBytes(32).toString('base64url')}
export function newInvite(){return 'RR-'+randomBytes(16).toString('hex').toUpperCase().match(/.{1,4}/g)!.join('-')}
export function normalizeInvite(value:string){return value.replace(/[\s-]/g,'').toUpperCase()}
export function validPassword(value:unknown):value is string{return typeof value==='string'&&value.length>=10&&value.length<=128}
export function normalizeUsername(value:unknown){return typeof value==='string'?value.trim().toLowerCase():''}
export function validUsername(value:string){return /^[a-z0-9_]{3,24}$/.test(value)}
function derive(password:string,salt:string){return new Promise<Buffer>((resolve,reject)=>scrypt(password,salt,32,{N:16384,r:8,p:5,maxmem:32*1024*1024},(error,key)=>error?reject(error):resolve(key)))}
export async function hashPassword(password:string){const salt=randomBytes(16).toString('hex');return 'scrypt$16384$8$5$'+salt+'$'+(await derive(password,salt)).toString('hex')}
const DUMMY='scrypt$16384$8$5$'+'0'.repeat(32)+'$'+'0'.repeat(64);
export async function verifyPassword(password:string,stored:string|null){const parts=(stored||DUMMY).split('$');if(parts.length!==6||parts.slice(0,4).join('$')!=='scrypt$16384$8$5'||!/^[a-f0-9]{32}$/.test(parts[4])||!/^[a-f0-9]{64}$/.test(parts[5]))return false;const actual=await derive(password,parts[4]);return timingSafeEqual(actual,Buffer.from(parts[5],'hex'))&&stored!==null}

