import { condition, continueAsNew, defineSignal, proxyActivities, setHandler, sleep, workflowInfo } from '@temporalio/workflow';
import type { Message } from './domain.js';
import type { tenantActivities } from './worker-activities.js';
const activities = proxyActivities<typeof tenantActivities>({ startToCloseTimeout: '8 minutes', retry: { initialInterval: '30 seconds', maximumInterval: '10 minutes' } });
export const messageSignal = defineSignal<[Message]>('message');
export async function conversationWorkflowV2(tenant:string,clientId: string, carry: Message[] = []): Promise<void> {
  let pending = carry;
  setHandler(messageSignal, m => { if (m.clientId === clientId && !pending.some(x => x.id === m.id)) pending.push(m); });
  while (true) {
    await condition(() => pending.length > 0);
    const started = Date.now();
    while (Date.now()-started < 15_000) { const count = pending.length; const changed = await condition(() => pending.length !== count, Math.min(5000,15000-(Date.now()-started))); if (!changed) break; }
    const batch = pending.splice(0,8).sort((a,b) => a.sentAt.localeCompare(b.sentAt));
    await activities.processBatch(tenant,batch);
    if (workflowInfo().historyLength > 1000) await continueAsNew<typeof conversationWorkflowV2>(tenant,clientId,pending);
  }
}
export async function sendWorkflowV2(tenant:string,id: string, at: string) { await sleep(Math.max(0,Date.parse(at)-Date.now())); await activities.deliverSchedule(tenant,id); }
export async function reminderWorkflowV2(tenant:string) { while (true) { await activities.reminders(tenant); await sleep('1 minute'); if (workflowInfo().historyLength > 1000) await continueAsNew<typeof reminderWorkflowV2>(tenant); } }
