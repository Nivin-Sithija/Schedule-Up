import { clientChannel } from './channels.js';
import { initTelegram,closeTelegram,telegramStatus,startTelegram,telegramPassword,disconnectTelegram,telegramDialogs,allowTelegramClient,telegramConfigured } from './telegram.js';
import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import { withWorkspace } from './tenant.js';
import { initAuthStore } from './auth-store.js';
import { registrationSchema, emailSchema, passwordSchema, register, authenticate, newSession, sessionUser, revokeSession, changePassword, rateLimit, userForSession } from './auth.js';
import staticPlugin from '@fastify/static';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { config } from './config.js';
import { initStore, createWorkspace, getState, mutate, closeStore } from './store.js';
import { initRetrieval } from './retrieval.js';
import { initRuntime, resumeWorkspace, ingest, retry, enqueueSend, closeRuntime } from './runtime.js';
import { makeDraft, immediateSend } from './service.js';
import { normalizeResolvedEvent, validSignature, waha, startConnection, verifyBusinessAccount, pairingQr, connectionStatus, activeSession } from './connector.js';
import { captureError } from './telemetry.js';
import { runWorker } from './worker.js';
import { workspaceSetupSchema, applyWorkspaceSetup, phoneSchema } from './workspace-settings.js';
import { templateSchema } from './template-validation.js';
import { emptyState, deadlineSchema } from './domain.js';
await initStore(); await initAuthStore(); await initRetrieval(); await initRuntime();await initTelegram();
const app = Fastify({ logger: { redact: ['req.headers.cookie','req.headers.authorization','req.body'] }, bodyLimit: 65536 });
await app.register(cookie);
const publicRoutes=new Set(['/api/health','/api/auth/register','/api/auth/login','/api/auth/me','/api/demo','/api/webhooks/waha']);
app.addHook('onRequest',async(req,reply)=>{
  if(!req.url.startsWith('/api'))return;
  reply.header('Cache-Control','no-store');
  const user=await sessionUser(req.cookies.ft_session);(req as any).account=user;
  if(!publicRoutes.has(req.url.split('?')[0])&&!user)return reply.code(401).send({error:'Please sign in to continue'});
});
app.addHook('onRoute',route=>{
  const handler=route.handler;
  route.handler=function(req,reply){const user=(req as any).account;return user?withWorkspace(user.id,()=>handler.call(this,req,reply)):handler.call(this,req,reply);};
});
function setSession(reply:any,token:string){reply.setCookie('ft_session',token,{path:'/',httpOnly:true,sameSite:'strict',secure:config.hosted,maxAge:7*86400});}
app.removeContentTypeParser('application/json');
app.addContentTypeParser('application/json',{parseAs:'string'},(req,body,done)=>{ (req as any).rawBody=body; try { done(null,JSON.parse(body as string)); } catch { done(new Error('Invalid JSON')); } });
app.addHook('preHandler',async(req,reply)=>{
  if(['POST','PUT','PATCH','DELETE'].includes(req.method) && req.url.startsWith('/api') && req.url!=='/api/webhooks/waha') {
    if(req.headers['x-followthrough']!=='dashboard') return reply.code(403).send({error:'Dashboard request header required'});
    const origin = req.headers.origin;
    const allowed = (process.env.APP_ORIGINS || 'http://localhost:5173,http://127.0.0.1:5173,http://localhost:3001,http://127.0.0.1:3001').split(',');
    if(origin && !allowed.includes(origin)) return reply.code(403).send({error:'Untrusted origin'});
  }
});
app.setErrorHandler((error:any,_req,reply)=> { if(error instanceof z.ZodError) return reply.code(400).send({error:'Invalid request',details:error.issues.map(x=>x.message)}); captureError(error); return reply.code(error.statusCode || 400).send({error:error.message || 'Request failed'}); });
app.get('/api/health',async()=>({ok:true}));
app.post('/api/auth/register',async(req,reply)=>{
  await rateLimit(`register:${req.ip}`,5);
  const input=registrationSchema.parse(req.body),user=await register(input);
  await withWorkspace(user.id,async()=>{await createWorkspace();await resumeWorkspace();});
  setSession(reply,await newSession(user.id));return {user};
});
app.post('/api/auth/login',async(req,reply)=>{
  await rateLimit(`login-ip:${req.ip}`,30);
  const input=z.object({email:emailSchema,password:z.string().min(1).max(128)}).parse(req.body);
  await rateLimit(`login-email:${input.email}`,10);
  const user=await authenticate(input.email,input.password);
  await withWorkspace(user.id,createWorkspace);
  await revokeSession(req.cookies.ft_session);setSession(reply,await newSession(user.id));return {user};
});
app.get('/api/auth/me',async(req)=>({user:(req as any).account}));
app.post('/api/auth/logout',async(req,reply)=>{await revokeSession(req.cookies.ft_session);reply.clearCookie('ft_session',{path:'/'});return {ok:true};});
app.post('/api/auth/password',async(req,reply)=>{
  await rateLimit(`password:${(req as any).account.id}`,5);
  const input=z.object({currentPassword:z.string().min(1).max(128),password:passwordSchema}).parse(req.body);
  await changePassword((req as any).account.id,input.currentPassword,input.password);
  setSession(reply,await newSession((req as any).account.id));return {ok:true};
});
app.get('/api/state',async(req)=>({ user:(req as any).account, ...(await getState()), config:{provider:config.AI_PROVIDER,model:config.AI_PROVIDER==='ollama'?config.OLLAMA_MODEL:config.OPENROUTER_MODEL,whatsapp:config.WHATSAPP_PROVIDER,telegram:telegramConfigured(),durability:config.DURABLE_MODE,timezone:config.APP_TIMEZONE,localOnly:!config.hosted} }));
app.put('/api/setup',async(req)=>{
  const input=workspaceSetupSchema.parse(req.body), before=await getState();
  if(config.WHATSAPP_PROVIDER==='waha' && before.settings?.ownerPhone && before.settings.ownerPhone!==input.ownerPhone) {
    const result=await connectionStatus();
    if(!['STOPPED','FAILED','SETUP_REQUIRED'].includes(result.status))throw new Error('Disconnect WhatsApp before changing the owner number.');
  }
  await mutate(s=>applyWorkspaceSetup(s,input));return {ok:true};
});
app.post('/api/clients',async(req)=>{
  const input=z.object({name:z.string().trim().min(1).max(100),phone:phoneSchema}).parse(req.body);
  return mutate(s=>{
    if(!s.settings?.ownerPhone)throw new Error('Save your WhatsApp number in Settings first.');
    const chatId=`${input.phone.slice(1)}@c.us`;
    if(s.clients.some(c=>clientChannel(c)==='whatsapp'&&c.chatId===chatId&&c.enabled!==false))throw new Error('This client number is already allowed.');
    const clients=s.clients.filter(c=>c.enabled!==false&&clientChannel(c)==='whatsapp').map(c=>({name:c.name,phone:'+'+c.chatId.split('@')[0]}));
    applyWorkspaceSetup(s,workspaceSetupSchema.parse({ownerPhone:s.settings.ownerPhone,clients:[...clients,input]}));
    return s.clients.find(c=>clientChannel(c)==='whatsapp'&&c.chatId===chatId);
  });
});
app.delete('/api/clients/:id',async(req)=>mutate(s=>{
  const client=s.clients.find(c=>c.id===(req.params as any).id);if(!client)throw new Error('Client missing');
  client.enabled=false;
  for(const item of s.schedules)if(item.clientId===client.id&&item.status==='approved'){item.status='paused';item.error='Client removed from allowed numbers.';}
  return {ok:true};
}));
app.get('/api/telegram/connection',async()=>telegramStatus());
app.put('/api/telegram/setup',async(req)=>{
  const input=z.object({ownerPhone:phoneSchema}).parse(req.body),connection=await telegramStatus();
  if(!['DISCONNECTED','FAILED','OWNER_MISMATCH'].includes(connection.status))throw new Error('Disconnect Telegram before changing its owner number.');
  await mutate(s=>{if(!s.settings)s.settings={ownerPhone:input.ownerPhone};s.settings.telegramOwnerPhone=input.ownerPhone;});return {ok:true};
});
app.post('/api/telegram/connect',async(req)=>{await rateLimit(`telegram-connect:${(req as any).account.id}`,15);return startTelegram();});
app.post('/api/telegram/password',async(req)=>{await rateLimit(`telegram-password:${(req as any).account.id}`,5);const input=z.object({password:z.string().min(1).max(256)}).parse(req.body);return telegramPassword(input.password);});
app.post('/api/telegram/disconnect',async()=>disconnectTelegram());
app.get('/api/telegram/dialogs',async()=>({dialogs:await telegramDialogs()}));
app.post('/api/telegram/clients',async(req)=>{const input=z.object({peerId:z.string().regex(/^\d+$/)}).parse(req.body);return allowTelegramClient(input.peerId);});
app.get('/api/demo',async()=>{const s=emptyState([{id:'demo-alex',name:'Alex Morgan',chatId:'demo'},{id:'demo-sam',name:'Sam Rivera',chatId:'123456789',channel:'telegram'}]); s.messages=[{id:'example-1',clientId:'demo-alex',speaker:'client',text:'Could you send the revised proposal Friday?',sentAt:'2026-10-13T08:00:00Z',origin:'mock'},{id:'example-2',clientId:'demo-alex',speaker:'owner',text:'Yes, I’ll send it Friday morning.',sentAt:'2026-10-13T08:01:00Z',origin:'mock'}];s.messages.push({id:'example-telegram',clientId:'demo-sam',channel:'telegram',speaker:'owner',text:'I will send the logo artwork on Saturday.',sentAt:'2026-10-13T08:02:00Z',origin:'mock'});s.tasks=[{id:'example-telegram-task',clientId:'demo-sam',channel:'telegram',title:'Send logo artwork',responsible:'owner',status:'open',due:'2026-10-17',evidence:['example-telegram'],revision:1,manual:false,updatedAt:'2026-10-13T08:02:00Z'},{id:'example-task',clientId:'demo-alex',title:'Send revised proposal',responsible:'owner',status:'open',due:'2026-10-16',evidence:['example-1','example-2'],revision:1,manual:false,updatedAt:'2026-10-13T08:01:00Z'}];return {...s,config:{provider:'simulated',model:'Read-only example',whatsapp:'mock',durability:'simulated',timezone:config.APP_TIMEZONE,localOnly:true}};});
app.post('/api/mock/messages',async(req)=>{
  if(config.WHATSAPP_PROVIDER!=='mock') throw new Error('Simulator is disabled on the connected account');
  const body=z.object({clientId:z.string(),speaker:z.enum(['owner','client']),text:z.string().trim().min(1).max(4000)}).parse(req.body);
  const s=await getState(); if(!s.clients.some(c=>c.id===body.clientId)) throw new Error('Unknown client');
  await ingest({...body,id:`mock:${randomUUID()}`,sentAt:new Date().toISOString(),origin:'mock'});return {accepted:true};
});
app.post('/api/webhooks/waha',async(req,reply)=>{
  if(config.WHATSAPP_PROVIDER!=='waha' || !validSignature((req as any).rawBody,req.headers['x-webhook-hmac'] as string,req.headers['x-webhook-hmac-algorithm'] as string)) return reply.code(403).send({error:'Invalid webhook signature'});
  const event=z.object({event:z.string(),payload:z.any(),session:z.string().optional()}).parse(req.body);
  if(!event.session)return reply.code(400).send({error:'Session required'});
  const user=await userForSession(event.session);if(!user)return {accepted:false};
  return withWorkspace(user.id,async()=>{
  if (['message','message.any'].includes(event.event)) await verifyBusinessAccount();
  const s=await getState(); const message=await normalizeResolvedEvent(event,s.clients.filter(c=>c.enabled!==false&&clientChannel(c)==='whatsapp')); if(message) await ingest(message);
  if(event.event==='session.status') await mutate(s=>{s.connection=String(event.payload?.status || 'unknown');});
  if(event.event==='message.ack') await mutate(s=>{const id=`waha:${activeSession()}:${event.payload?.id}`;const m=s.messages.find(m=>m.id===id);if(m) m.status=String(event.payload?.ackName || 'sent').toLowerCase();});
  return {accepted:true};
  });
});
app.get('/api/connection',async()=>{if(config.WHATSAPP_PROVIDER==='mock')return {status:'simulated'};const result=await connectionStatus();const state=await getState();if(state.connection!==result.status)await mutate(s=>{s.connection=result.status;});return result;});
app.get('/api/connection/qr',async()=>{if(config.WHATSAPP_PROVIDER==='mock') return {simulated:true};return pairingQr();});
app.post('/api/connection/start',async()=>{if(config.WHATSAPP_PROVIDER==='mock')return {status:'simulated'};return startConnection();});
app.post('/api/connection/logout',async()=>{if(config.WHATSAPP_PROVIDER==='mock')return {status:'simulated'};return waha(`/api/sessions/${encodeURIComponent(activeSession())}/logout`,'POST');});
app.post('/api/clients/:id/retry',async(req)=>{await retry((req.params as any).id);return {accepted:true};});
app.post('/api/drafts',async(req)=>{const b=z.object({clientId:z.string(),instruction:z.string().min(1).max(1000),template:z.string().max(2000).optional()}).parse(req.body); if(!(await getState()).clients.some(c=>c.id===b.clientId))throw new Error('Unknown client');return {text:await makeDraft(b.clientId,b.instruction,b.template)};});
app.post('/api/send',async(req)=>{const b=z.object({clientId:z.string(),text:z.string().trim().min(1).max(4000),requestId:z.string().uuid()}).parse(req.body);const m=await immediateSend(b.clientId,b.text,b.requestId);await retry(b.clientId);return {message:m};});
app.post('/api/tasks',async(req)=>{const b=z.object({clientId:z.string(),title:z.string().trim().min(1).max(200),due:deadlineSchema.default(null),responsible:z.enum(['owner','client']).default('owner')}).parse(req.body);return mutate(s=>{if(!s.clients.some(c=>c.id===b.clientId&&c.enabled!==false))throw new Error('Client is not allowed');const t={...b,id:randomUUID(),channel:clientChannel(s.clients.find(c=>c.id===b.clientId)),status:b.responsible==='client'?'waiting' as const:'open' as const,evidence:[],revision:1,manual:true,updatedAt:new Date().toISOString()};s.tasks.push(t);return t;});});
app.patch('/api/tasks/:id',async(req)=>{const b=z.object({revision:z.number(),title:z.string().min(1).max(200).optional(),due:deadlineSchema.optional(),status:z.enum(['review','open','waiting','completed','cancelled']).optional()}).parse(req.body);return mutate(s=>{const t=s.tasks.find(t=>t.id===(req.params as any).id);if(!t || t.revision!==b.revision)throw new Error('Task changed; refresh before editing');Object.assign(t,b,{revision:t.revision+1,manual:true,updatedAt:new Date().toISOString()});for(const x of s.schedules)if(x.taskId===t.id&&x.status==='approved'){x.status=t.status==='cancelled'?'cancelled':'paused';x.error='Task changed.';}return t;});});
app.post('/api/proposals/:id/:action',async(req)=>mutate(s=>{const {id,action}=req.params as any; const p=s.proposals.find(p=>p.id===id);if(!p)throw new Error('Proposal missing');if(!['approve','reject'].includes(action))throw new Error('Unknown action');if(action==='approve'){const c=p.change;const t=s.tasks.find(t=>t.id===c.taskId);if(c.action==='create')s.tasks.push({id:randomUUID(),clientId:p.clientId,channel:clientChannel(s.clients.find(c=>c.id===p.clientId)),title:c.title,responsible:c.responsible,status:c.responsible==='client'?'waiting':'open',due:c.due,evidence:c.evidence,revision:1,manual:true,updatedAt:new Date().toISOString()});else if(t){Object.assign(t,{title:c.title,due:c.due,evidence:c.evidence,status:c.action==='complete'?'completed':c.action==='cancel'?'cancelled':c.responsible==='client'?'waiting':'open',revision:t.revision+1,manual:true,updatedAt:new Date().toISOString()});for(const x of s.schedules)if(x.taskId===t.id&&x.status==='approved')x.status='paused';}}s.proposals=s.proposals.filter(p=>p.id!==id);return {ok:true};}));
app.post('/api/schedules',async(req)=>{const b=z.object({id:z.string().uuid(),taskId:z.string(),text:z.string().trim().min(1).max(4000),at:z.string().datetime({offset:true}),taskRevision:z.number()}).parse(req.body);if(Date.parse(b.at)<=Date.now())throw new Error('Choose a future time');const item=await mutate(s=>{const t=s.tasks.find(t=>t.id===b.taskId);if(!t||t.revision!==b.taskRevision||['completed','cancelled'].includes(t.status))throw new Error('Task changed or closed');if(s.schedules.some(x=>x.id===b.id))throw new Error('Schedule already exists');const item={...b,clientId:t.clientId,approvedSeq:s.sequence[t.clientId]||0,status:'approved' as const};s.schedules.push(item);return item;});await enqueueSend(item.id,item.at);return item;});
app.post('/api/schedules/:id/cancel',async(req)=>mutate(s=>{const x=s.schedules.find(x=>x.id===(req.params as any).id);if(!x||['sending','sent','uncertain'].includes(x.status))throw new Error('Cannot cancel this send');x.status='cancelled';return x;}));
app.post('/api/templates',async(req)=>{const b=templateSchema.parse(req.body);return mutate(s=>{const t={...b,id:randomUUID()};s.templates.push(t);return t;});});
app.post('/api/notifications/read',async()=>mutate(s=>{s.notifications.forEach(n=>n.read=true);return {ok:true};}));
app.patch('/api/templates/:id',async(req)=>{const body=templateSchema.parse(req.body);return mutate(s=>{const template=s.templates.find(t=>t.id===(req.params as any).id);if(!template)throw new Error('Template missing');Object.assign(template,body);return template;});});
if(existsSync(resolve('dist'))) {await app.register(staticPlugin,{root:resolve('dist')});app.setNotFoundHandler((req,reply)=>req.url.startsWith('/api')?reply.code(404).send({error:'Not found'}):reply.sendFile('index.html'));}
app.addHook('onClose',async()=>{await closeTelegram();await closeRuntime();await closeStore();});
process.once('SIGTERM',()=>void app.close());process.once('SIGINT',()=>void app.close());
await app.listen({port:config.PORT,host:config.HOST});
if (config.DURABLE_MODE === 'temporal') void runWorker().catch(e => { captureError(e); process.exitCode=1; void app.close(); });
