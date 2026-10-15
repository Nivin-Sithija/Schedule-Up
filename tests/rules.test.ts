import test from 'node:test';
import assert from 'node:assert/strict';
import { responsibilityGuard } from '../src/rules.js';
import type { Change, Message } from '../src/domain.js';
const c:Change={action:'create',taskId:null,title:'Send logo',responsible:'owner',status:'open',due:null,evidence:['m'],explicit:true,reason:'Request'};
const m:Message={id:'m',clientId:'a',speaker:'owner',text:'Could you send the logo?',sentAt:'2026-10-13T09:00:00Z',origin:'phone'};
test('owner requests are actions owed by the client',()=>{const out=responsibilityGuard([c],[m])[0];assert.equal(out.responsible,'client');assert.equal(out.status,'waiting');});
test('client requests do not invent an owner commitment',()=>{const out=responsibilityGuard([c],[{...m,speaker:'client'}])[0];assert.equal(out.responsible,'owner');assert.equal(out.explicit,false);assert.equal(out.status,'review');});
test('first-person explicit commitments belong to their speaker',()=>{const out=responsibilityGuard([c],[{...m,speaker:'client',text:'I will send the logo.'}])[0];assert.equal(out.responsible,'client');assert.equal(out.status,'waiting');});
test('a truncated context cannot become explicit through responsibility correction',()=>assert.equal(responsibilityGuard([{...c,explicit:false,status:'review'}],[m])[0].explicit,false));
import {completionGuard} from '../src/rules.js';
import type {Task} from '../src/domain.js';
const task:Task={id:'task',clientId:'a',title:'Supply carrots to hotel',responsible:'owner',status:'open',due:'2026-10-15',evidence:[],revision:2,manual:true,updatedAt:'2026-10-13T09:00:00Z'};
const completed:Change={...c,action:'complete',taskId:'task',title:task.title,status:'completed'};
test('a fresh clear completion is eligible even when the owner edited the task',()=>{
 assert.equal(completionGuard([completed],[{...m,text:'I delivered the carrots.'}],[task],['m'])[0].explicit,true);
});
test('future, negative and generic thanks do not auto-complete tasks',()=>{
 for(const text of ["I'll send the completed draft tomorrow.",'I have not delivered the carrots.','Thanks','Did you deliver the carrots?'])assert.equal(completionGuard([completed],[{...m,text}],[task],['m'])[0].explicit,false);
});
test('old evidence and ambiguous done across multiple tasks require review',()=>{
 assert.equal(completionGuard([completed],[{...m,text:'I delivered the carrots.'}],[task],[])[0].explicit,false);
 assert.equal(completionGuard([completed],[{...m,text:'Done'}],[task,{...task,id:'other',title:'Send logo'}],['m'])[0].explicit,false);
});
test('a named completion identifies one task and respects the responsible speaker',()=>{
 assert.equal(completionGuard([completed],[{...m,text:'I delivered the carrots.'}],[task,{...task,id:'other',title:'Send logo'}],['m'])[0].explicit,true);
 assert.equal(completionGuard([completed],[{...m,speaker:'client',text:'I sent the carrots.'}],[task],['m'])[0].explicit,false);
 assert.equal(completionGuard([completed],[{...m,speaker:'client',text:'I received the carrots.'}],[task],['m'])[0].explicit,true);
});
test('one completed deliverable is recognized even when another sentence says pending',()=>{const logo={...task,id:'logo',title:'Send logo artwork'},invoice={...task,id:'invoice',title:'Send invoice'};const out=completionGuard([{...completed,taskId:'logo',title:logo.title}],[{...m,text:'I have sent the logo artwork. The invoice is still pending.'}],[logo,invoice],['m'])[0];assert.equal(out.explicit,true);assert.equal(out.action,'complete');});
test('a question proposing an update does not overwrite an existing agreed deadline',()=>{const out=responsibilityGuard([{...c,action:'update',taskId:'task',explicit:true,status:'open'}],[{...m,text:'Can I send the proposal by 17th?'}])[0];assert.equal(out.explicit,false);assert.equal(out.status,'review');});
