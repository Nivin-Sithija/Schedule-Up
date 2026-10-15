import assert from 'node:assert/strict';
import {extract} from '../src/ai.js';
import type {Message,Proposal} from '../src/domain.js';
const message=(id:string,speaker:'client'|'owner',text:string):Message=>({id,clientId:'regression',speaker,text,sentAt:`2026-10-14T21:${id==='request'?'11':id==='reply'?'15':'16'}:00Z`,origin:'mock'});
const request=message('request','client','Please send me the revised proposal tomorrow by 10 AM.');
const reply=message('reply','owner','Can I send it by 17th becuase I already have another proporsal to send by tomorrow');
const pending:Proposal={id:'pending-request',clientId:'regression',createdAt:request.sentAt,reason:'Client request',change:{action:'create',taskId:null,title:'Send revised proposal',responsible:'owner',status:'review',due:'2026-10-16T04:30:00.000Z',evidence:['request'],explicit:false,reason:'Client request'}};
const cases=[
 {name:'Conversational acceptance with typos',messages:[request,message('reply','owner','Sure I ll sent it as soon as possible')],status:'open',due:'2026-10-16T04:30:00.000Z',explicit:true},
 {name:'Owner proposes a later date',messages:[request,reply],status:'review',due:'2026-10-17',explicit:false},
 {name:'Client accepts the proposed date',messages:[request,reply,message('agreement','client','Yes, the 17th works. Please send it then.')],status:'open',due:'2026-10-17',explicit:true},
];
for(const scenario of cases){
 const started=Date.now();
 const changes=await extract({timezone:'Asia/Colombo',messages:scenario.messages,newMessageIds:[scenario.messages.at(-1)!.id],tasks:[],pendingRequests:[pending],agreements:[]});
 assert.equal(changes.length,1,scenario.name);
 const change=changes[0];
 assert.equal(change.action,'create',scenario.name);
 assert.equal(change.taskId,null,scenario.name);
 assert.equal(change.responsible,'owner',scenario.name);
 assert.equal(change.status,scenario.status,scenario.name);
 assert.equal(change.explicit,scenario.explicit,scenario.name);
 assert.equal(change.due,scenario.due,scenario.name);
 assert.ok(change.evidence.includes(scenario.messages.at(-1)!.id),scenario.name);
 console.log(`PASS ${scenario.name} (${Date.now()-started}ms)`);
}
