import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { spawn,type ChildProcess } from 'node:child_process';
import { Client,Connection } from '@temporalio/client';
import { config } from '../src/config.js';
import { withWorkspace } from '../src/tenant.js';
import { initStore,createWorkspace,getState,mutate } from '../src/store.js';
import { databasePool,closeDatabase } from '../src/database.js';
import { normalizeEvent } from '../src/connector.js';
import { normalizeTelegram } from '../src/telegram-normalize.js';
import { boundedContext } from '../src/domain.js';
import { fourDayCalendar } from '../src/task-calendar.js';
import { makeDraft, reminders, invalidateSchedules } from '../src/service.js';
if(config.AI_PROVIDER!=='ollama'||config.STORE_DRIVER!=='postgres'||config.DURABLE_MODE!=='temporal')throw new Error('This integration check requires local Ollama, Tiger PostgreSQL and Temporal.');
const tenant=randomUUID(),workflowIds:string[]=[];
const owner=(process.env.TEST_OWNER_PHONE_E164||process.env.BUSINESS_PHONE_E164||'+15551230000').replace(/\D/g,''),phone=(process.env.TEST_CLIENT_PHONE_E164||process.env.CLIENT_ALLOWLIST_E164?.split(',')[0]||'+15551230001').replace(/\D/g,'');
const wa={id:'workflow-wa',name:'Test client',chatId:phone+'@c.us',channel:'whatsapp' as const},tg={id:'workflow-tg',name:'Test client',chatId:'123456789',phone:'+'+phone,channel:'telegram' as const};
let worker:ChildProcess|undefined,connection:Connection|undefined,temporal:Client;
async function startWorker(){let output='';worker=spawn(process.execPath,['--env-file-if-exists=.env','--import','tsx','src/worker.ts'],{stdio:['ignore','pipe','pipe']});worker.stdout?.on('data',value=>{output+=value;});worker.stderr?.on('data',value=>{output+=value;});for(let n=0;n<100;n++){if(worker.exitCode!==null)throw new Error('Worker exited before readiness');if(output.includes("state: 'RUNNING'"))return;await new Promise(r=>setTimeout(r,200));}throw new Error('Worker startup timed out');}
async function stopWorker(){const process=worker;if(!process||process.exitCode!==null)return;await new Promise<void>(resolve=>{const timer=setTimeout(()=>process.kill('SIGKILL'),8000);process.once('exit',()=>{clearTimeout(timer);resolve();});process.kill('SIGTERM');});worker=undefined;}
async function waitFor(check:()=>Promise<boolean>,label:string,timeout=240_000){const end=Date.now()+timeout;while(Date.now()<end){if(await check()){console.log('PASS '+label);return;}await new Promise(r=>setTimeout(r,1000));}throw new Error('Timed out: '+label);}
async function signal(clientId:string,messages:unknown[]){const id=`${tenant}:client:${clientId}`;if(!workflowIds.includes(id))workflowIds.push(id);for(const message of messages)await temporal.workflow.signalWithStart('conversationWorkflowV2',{taskQueue:'followthrough-v2',workflowId:id,args:[tenant,clientId],signal:'message',signalArgs:[message]});}
try{
  await initStore();await withWorkspace(tenant,async()=>{await createWorkspace();await mutate(s=>{s.settings={ownerPhone:'+'+owner};s.clients=[wa,tg];});});
  connection=await Connection.connect({address:config.TEMPORAL_ADDRESS});temporal=new Client({connection,namespace:config.TEMPORAL_NAMESPACE});
  const now=new Date().toISOString(),stamp=Math.floor(Date.parse(now)/1000);
  const waMessage=normalizeEvent({event:'message.any',session:'test-only',payload:{id:randomUUID(),body:'I will send the revised proposal tomorrow.',fromMe:true,to:wa.chatId,timestamp:stamp}},[wa])!;
  const tgMessage=normalizeTelegram({peerId:tg.chatId,id:1,out:true,text:'I will send the logo artwork tomorrow.',date:stamp,private:true},[tg],tenant)!;
  // Queue while there is no test worker, then prove processing survives a worker restart.
  await signal(wa.id,[waMessage]);await signal(tg.id,[tgMessage]);
  await startWorker();await stopWorker();console.log('PASS worker restarted with durable channel signals queued');await startWorker();
  await waitFor(()=>withWorkspace(tenant,async()=>{const state=await getState();return ['whatsapp','telegram'].every(channel=>state.tasks.some(t=>t.channel===channel&&t.status==='open'&&!!t.due));}),'both channels create dated tasks through Temporal → real Gemma → Tiger');
  await withWorkspace(tenant,async()=>{const state=await getState();assert.equal(state.messages.length,2);assert.equal(fourDayCalendar(state.tasks,config.APP_TIMEZONE).flatMap(day=>day.tasks).length,2);assert.ok(state.tasks.find(t=>t.clientId===wa.id)?.evidence.includes(waMessage.id));assert.ok(state.tasks.find(t=>t.clientId===tg.id)?.evidence.includes(tgMessage.id));const task=state.tasks.find(t=>t.clientId===tg.id)!;await mutate(s=>s.schedules.push({id:randomUUID(),clientId:tg.id,taskId:task.id,taskRevision:task.revision,text:'Test only; never dispatched',at:new Date(Date.now()+86400000).toISOString(),approvedSeq:s.sequence[tg.id]||0,status:'approved'}));await invalidateSchedules(tg.id);assert.equal((await getState()).schedules[0].status,'paused');});console.log('PASS new conversation activity pauses approved Telegram follow-ups');
  const draft=await withWorkspace(tenant,()=>makeDraft(tg.id,'Write a short progress update about the logo artwork. Do not claim it is finished.'));assert.ok(draft.trim().length);console.log('PASS real Gemma creates an editable Telegram draft without sending');
  await withWorkspace(tenant,async()=>{await mutate(s=>s.tasks.push({id:'reminder-check',clientId:wa.id,channel:'whatsapp',title:'Test reminder',responsible:'owner',status:'open',due:'2020-01-01',evidence:[],revision:1,manual:true,updatedAt:new Date().toISOString()}));await reminders();assert.ok((await getState()).notifications.some(n=>n.taskId==='reminder-check'));});console.log('PASS due-task reminders persist in the shared workspace');
  const complete=normalizeTelegram({peerId:tg.chatId,id:2,out:true,text:'I have sent the logo artwork.',date:stamp+2,private:true},[tg],tenant)!;await signal(tg.id,[complete]);
  await waitFor(()=>withWorkspace(tenant,async()=>{const state=await getState();return state.tasks.some(t=>t.clientId===tg.id&&t.status==='completed');}),'explicit Telegram completion closes its own task');
  await withWorkspace(tenant,async()=>{const state=await getState();assert.ok(state.tasks.some(t=>t.clientId===wa.id&&t.status==='open'));assert.equal(boundedContext(state,tg.id,[]).tasks.length,0);});console.log('PASS shared task history preserves the other channel and starts fresh completed-task context');
  await stopWorker();await withWorkspace(tenant,async()=>{const state=await getState();assert.equal(state.messages.length,3);assert.ok(state.tasks.some(t=>t.status==='completed'));});console.log('PASS saved workflow state survives worker shutdown. No real messages were sent.');
}finally{
  for(const id of workflowIds)try{await temporal!.workflow.getHandle(id).terminate('Temporary integration test complete');}catch{}
  await stopWorker();
  await databasePool().query('DELETE FROM ft_chunks_v2 WHERE workspace_id=$1',[tenant]);await databasePool().query('DELETE FROM ft_workspace WHERE id=$1',[tenant]);
  await connection?.close();await closeDatabase();
}
