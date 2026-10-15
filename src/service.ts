import { randomUUID } from 'node:crypto';
import { clientChannel } from './channels.js';
import { config } from './config.js';
import { boundedContext, contextBoundary, validateChanges, scheduleEligibility, type Message, type State, type Task, type Schedule } from './domain.js';
import { getState, mutate } from './store.js';
import { extract, draft } from './ai.js';
import { search, indexMessages } from './retrieval.js';
import { send } from './connector.js';
import { confirmSend, markUncertain } from './outbox.js';
import { trace, captureError } from './telemetry.js';
import { operationLimits } from './limits.js';
import { workspaceId } from './tenant.js';
export async function invalidateSchedules(clientId: string) { await mutate(s => { for (const item of s.schedules) if (item.clientId === clientId && item.status === 'approved') { item.status = 'paused'; item.error = 'New conversation activity. Review before reapproving.'; } }); }
export async function persistMessages(batch: Message[]) {
  await mutate(s => { for (const m of batch) { if (!s.messages.some(existing => existing.id === m.id)) { s.messages.push(m); s.sequence[m.clientId] = (s.sequence[m.clientId] || 0) + 1; } } });
}
export async function processBatch(batch: Message[]) {
  if (!batch.length) return;
  const clientId = batch[0].clientId;
  if (batch.some(m => m.clientId !== clientId)) throw new Error('Cross-client batch rejected');
  const snapshot = await getState();
  if(!snapshot.clients.some(c=>c.id===clientId&&c.enabled!==false))return;
  const pending = batch.filter(m => !snapshot.analyzed.includes(m.id));
  if (!pending.length) return;
  const context = boundedContext(snapshot, clientId, pending);
  const persistence = persistMessages(pending); // Direct batch reaches inference: no write-then-reread.
  try {
    operationLimits.consume(`analysis:${workspaceId()}`,40,15*60000);
    const indexed = await search(clientId, pending.map(m => m.text).join(' ')).catch(() => []);
    const boundary = contextBoundary(snapshot, clientId);
    const activeEvidence = new Set(context.tasks.flatMap(t=>t.evidence));
    const agreements = indexed.filter((r: any) => snapshot.messages.some(m => m.id === r.id && m.clientId === clientId && (Date.parse(m.sentAt)>boundary || activeEvidence.has(m.id)))).slice(0,4);
    for (const r of agreements) { const m = snapshot.messages.find(m => m.id === r.id)!; if (!context.messages.some(x => x.id === m.id) && context.messages.reduce((n,x)=>n+x.text.length,0)+Math.min(m.text.length,1000)<=24000) context.messages.push({ ...m, text: m.text.slice(0,1000) }); }
    const pendingRequests=snapshot.proposals.filter(p=>p.clientId===clientId).slice(-8);
    const changes = await extract({ timezone: config.APP_TIMEZONE, newMessageIds: pending.map(m=>m.id), ...context, pendingRequests, agreements: agreements.map((r:any)=>({id:r.id})) });
    validateChanges(changes, context.messages, context.tasks, clientId);
    await persistence;
    await trace('tasks.commit', async () => mutate(s => {
      if(!s.clients.some(c=>c.id===clientId&&c.enabled!==false))return;
      // Do not apply a stale result over owner edits or newer analyzed messages.
      const stale = context.tasks.some(t => s.tasks.find(x => x.id === t.id)?.revision !== t.revision) || s.messages.some(m => m.clientId === clientId && !context.messages.some(x => x.id === m.id) && m.sentAt > pending.at(-1)!.sentAt);
      const now = new Date().toISOString();
      for (const c of changes) {
        const existing = s.tasks.find(t => t.id === c.taskId && t.clientId === clientId);
        if (stale || !c.explicit || (existing?.manual && c.action !== 'complete')) { upsertProposal(s,clientId,c,stale ? 'Conversation or task changed during analysis' : c.reason,now); continue; }
        s.proposals=s.proposals.filter(p=>!sameIntent(p.clientId,p.change,clientId,c));
        if (c.action === 'create') {
          if (s.tasks.some(t => t.clientId === clientId && t.title.toLowerCase() === c.title.toLowerCase() && t.evidence.some(id => c.evidence.includes(id)))) continue;
          s.tasks.push({ id: randomUUID(), clientId, channel:clientChannel(s.clients.find(c=>c.id===clientId)), title: c.title, responsible: c.responsible, status: c.status, due: c.due, evidence: c.evidence, revision: 1, manual: false, updatedAt: now });
        } else if (existing && c.action === 'complete') { existing.status='completed';existing.evidence=[...new Set([...existing.evidence,...c.evidence])];existing.revision++;existing.updatedAt=now;for(const schedule of s.schedules)if(schedule.taskId===existing.id && schedule.status==='approved'){schedule.status='paused';schedule.error='Task completed.';}
        } else if (existing) { Object.assign(existing, { title: c.title, responsible: c.responsible, due: c.due, evidence: [...new Set([...existing.evidence,...c.evidence])], status: c.action === 'complete' ? 'completed' : c.action === 'cancel' ? 'cancelled' : c.status, revision: existing.revision + 1, updatedAt: now }); }
      }
      for (const m of pending) if (!s.analyzed.includes(m.id)) s.analyzed.push(m.id);
      s.analysis[clientId] = { status: 'ready', at: now };
    }));
    void indexMessages(pending).catch(captureError);
  } catch (e) {
    await persistence;
    const error = e instanceof Error ? e.message : 'Analysis failed';
    await mutate(s => { s.analysis[clientId] = { status: 'queued', error, at: new Date().toISOString() }; });
    captureError(e);
    throw e;
  }
}
export function sameIntent(leftClient:string,left:import('./domain.js').Change,rightClient:string,right:import('./domain.js').Change) {
  if(leftClient!==rightClient || left.responsible!==right.responsible)return false;
  if(left.taskId && right.taskId)return left.taskId===right.taskId;
  const title=(text:string)=>text.toLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim();
  const subject=(text:string)=>title(text).split(' ').filter(w=>w.length>2&&!['the','and','send','provide','deliver','please','for','with'].includes(w));
  return left.action===right.action && (title(left.title)===title(right.title) || (left.evidence.some(id=>right.evidence.includes(id)) && subject(left.title).some(w=>subject(right.title).includes(w))));
}
export function upsertProposal(s:State,clientId:string,change:import('./domain.js').Change,reason:string,now:string) {
  const previous=s.proposals.find(p=>sameIntent(p.clientId,p.change,clientId,change));
  s.proposals=s.proposals.filter(p=>!sameIntent(p.clientId,p.change,clientId,change));
  s.proposals.push({id:previous?.id||randomUUID(),clientId,change,reason,createdAt:now});
}
export async function makeDraft(clientId: string, instruction: string, template?: string) {
  const s = await getState(); const context = boundedContext(s,clientId,[]);
  return draft({ ownerInstruction: instruction, template: template || '', timezone: config.APP_TIMEZONE, channel:clientChannel(s.clients.find(c=>c.id===clientId)), ...context });
}
export async function deliverSchedule(id: string) {
  const claim = await mutate(s => {
    const item = s.schedules.find(x => x.id === id);
    if (!item || item.status !== 'approved') return null;
    if(!s.clients.some(c=>c.id===item.clientId&&c.enabled!==false)){item.status='paused';item.error='Client is no longer allowed';return null;}
    const task = s.tasks.find(t => t.id === item.taskId);
    const refusal=scheduleEligibility(item,task,s.sequence[item.clientId]||0,Date.now());
    if(refusal){if(refusal!=='Not due yet'){item.status='paused';item.error=refusal;}return null;}
    item.status = 'sending'; return { item: structuredClone(item), client: s.clients.find(c => c.id === item.clientId)! };
  });
  if (!claim) return;
  try {
    const providerId = await trace('whatsapp.send', () => send(claim.client,claim.item.text));
    await mutate(s => { const item = s.schedules.find(x => x.id === id)!; confirmSend(s,id,providerId); if (!s.messages.some(m => m.id === providerId)) { s.messages.push({ id: providerId, clientId: item.clientId, channel:clientChannel(claim.client), speaker: 'owner', text: item.text, sentAt: new Date().toISOString(), origin: 'dashboard', status: 'sent' }); s.sequence[item.clientId] = (s.sequence[item.clientId] || 0)+1; } });
  } catch (e) { await mutate(s => { markUncertain(s,id,'Delivery outcome unknown. Verify WhatsApp before sending again.'); }); captureError(e); }
}
export async function reconcileEcho(message: Message) {
  if (message.speaker !== 'owner') return;
  await mutate(s => {
    const candidates = s.schedules.filter(item => item.clientId === message.clientId && ['sending','uncertain'].includes(item.status) && item.text === message.text && Math.abs(Date.parse(message.sentAt)-Date.parse(item.at)) < 120_000);
    if (candidates.length === 1) { confirmSend(s,candidates[0].id,message.id); message.origin='dashboard'; }
  });
}
export async function immediateSend(clientId: string, text: string, requestId: string) {
  const s = await getState(); const client = s.clients.find(c => c.id === clientId); if (!client || client.enabled===false) throw new Error('Client is not allowed');
  const id = requestId;
  await mutate(s => { if(s.schedules.some(x=>x.id===id)) throw new Error('This send request already exists. Check its outcome before retrying.'); s.schedules.push({ id, clientId, taskId: '', taskRevision: 0, text, at: new Date().toISOString(), approvedSeq: s.sequence[clientId] || 0, status: 'sending' }); });
  try { const providerId = await send(client,text); const message: Message = { id: providerId, clientId, channel:clientChannel(client), speaker: 'owner', text, sentAt: new Date().toISOString(), origin: 'dashboard', status: 'sent' }; await persistMessages([message]); await mutate(s => { confirmSend(s,id,providerId); }); await invalidateSchedules(clientId); return message; }
  catch (error) { const confirmed = await mutate(s => markUncertain(s,id,'Verify WhatsApp before retrying.')); if (confirmed) { const state=await getState(); const message: Message=state.messages.find(m=>m.id===confirmed) || {id:confirmed,clientId,channel:clientChannel(client),speaker:'owner',text,sentAt:new Date().toISOString(),origin:'dashboard',status:'sent'}; await persistMessages([message]); return message; } captureError(error); throw new Error(`Send outcome uncertain. Check ${clientChannel(client)==='telegram'?'Telegram':'WhatsApp'}; no automatic retry.`); }
}
export function localDateAtNine(date: string, timezone: string): number {
  let guess = Date.parse(`${date}T09:00:00Z`); const target = guess;
  for (let i=0;i<3;i++) { const parts = new Intl.DateTimeFormat('en-GB',{ timeZone: timezone, year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23' }).formatToParts(new Date(guess)); const p = Object.fromEntries(parts.map(x => [x.type,x.value])); const wall = Date.UTC(+p.year,+p.month-1,+p.day,+p.hour,+p.minute,+p.second); guess += target-wall; } return guess;
}
export async function reminders() {
  await mutate(s => { for (const t of s.tasks) {
    if (!t.due || ['completed','cancelled','review'].includes(t.status)) continue;
    const at = t.due.length === 10 ? localDateAtNine(t.due,config.APP_TIMEZONE) : Date.parse(t.due);
    for (const offset of [86400000,0]) { const id = `reminder:${t.id}:${t.revision}:${offset}`; if (Date.now() >= at-offset && !s.notifications.some(n => n.id === id)) s.notifications.push({ id, taskId: t.id, text: `${offset ? 'Upcoming' : 'Due'}: ${t.title}`, at: new Date().toISOString(), read: false }); }
  } });
}
