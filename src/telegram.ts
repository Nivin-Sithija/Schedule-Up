import { TelegramClient, Api } from 'telegram';
import { StringSession } from 'telegram/sessions/index.js';
import { NewMessage } from 'telegram/events/index.js';
import { Logger, LogLevel } from 'telegram/extensions/Logger.js';
import bigInt from 'big-integer';
import QRCode from 'qrcode';
import { randomUUID } from 'node:crypto';
import { config } from './config.js';
import { getState, mutate, listWorkspaces } from './store.js';
import { workspaceId, withWorkspace } from './tenant.js';
import { readTelegramSession, saveTelegramSession, clearTelegramSession, initSessionSecrets, ensureSessionEncryption } from './session-secrets.js';
import { normalizeTelegram } from './telegram-normalize.js';
import { clientChannel } from './channels.js';
import type { Client } from './domain.js';
import { ingest } from './runtime.js';
import { captureError } from './telemetry.js';

type Phase='CONNECTING'|'SCAN_QR_CODE'|'PASSWORD_REQUIRED'|'WORKING'|'DISCONNECTED'|'FAILED'|'OWNER_MISMATCH';
type Link={client:TelegramClient;status:Phase;qr?:string;expires?:number;error?:string;userId?:string;timer?:ReturnType<typeof setTimeout>;busy?:Promise<void>;attached?:boolean;started:number;passwordAttempts:number};
let bridgeStarted=false,closing=false;
async function bounded<T>(promise:Promise<T>,ms=20000):Promise<T>{let timer:ReturnType<typeof setTimeout>|undefined;try{return await Promise.race([promise,new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(new Error('Telegram request timed out')),ms);})]);}finally{if(timer)clearTimeout(timer);}}
const links=new Map<string,Link>(),opening=new Map<string,Promise<Link>>();
export const telegramConfigured=()=>!!config.TELEGRAM_API_ID&&/^[a-f\d]{32}$/i.test(config.TELEGRAM_API_HASH);
function required(){if(!telegramConfigured())throw new Error('Configure TELEGRAM_API_ID and TELEGRAM_API_HASH on the server first.');}
function peer(id:string){if(!/^\d+$/.test(id))throw new Error('Invalid Telegram user');return new Api.PeerUser({userId:bigInt(id)});}
async function expectedPhone(){const settings=(await getState()).settings;const phone=settings?.telegramOwnerPhone||settings?.ownerPhone;if(!phone)throw new Error('Save your owner phone number in Settings first.');return phone.replace(/\D/g,'');}
function messageText(message:Api.Message){return {peerId:message.peerId instanceof Api.PeerUser?message.peerId.userId.toString():'',id:message.id,out:!!message.out,text:message.message||'',date:message.date,private:message.peerId instanceof Api.PeerUser};}
async function acceptMessage(tenant:string,message:Api.Message){await withWorkspace(tenant,async()=>{const state=await getState();const normalized=normalizeTelegram(messageText(message),state.clients,tenant);if(normalized)await ingest(normalized);});}
async function connected(link:Link){
  if(closing||links.get(workspaceId())!==link)throw new Error('Telegram pairing cancelled');
  const me=await link.client.getMe();
  if(!(me instanceof Api.User)||me.bot||String(me.phone||'').replace(/\D/g,'')!==await expectedPhone()){
    link.status='OWNER_MISMATCH';link.error='Linked Telegram account does not match your saved Telegram number.';
    await link.client.invoke(new Api.auth.LogOut()).catch(()=>{});await clearTelegramSession();await link.client.destroy();throw new Error(link.error);
  }
  await mutate(s=>{s.settings={...s.settings!,telegramOwnerPhone:'+'+me.phone};});
  link.userId=me.id.toString();link.status='WORKING';link.qr=undefined;link.error=undefined;
  await saveTelegramSession(String(link.client.session.save()));
  const tenant=workspaceId();
  if(!link.attached){link.attached=true;link.client.addEventHandler(async event=>{try{if(event.message instanceof Api.Message)await acceptMessage(tenant,event.message);}catch(error){captureError(error);}},new NewMessage({}));}
  // Prime input-entity/access-hash caches; these are required for safe replies after restart.
  await link.client.getDialogs({limit:100});
}
async function advance(link:Link,force=false){
  if(link.busy)return link.busy;
  link.busy=(async()=>{
    if(!['CONNECTING','SCAN_QR_CODE'].includes(link.status)||closing||links.get(workspaceId())!==link)return;
    if(!force&&link.qr&&link.expires&&link.expires>Math.floor(Date.now()/1000)+2)return;
    if(Date.now()-link.started>5*60_000){link.status='FAILED';link.error='Telegram pairing expired. Start again.';await link.client.destroy();return;}
    try{
      let result=await link.client.invoke(new Api.auth.ExportLoginToken({apiId:config.TELEGRAM_API_ID,apiHash:config.TELEGRAM_API_HASH,exceptIds:[]}));
      if(result instanceof Api.auth.LoginTokenMigrateTo){await (link.client as any)._switchDC(result.dcId);result=await link.client.invoke(new Api.auth.ImportLoginToken({token:result.token}));}
      if(result instanceof Api.auth.LoginTokenSuccess){await connected(link);return;}
      if(result instanceof Api.auth.LoginToken){link.status='SCAN_QR_CODE';link.expires=result.expires;link.qr=await QRCode.toDataURL(`tg://login?token=${result.token.toString('base64url')}`,{width:260,margin:2});}
    }catch(error:any){if(error.errorMessage==='SESSION_PASSWORD_NEEDED'){link.status='PASSWORD_REQUIRED';link.qr=undefined;return;}if(link.status!=='OWNER_MISMATCH'){link.status='FAILED';link.error='Telegram pairing failed. Try again.';}captureError(new Error('Telegram pairing failed'));await link.client.destroy().catch(()=>{});}
  })().finally(()=>{link.busy=undefined;});return link.busy;
}
function schedule(link:Link,tenant:string){
  if(!['CONNECTING','SCAN_QR_CODE'].includes(link.status))return;
  link.timer=setTimeout(()=>{void withWorkspace(tenant,async()=>{await advance(link);schedule(link,tenant);}).catch(captureError);},3000);
}
async function open(){
  required();if(closing)throw new Error('Telegram is shutting down');const tenant=workspaceId(),old=links.get(tenant);if(old&&['WORKING','SCAN_QR_CODE','PASSWORD_REQUIRED','CONNECTING'].includes(old.status))return old;
  if(opening.has(tenant))return opening.get(tenant)!;
  const work=(async()=>{
    await expectedPhone();if(old){if(old.timer)clearTimeout(old.timer);await old.client.destroy().catch(()=>{});}
    const session=await readTelegramSession(),client=new TelegramClient(new StringSession(session),config.TELEGRAM_API_ID,config.TELEGRAM_API_HASH,{connectionRetries:3,requestRetries:1,floodSleepThreshold:0,baseLogger:new Logger(LogLevel.NONE),deviceModel:'FollowThrough',appVersion:'0.1.0'});
    const link:Link={client,status:'CONNECTING',started:Date.now(),passwordAttempts:0};links.set(tenant,link);
    client.addEventHandler(async update=>{if(update instanceof Api.UpdateLoginToken)await withWorkspace(tenant,()=>advance(link,true));});
    try{await bounded(client.connect());if(await bounded(client.checkAuthorization())){await connected(link);return link;}await advance(link);schedule(link,tenant);return link;}
    catch(error){if(link.status!=='OWNER_MISMATCH'){link.status='FAILED';link.error='Could not connect to Telegram. Try again.';}await client.destroy().catch(()=>{});throw new Error(link.error);}
  })().finally(()=>opening.delete(tenant));opening.set(tenant,work);return work;
}
function publicStatus(link?:Link){return {configured:telegramConfigured(),status:link?.status==='WORKING'&&!link.client.connected?'CONNECTING':link?.status||'DISCONNECTED',qr:link?.qr,expires:link?.expires,error:link?.error};}
export async function telegramStatus(){return publicStatus(links.get(workspaceId()));}
export async function startTelegram(){return publicStatus(await open());}
export async function telegramPassword(password:string){
  const link=links.get(workspaceId());if(!link||link.status!=='PASSWORD_REQUIRED')throw new Error('Telegram is not waiting for a password.');
  if(link.passwordAttempts++>=5)throw new Error('Too many Telegram password attempts. Disconnect and start again.');
  try{await link.client.signInWithPassword({apiId:config.TELEGRAM_API_ID,apiHash:config.TELEGRAM_API_HASH},{password:async()=>password,onError:async()=>true});await connected(link);return publicStatus(link);}
  catch(error){if((link as Link).status==='OWNER_MISMATCH')throw error;throw new Error('Telegram password was not accepted. Try again.');}
}
export async function disconnectTelegram(){
  const tenant=workspaceId(),link=links.get(tenant);links.delete(tenant);if(link?.timer)clearTimeout(link.timer);
  if(link){link.status='DISCONNECTED';await link.busy?.catch(()=>{});if(await link.client.checkAuthorization().catch(()=>false))await link.client.invoke(new Api.auth.LogOut());await link.client.destroy();}
  await clearTelegramSession();await mutate(s=>{for(const item of s.schedules)if(item.status==='approved'&&clientChannel(s.clients.find(c=>c.id===item.clientId))==='telegram'){item.status='paused';item.error='Telegram disconnected.';}});return {ok:true};
}

