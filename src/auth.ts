import { randomBytes, randomUUID, scrypt, timingSafeEqual, createHash } from 'node:crypto';
import { z } from 'zod';
import { readAuth, updateAuth, type User } from './auth-store.js';
export const emailSchema=z.string().trim().toLowerCase().email().max(254);
const common=new Set(['passwordpassword','123456789012345','password123456789','qwertyuiopasdfgh','followthrough123']);
export const passwordSchema=z.string().min(15,'Use at least 15 characters').max(128,'Use at most 128 characters').refine(p=>!common.has(p.toLowerCase()),'Choose a less common password');
export const registrationSchema=z.object({name:z.string().trim().min(1).max(100),email:emailSchema,password:passwordSchema});
const digest=(token:string)=>createHash('sha256').update(token).digest('hex');
// Serialize memory-hard hashing to keep concurrent requests from exhausting the host.
let hashing:Promise<unknown>=Promise.resolve();
function derive(password:string,salt:string):Promise<Buffer>{
  const work=hashing.then(()=>new Promise<Buffer>((resolve,reject)=>scrypt(password,salt,64,{N:131072,r:8,p:1,maxmem:192*1024*1024},(error,key)=>error?reject(error):resolve(key))));hashing=work.catch(()=>{});return work;
}
export async function hashPassword(password:string){const salt=randomBytes(16).toString('hex');return `scrypt$131072$8$1$${salt}$${(await derive(password,salt)).toString('hex')}`;}
export async function verifyPassword(password:string,stored:string){const parts=stored.split('$');if(parts.length!==6||parts.slice(0,4).join('$')!=='scrypt$131072$8$1')return false;const expected=Buffer.from(parts[5],'hex'),actual=await derive(password,parts[4]);return expected.length===actual.length&&timingSafeEqual(expected,actual);}
export const publicUser=(user:User)=>({id:user.id,name:user.name,email:user.email});
export async function rateLimit(key:string,max=10){await updateAuth(data=>{const now=Date.now();for(const [id,value] of Object.entries(data.limits))if(value.until<now)delete data.limits[id];if(Object.keys(data.limits).length>=5000&&!data.limits[key])throw new Error('Sign-in temporarily busy');const value=data.limits[key]||{count:0,until:now+15*60_000};value.count++;data.limits[key]=value;if(value.count>max)return false;return true;}).then(ok=>{if(!ok){const error=new Error('Too many attempts. Try again in 15 minutes.');(error as any).statusCode=429;throw error;}});}
export async function register(input:z.infer<typeof registrationSchema>){
  const passwordHash=await hashPassword(input.password);
  return updateAuth(data=>{if(data.users.some(u=>u.email===input.email))throw new Error('Account could not be created. Try signing in or use another email.');const user={id:randomUUID(),name:input.name,email:input.email,passwordHash,createdAt:new Date().toISOString()};data.users.push(user);return publicUser(user);});
}
export async function authenticate(email:string,password:string){
  const user=(await readAuth()).users.find(u=>u.email===email);
  const valid=await verifyPassword(password,user?.passwordHash||`scrypt$131072$8$1$${'0'.repeat(32)}$${'0'.repeat(128)}`);
  if(!user||!valid){const error=new Error('Email or password is incorrect');(error as any).statusCode=401;throw error;}return publicUser(user);
}
export async function newSession(userId:string){const token=randomBytes(32).toString('base64url');await updateAuth(data=>{data.sessions=data.sessions.filter(s=>s.expires>Date.now()&&s.lastSeen>Date.now()-24*3600_000);data.sessions.push({hash:digest(token),userId,expires:Date.now()+7*86400_000,lastSeen:Date.now()});const own=data.sessions.filter(s=>s.userId===userId);if(own.length>10){const remove=new Set(own.slice(0,-10).map(s=>s.hash));data.sessions=data.sessions.filter(s=>!remove.has(s.hash));}});return token;}
export async function sessionUser(token?:string){if(!token||!/^[\w-]{43}$/.test(token))return null;const data=await readAuth(),session=data.sessions.find(s=>s.hash===digest(token)&&s.expires>Date.now()&&s.lastSeen>Date.now()-24*3600_000);if(!session)return null;const user=data.users.find(u=>u.id===session.userId);if(!user)return null;if(session.lastSeen<Date.now()-30*60_000)await updateAuth(data=>{const existing=data.sessions.find(s=>s.hash===session.hash);if(existing)existing.lastSeen=Date.now();});return publicUser(user);}
export async function revokeSession(token?:string){if(token)await updateAuth(data=>{data.sessions=data.sessions.filter(s=>s.hash!==digest(token));});}
export async function changePassword(userId:string,current:string,password:string){const user=(await readAuth()).users.find(u=>u.id===userId);if(!user||!await verifyPassword(current,user.passwordHash))throw new Error('Current password is incorrect');const passwordHash=await hashPassword(password);await updateAuth(data=>{const existing=data.users.find(u=>u.id===userId)!;if(existing.passwordHash!==user.passwordHash)throw new Error('Password changed; sign in again');existing.passwordHash=passwordHash;data.sessions=data.sessions.filter(s=>s.userId!==userId);});}
export async function userForSession(session:string){return (await readAuth()).users.find(u=>`ft-${u.id}`===session);}
