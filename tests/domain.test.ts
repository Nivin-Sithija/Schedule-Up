import test from 'node:test';
import assert from 'node:assert/strict';
import { boundedContext, emptyState, validateChanges, type Message, type Change } from '../src/domain.js';
import { normalizeEvent } from '../src/connector.js';
const clients=[{id:'a',name:'Alex',chatId:'111@c.us'},{id:'b',name:'Sam',chatId:'222@c.us'}];
const message:Message={id:'m1',clientId:'a',speaker:'owner',text:'I will send it Friday.',sentAt:'2026-10-13T10:00:00+05:30',origin:'phone'};
const change:Change={action:'create',taskId:null,title:'Send proposal',responsible:'owner',status:'open',due:'2026-10-16',evidence:['m1'],explicit:true,reason:'Explicit promise'};
test('owner-phone messages are captured using recipient, not sender',()=>{const m=normalizeEvent({event:'message.any',payload:{id:'id1',from:'owner@c.us',to:'111@c.us',fromMe:true,body:'I will send it Friday',timestamp:1791885600}},clients);assert.equal(m?.speaker,'owner');assert.equal(m?.clientId,'a');});
test('client messages use sender',()=>assert.equal(normalizeEvent({event:'message',payload:{id:'id2',from:'222@c.us',body:'Send the logo',timestamp:1791885600}},clients)?.clientId,'b'));
test('unknown chats are never analyzed',()=>assert.equal(normalizeEvent({event:'message',payload:{id:'id3',from:'unknown@lid',body:'Do it',timestamp:1791885600}},clients),null));
test('invalid message timestamps are rejected',()=>assert.equal(normalizeEvent({event:'message',payload:{id:'id',from:'111@c.us',body:'x',timestamp:'bad'}},clients),null));
test('fabricated evidence fails validation',()=>assert.throws(()=>validateChanges([{...change,evidence:['fake']}],[message],[],'a'),/evidence/));
test('cross-client evidence fails validation',()=>assert.throws(()=>validateChanges([change],[{...message,clientId:'b'}],[],'a'),/evidence/));
test('updating unknown tasks is rejected',()=>assert.throws(()=>validateChanges([{...change,action:'update',taskId:'unknown'}],[message],[],'a'),/unknown task/));
test('timed deadlines need an explicit timezone',()=>assert.throws(()=>validateChanges([{...change,due:'2026-10-16T09:00:00'}],[message],[],'a'),/deadline/));
test('date-only commitments stay date-only',()=>assert.equal(validateChanges([change],[message],[],'a')[0].due,'2026-10-16'));
test('bounded context includes both speakers without unrelated client data',()=>{const s=emptyState(clients);s.messages=[message,{...message,id:'m2',speaker:'client',text:'Confirmed'}, {...message,id:'secret',clientId:'b',text:'Private'}];const c=boundedContext(s,'a',[]);assert.equal(c.messages.length,2);assert.deepEqual(c.messages.map(m=>m.speaker),['owner','client']);});
test('large history cannot grow prompt context beyond the character budget',()=>{const s=emptyState(clients);s.messages=Array.from({length:500},(_,i)=>({...message,id:`m${i}`,text:'x'.repeat(4000)}));const c=boundedContext(s,'a',[{...message,id:'new',text:'New commitment'}]);assert.ok(c.messages.reduce((n,m)=>n+m.text.length,0)<=24000);assert.ok(c.messages.some(m=>m.id==='new'));});
test('NOWEB owner-phone messages resolve the peer when recipient is absent',()=>{
 const m=normalizeEvent({event:'message.any',payload:{id:'noweb-owner',from:'111@c.us',fromMe:true,body:'I will send it Friday',timestamp:1791885600,_data:{key:{fromMe:true,remoteJid:'111@s.whatsapp.net'}}}},clients);
 assert.equal(m?.speaker,'owner');assert.equal(m?.clientId,'a');
});
test('signed NOWEB peer alternate maps a linked ID to the allowlisted client',()=>{
 for(const fromMe of [false,true]) {
  const m=normalizeEvent({event:'message.any',payload:{id:`lid-${fromMe}`,from:'999@lid',fromMe,body:'Send the draft',timestamp:1791885600,_data:{key:{fromMe,remoteJid:'999@lid',remoteJidAlt:'111@s.whatsapp.net'}}}},clients);
  assert.equal(m?.clientId,'a');assert.equal(m?.speaker,fromMe?'owner':'client');
 }
});
test('alternate metadata from another peer cannot bypass the allowlist',()=>{
 assert.equal(normalizeEvent({event:'message.any',payload:{id:'bad-lid',from:'999@lid',fromMe:false,body:'x',timestamp:1791885600,_data:{key:{fromMe:false,remoteJid:'other@lid',remoteJidAlt:'111@s.whatsapp.net'}}}},clients),null);
});
test('unknown alternate phone and group messages are excluded',()=>{
 for(const key of [{fromMe:false,remoteJid:'999@lid',remoteJidAlt:'333@s.whatsapp.net'},{fromMe:false,remoteJid:'group@g.us',participant:'111@s.whatsapp.net',remoteJidAlt:'111@s.whatsapp.net'}])
 assert.equal(normalizeEvent({event:'message.any',payload:{id:'excluded',from:key.remoteJid,fromMe:false,body:'x',timestamp:1791885600,_data:{key}}},clients),null);
});
test('completion starts fresh recent context without removing stored conversation history',()=>{
 const state=emptyState(clients);
 state.messages=[{...message,id:'old',sentAt:'2026-10-13T08:00:00Z'},{...message,id:'new',text:'New order',sentAt:'2026-10-13T10:00:00Z'}];
 state.tasks=[{id:'done',clientId:'a',title:'Old order',responsible:'owner',status:'completed',due:null,evidence:['old'],revision:2,manual:true,updatedAt:'2026-10-13T09:00:00Z'}];
 const context=boundedContext(state,'a',[]);
 assert.equal(context.tasks.length,0);assert.deepEqual(context.messages.map(m=>m.id),['new']);assert.equal(state.messages.length,2);
});
test('closing one task preserves evidence for other active tasks and every new batch message',()=>{
 const state=emptyState(clients);
 state.messages=[{...message,id:'old-active',sentAt:'2026-10-13T08:00:00Z'}];
 state.tasks=[{id:'done',clientId:'a',title:'Done',responsible:'owner',status:'completed',due:null,evidence:[],revision:2,manual:true,updatedAt:'2026-10-13T09:00:00Z'},{id:'active',clientId:'a',title:'Another task',responsible:'owner',status:'open',due:null,evidence:['old-active'],revision:1,manual:false,updatedAt:'2026-10-13T08:00:00Z'}];
 const context=boundedContext(state,'a',[{...message,id:'fresh-batch',sentAt:'2026-10-13T08:30:00Z'}]);
 assert.deepEqual(context.tasks.map(t=>t.id),['active']);assert.deepEqual(context.messages.map(m=>m.id),['old-active','fresh-batch']);
});
