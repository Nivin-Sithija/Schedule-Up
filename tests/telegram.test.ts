import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { normalizeTelegram } from '../src/telegram-normalize.js';
import { sealSession,openSession } from '../src/session-secrets.js';
import { applyWorkspaceSetup,workspaceSetupSchema } from '../src/workspace-settings.js';
import { emptyState } from '../src/domain.js';
import { clientChannel } from '../src/channels.js';
const clients=[{id:'wa',name:'WhatsApp',chatId:'123',channel:'whatsapp' as const},{id:'tg',name:'Telegram',chatId:'123',channel:'telegram' as const},{id:'disabled',name:'Removed',chatId:'456',channel:'telegram' as const,enabled:false}];
const message={peerId:'123',id:10,out:false,text:'Send the proposal tomorrow',date:1792022400,private:true};
test('Telegram normalizer isolates provider peers, message IDs and owner/client direction',()=>{
  const inbound=normalizeTelegram(message,clients,'account-a')!;assert.equal(inbound.clientId,'tg');assert.equal(inbound.channel,'telegram');assert.equal(inbound.speaker,'client');
  const outbound=normalizeTelegram({...message,out:true},clients,'account-a')!;assert.equal(outbound.speaker,'owner');
  assert.notEqual(inbound.id,normalizeTelegram(message,clients,'account-b')!.id);
});
test('Telegram ignores unknown, removed, nonprivate and empty/service messages',()=>{
  for(const invalid of [{peerId:'456'},{peerId:'999'},{private:false},{text:''},{date:NaN},{id:0}])assert.equal(normalizeTelegram({...message,...invalid},clients,'account-a'),null);
  assert.equal(normalizeTelegram(message,[clients[0]],'account-a'),null);
});
test('Telegram sessions are authenticated, randomized and bound to their account',()=>{
  const key=randomBytes(32),value='private-session-token',sealed=sealSession(value,key,'account-a');assert.equal(sealed.includes(value),false);assert.equal(openSession(sealed,key,'account-a'),value);assert.notEqual(sealed,sealSession(value,key,'account-a'));
  assert.throws(()=>openSession(sealed,key,'account-b'));assert.throws(()=>openSession(sealed,randomBytes(32),'account-a'));
  const parts=sealed.split('.');parts[3]=Buffer.from('tampered').toString('base64');assert.throws(()=>openSession(parts.join('.'),key,'account-a'));
});
test('WhatsApp setup preserves allowed Telegram chats and its independently saved owner',()=>{
  const state=emptyState([{id:'tg',name:'TG',chatId:'123',channel:'telegram',enabled:true}]);state.settings={ownerPhone:'+15551230000',telegramOwnerPhone:'+15551239999'};
  applyWorkspaceSetup(state,workspaceSetupSchema.parse({ownerPhone:'+15551230000',clients:[{name:'WA',phone:'+15551230001'}]}));assert.equal(state.clients[0].enabled,true);assert.equal(state.settings.telegramOwnerPhone,'+15551239999');assert.equal(state.clients.filter(c=>clientChannel(c)==='whatsapp').length,1);
});
