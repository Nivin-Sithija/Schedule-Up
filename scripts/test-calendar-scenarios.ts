import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {mkdir,writeFile} from 'node:fs/promises';
import {config} from '../src/config.js';
import {withWorkspace} from '../src/tenant.js';
import {initStore,createWorkspace,getState,mutate} from '../src/store.js';
import {databasePool,closeDatabase} from '../src/database.js';
import {processBatch} from '../src/service.js';
import {indexMessages} from '../src/retrieval.js';
import {fourDayCalendar,calendarDate} from '../src/task-calendar.js';
import type {Message,Task,State} from '../src/domain.js';
if(config.AI_PROVIDER!=='ollama'||config.STORE_DRIVER!=='postgres')throw new Error('Requires local Ollama and configured Tiger test storage.');
const tenant=randomUUID(),today=new Date('2026-10-15T09:00:00+05:30'),timezone='Asia/Colombo';
const seed=(id:string,title:string,due:string|null):Task=>({id,clientId:'',title,due,responsible:'owner',status:'open',evidence:[],revision:1,manual:false,updatedAt:'2026-10-15T03:00:00Z'});
type Scenario={name:string;expected:string;messages:[Message['speaker'],string,string?][];tasks?:Task[];check:(s:State,id:string)=>void;repeat?:boolean};
const active=(s:State,id:string)=>s.tasks.filter(t=>t.clientId===id&&!['completed','cancelled','review'].includes(t.status));
const dates=(s:State,id:string)=>fourDayCalendar(s.tasks.filter(t=>t.clientId===id),timezone,today).flatMap(day=>day.tasks.map(t=>({title:t.title,day:day.day,status:t.status})));
const only=(s:State,id:string)=>{const tasks=active(s,id);assert.equal(tasks.length,1,'Expected one active task');return tasks[0];};
const day=(task:Task)=>task.due?calendarDate(task.due,timezone):null;
const scenarios:Scenario[]=[
 {name:'Informal acceptance',expected:'One open proposal task on 16 Oct at 10 AM; no review cards',messages:[['client','Please send the revised proposal tomorrow by 10 AM.'],['owner','Sure I ll sent it as soon as possible']],check(s,id){const t=only(s,id);assert.equal(t.status,'open');assert.equal(Date.parse(t.due!),Date.parse('2026-10-16T10:00:00+05:30'));assert.equal(s.proposals.filter(p=>p.clientId===id).length,0);}},
 {name:'Direct promise with reason and 24-hour time',expected:'Invoice on 16 Oct at 14:30, no invented extra work',messages:[['owner','I will send the invoice tomorrow by 14:30 because I need to check the final amount first.']],check(s,id){const t=only(s,id);assert.equal(Date.parse(t.due!),Date.parse('2026-10-16T14:30:00+05:30'));}},
 {name:'Promise without a deadline',expected:'Open logo task without a calendar date',messages:[['owner',"I'll send the logo artwork as soon as possible."]],check(s,id){assert.equal(only(s,id).due,null);assert.equal(dates(s,id).length,0);}},
 {name:'Explicit deadline change with explanation',expected:'Same task moves from 16 to 17 Oct at 3 PM, no duplicate',tasks:[seed('proposal','Send revised proposal','2026-10-16T04:30:00Z')],messages:[['owner','I will send the revised proposal on 17 October at 3 PM instead of tomorrow because the pricing needs updating.']],check(s,id){const t=only(s,id);assert.equal(t.id,'proposal');assert.equal(Date.parse(t.due!),Date.parse('2026-10-17T15:00:00+05:30'));assert.deepEqual(dates(s,id).map(d=>d.day),['2026-10-17']);}},
 {name:'Counteroffer on an existing task',expected:'Existing 16 Oct task stays; proposed 17 Oct change needs review',tasks:[seed('proposal','Send revised proposal','2026-10-16T04:30:00Z')],messages:[['owner','Can I send the revised proposal by 17th because I have another proposal tomorrow?']],check(s,id){assert.equal(day(only(s,id)),'2026-10-16');assert.equal(s.proposals.filter(p=>p.clientId===id).length,1);}},
 {name:'Agreed counteroffer',expected:'Proposal automatically scheduled on 17 Oct',messages:[['client','Please send the revised proposal tomorrow by 10 AM.'],['owner','Can I send it by 17th because another proposal is due tomorrow?'],['client','Yes, the 17th works. Please send it then.']],check(s,id){assert.equal(day(only(s,id)),'2026-10-17');assert.equal(s.proposals.filter(p=>p.clientId===id).length,0);}},
 {name:'Two deliverables in one message',expected:'Logo on 16 Oct; invoice on 17 Oct',messages:[['owner','I will send the logo artwork tomorrow at 11 AM, and I will send the invoice on 17 October at 4 PM.']],check(s,id){assert.equal(active(s,id).length,2);const entries=dates(s,id);assert.equal(entries.find(t=>/logo/i.test(t.title))?.day,'2026-10-16');assert.equal(entries.find(t=>/invoice/i.test(t.title))?.day,'2026-10-17');}},
 {name:'Complete one of two tasks',expected:'Logo closes and leaves calendar; invoice stays on 17 Oct',tasks:[seed('logo','Send logo artwork','2026-10-16'),seed('invoice','Send invoice','2026-10-17')],messages:[['owner','I have sent the logo artwork. The invoice is still pending.']],check(s,id){assert.equal(s.tasks.find(t=>t.id==='logo'&&t.clientId===id)?.status,'completed');assert.equal(only(s,id).id,'invoice');assert.deepEqual(dates(s,id).map(t=>t.day),['2026-10-17']);}},
 {name:'Explicit cancellation',expected:'Cancelled proposal leaves active calendar',tasks:[seed('proposal','Send revised proposal','2026-10-16')],messages:[['owner','Cancel the revised proposal task. The client no longer needs it.']],check(s,id){assert.equal(active(s,id).length,0);assert.equal(s.tasks.find(t=>t.id==='proposal'&&t.clientId===id)?.status,'cancelled');assert.equal(dates(s,id).length,0);}},
 {name:'Client owes an input',expected:'Waiting on client for product photos on 16 Oct',messages:[['client','I will send the product photos tomorrow by 9 AM.']],check(s,id){const t=only(s,id);assert.equal(t.responsible,'client');assert.equal(t.status,'waiting');assert.equal(day(t),'2026-10-16');}},
 {name:'Owner refuses a request',expected:'No accepted task or calendar entry',messages:[['client','Please send the invoice tomorrow.'],['owner',"Sorry, I cannot take this job. I won't be sending an invoice."]],check(s,id){assert.equal(active(s,id).length,0);assert.equal(dates(s,id).length,0);}},
 {name:'Conditional promise',expected:'No accepted task or calendar entry; a tentative idea may be ignored or offered for review',messages:[['owner','If the supplier confirms stock, I might deliver the sample tomorrow.']],check(s,id){assert.equal(active(s,id).length,0);assert.equal(dates(s,id).length,0);}},
 {name:'Short correction refers to existing task',expected:'Same task moves to 18 Oct at 11 AM',tasks:[seed('proposal','Send revised proposal','2026-10-16T04:30:00Z')],messages:[['owner','Correction: I will send it on 18 October at 11 AM, not the 16th.']],check(s,id){const t=only(s,id);assert.equal(t.id,'proposal');assert.equal(Date.parse(t.due!),Date.parse('2026-10-18T11:00:00+05:30'));}},
 {name:'Tomorrow after local midnight',expected:'Proposal on 17 Oct despite UTC date still being 15 Oct',messages:[['owner','I will send the revised proposal tomorrow by 10 AM.','2026-10-15T20:00:00Z']],check(s,id){assert.equal(day(only(s,id)),'2026-10-17');}},
 {name:'Duplicate delivery of a message',expected:'Only one calendar task after processing the same message twice',messages:[['owner','I will send the revised proposal tomorrow.']],repeat:true,check(s,id){assert.equal(active(s,id).length,1);assert.equal(dates(s,id).length,1);}},
];
const results:{name:string;expected:string;messages:string[];pass:boolean;error?:string;observed:unknown;ms:number}[]=[];
try{
 await initStore();await withWorkspace(tenant,()=>createWorkspace());
 for(const [i,scenario]of scenarios.entries())await withWorkspace(tenant,async()=>{
  const clientId=`calendar-case-${i}`,channel=i%2?'telegram' as const:'whatsapp' as const;
  const messages=scenario.messages.map(([speaker,text,sentAt],j):Message=>({id:`${tenant}:${clientId}:${j}`,clientId,channel,speaker,text,sentAt:sentAt||new Date(today.getTime()+j*60000).toISOString(),origin:'mock'}));
  await mutate(s=>{s.clients.push({id:clientId,name:scenario.name,chatId:`test-only-${i}`,channel,enabled:true});s.tasks.push(...(scenario.tasks||[]).map(t=>({...t,id:`${clientId}:${t.id}`,clientId,channel,evidence:[]})));});
  // Keep fixture task IDs in assertions while provider identifiers remain isolated.
  const originalCheck=scenario.check;
  const started=Date.now();let error:string|undefined;
  try{await processBatch(messages);if(scenario.repeat)await processBatch(messages);const s=await getState();const checkState=structuredClone(s);for(const t of checkState.tasks)if(t.clientId===clientId&&t.id.startsWith(clientId+':'))t.id=t.id.slice(clientId.length+1);originalCheck(checkState,clientId);}catch(e){error=e instanceof Error?e.message:String(e);}
  const state=await getState();const observed={tasks:state.tasks.filter(t=>t.clientId===clientId).map(t=>({title:t.title,status:t.status,responsible:t.responsible,due:t.due})),calendar:dates(state,clientId),reviews:state.proposals.filter(p=>p.clientId===clientId).map(p=>({title:p.change.title,due:p.change.due,reason:p.reason}))};
  results.push({name:scenario.name,expected:scenario.expected,messages:scenario.messages.map(([speaker,text])=>`${speaker}: ${text}`),pass:!error,error,observed,ms:Date.now()-started});
  console.log(`${error?'FAIL':'PASS'} ${scenario.name}${error?' — '+error:''}`);
 });
 // Wait for embeddings of the same test messages before removing this isolated workspace.
 await withWorkspace(tenant,async()=>{await indexMessages((await getState()).messages);});
}finally{
 const report=`# Calendar conversation scenarios\n\nLocal Gemma + Mastra extraction → Tiger persistence → the dashboard calendar function. Fixed message date: 15 October 2026, timezone Asia/Colombo. Synthetic test workspace; no provider sends or real client changes. Existing-task cases use seeded previously accepted tasks. Temporal and live transport are outside this test.\n\n${results.filter(r=>r.pass).length}/${results.length} scenarios passed.\n\n`+results.map(r=>`## ${r.pass?'PASS':'FAIL'}: ${r.name}\n\n${r.messages.map(m=>'> '+m).join('\n>\n')}\n\nExpected: ${r.expected}\n\n${r.error?'Failure: '+r.error+'\n\n':''}Observed (${r.ms} ms):\n\n\`\`\`json\n${JSON.stringify(r.observed,null,2)}\n\`\`\`\n`).join('\n');
 await mkdir('docs/testing',{recursive:true});
 await writeFile('docs/testing/CALENDAR-SCENARIOS.md',report);
 await databasePool().query('DELETE FROM ft_chunks_v2 WHERE workspace_id=$1',[tenant]);await databasePool().query('DELETE FROM ft_workspace WHERE id=$1',[tenant]);await closeDatabase();
}
if(results.length!==scenarios.length||results.some(r=>!r.pass))process.exitCode=1;