async function working(){if(!bridgeStarted)throw new Error('Telegram sends require the embedded API worker.');const link=await open();if(link.status!=='WORKING'||!link.client.connected)throw new Error('Connect your Telegram account in Settings first.');await expectedPhone();return link;}
export async function telegramDialogs(){const link=await working(),dialogs=await link.client.getDialogs({limit:100});return dialogs.filter(d=>d.entity instanceof Api.User&&!d.entity.bot&&!d.entity.self&&!!d.entity.accessHash).map(d=>{const user=d.entity as Api.User;return {peerId:user.id.toString(),name:[user.firstName,user.lastName].filter(Boolean).join(' ')||user.username||'Telegram contact',phone:user.phone?'+'+user.phone:undefined,username:user.username};});}
export async function allowTelegramClient(peerId:string){
  const dialog=(await telegramDialogs()).find(d=>d.peerId===peerId);if(!dialog)throw new Error('Select a private Telegram conversation from your connected account.');
  return mutate(s=>{const existing=s.clients.find(c=>clientChannel(c)==='telegram'&&c.chatId===peerId);if(existing?.enabled!==false&&existing)throw new Error('This Telegram conversation is already allowed.');if(existing){existing.enabled=true;existing.name=dialog.name;existing.phone=dialog.phone;return existing;}const client:Client={id:randomUUID(),name:dialog.name,chatId:peerId,channel:'telegram',phone:dialog.phone,enabled:true};s.clients.push(client);return client;});
}
export async function sendTelegram(client:Client,text:string){const link=await working();const result=await bounded(link.client.sendMessage(peer(client.chatId),{message:text,parseMode:undefined,linkPreview:false}));if(!result.id)throw new Error('Telegram send outcome unknown');return `telegram:${workspaceId()}:${client.chatId}:${result.id}`;}
async function catchUp(link:Link){
  const state=await getState(),tenant=workspaceId();
  for(const client of state.clients.filter(c=>clientChannel(c)==='telegram'&&c.enabled!==false)){
    const prefix=`telegram:${tenant}:${client.chatId}:`,ids=state.messages.filter(m=>m.clientId===client.id&&m.id.startsWith(prefix)).map(m=>Number(m.id.slice(prefix.length))),last=Math.max(0,...ids);
    if(!last)continue;
    const messages=await link.client.getMessages(peer(client.chatId),{limit:100,minId:last});
    for(const message of [...messages].reverse())if(message instanceof Api.Message)await acceptMessage(tenant,message);
  }
}
export async function initTelegram(){
  bridgeStarted=true;closing=false;await initSessionSecrets();if(!telegramConfigured())return;await ensureSessionEncryption();
  for(const tenant of await listWorkspaces())void withWorkspace(tenant,async()=>{if(!await readTelegramSession())return;try{const link=await open();if(link.status==='WORKING')await catchUp(link);}catch{captureError(new Error('Telegram session restore failed'));}}).catch(()=>captureError(new Error('Telegram session restore failed')));
}
export async function closeTelegram(){closing=true;for(const link of links.values()){if(link.timer)clearTimeout(link.timer);await link.client.destroy().catch(()=>{});}links.clear();}
