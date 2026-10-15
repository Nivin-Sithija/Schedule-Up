import { Client, Connection } from '@temporalio/client';
import { config } from './config.js';
import type { Message } from './domain.js';
import { workspaceId, withWorkspace } from './tenant.js';
import { getState, mutate, listWorkspaces } from './store.js';
import { invalidateSchedules, persistMessages, processBatch, reminders, deliverSchedule, reconcileEcho } from './service.js';
import { captureError } from './telemetry.js';
export const taskQueue = 'followthrough-v2';
let temporal: Client | undefined;
const batches = new Map<string,{ messages: Message[]; timer: ReturnType<typeof setTimeout>; start: number }>();
const locks = new Map<string,Promise<unknown>>();
let tick: ReturnType<typeof setInterval> | undefined;
export async function initRuntime() {
  if(config.DURABLE_MODE==='temporal')temporal=new Client({connection:await Connection.connect({address:config.TEMPORAL_ADDRESS}),namespace:config.TEMPORAL_NAMESPACE});
  else tick=setInterval(()=>{void (async()=>{for(const id of await listWorkspaces())await withWorkspace(id,localTick);})().catch(captureError);},5000);
  for(const id of await listWorkspaces())await withWorkspace(id,resumeWorkspace);
}
export async function resumeWorkspace(){
  await mutate(s=>{for(const item of s.schedules)if(item.status==='sending'){item.status='uncertain';item.error='Service restarted during sending. Verify the messaging app before retrying.';}});
  const tenant=workspaceId();
  if(temporal){try{await temporal.workflow.start('reminderWorkflowV2',{taskQueue,workflowId:`${tenant}:reminders`,args:[tenant]});}catch(error:any){if(error.name!=='WorkflowExecutionAlreadyStartedError')throw error;}}
  const s=await getState();for(const item of s.schedules)if(item.status==='approved')await enqueueSend(item.id,item.at);
  if(!temporal)for(const m of s.messages)if(!s.analyzed.includes(m.id))buffer(m);
}

async function localTick() { await reminders(); const s = await getState(); for (const schedule of s.schedules) if (schedule.status === 'approved' && Date.parse(schedule.at) <= Date.now()) await deliverSchedule(schedule.id); }
function buffer(m: Message) {
  const key=`${workspaceId()}:${m.clientId}`;
  const old = batches.get(key); if (old) clearTimeout(old.timer);
  const messages = old?.messages || []; if (!messages.some(x=>x.id===m.id)) messages.push(m);
  const start = old?.start || Date.now();
  const timer = setTimeout(() => { const batch = batches.get(key)!.messages; batches.delete(key); const work = (locks.get(key) || Promise.resolve()).then(async()=>{for(let i=0;i<batch.length;i+=8)await processBatch(batch.slice(i,i+8));}); locks.set(key,work.catch(captureError)); },Math.max(0,Math.min(5000,15000-(Date.now()-start))));
  batches.set(key,{ messages,timer,start });
}
export async function ingest(m: Message) {
  const s = await getState(); if(!s.clients.some(c=>c.id===m.clientId&&c.enabled!==false))return; if (s.messages.some(x=>x.id===m.id)) return;
  await reconcileEcho(m);
  // Approval barrier is synchronous; inference never controls whether an old send is still allowed.
  await invalidateSchedules(m.clientId);
  if (temporal) await temporal.workflow.signalWithStart('conversationWorkflowV2',{ taskQueue, workflowId:`${workspaceId()}:client:${m.clientId}`, args:[workspaceId(),m.clientId], signal:'message', signalArgs:[m] });
  else { await persistMessages([m]); buffer(m); }
}
export async function enqueueSend(id: string, at: string) { if (temporal) { try { await temporal.workflow.start('sendWorkflowV2',{ taskQueue,workflowId:`${workspaceId()}:send:${id}:${at}`,args:[workspaceId(),id,at] }); } catch(e: any) { if(e.name !== 'WorkflowExecutionAlreadyStartedError') throw e; } } }
export async function retry(clientId: string) { const s = await getState(); const pending = s.messages.filter(m=>m.clientId===clientId&&!s.analyzed.includes(m.id)); for (const m of pending) { if (temporal) await temporal.workflow.signalWithStart('conversationWorkflowV2',{taskQueue,workflowId:`${workspaceId()}:client:${clientId}`,args:[workspaceId(),clientId],signal:'message',signalArgs:[m]}); else buffer(m); } }
export async function closeRuntime() { if(tick) clearInterval(tick); for (const b of batches.values()) clearTimeout(b.timer); await temporal?.connection.close(); }
