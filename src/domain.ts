import { z } from 'zod';
import type { Channel } from './channels.js';
import type { Template } from './templates.js';
export type Message = { channel?:Channel; id: string; clientId: string; speaker: 'owner' | 'client'; text: string; sentAt: string; origin: 'phone' | 'dashboard' | 'mock'; status?: string };
export type Client = { channel?:Channel; phone?:string; id: string; name: string; chatId: string; enabled?: boolean };
export type Task = { channel?:Channel; id: string; clientId: string; title: string; responsible: 'owner' | 'client'; status: 'review' | 'open' | 'waiting' | 'completed' | 'cancelled'; due: string | null; evidence: string[]; revision: number; manual: boolean; updatedAt: string };
export type Schedule = { id: string; clientId: string; taskId: string; taskRevision: number; text: string; at: string; approvedSeq: number; status: 'approved' | 'paused' | 'sending' | 'sent' | 'uncertain' | 'cancelled'; providerId?: string; error?: string };
export type Notification = { id: string; taskId: string; text: string; at: string; read: boolean };
export type Proposal = { id: string; clientId: string; change: Change; reason: string; createdAt: string };
export type State = { settings?: {ownerPhone:string;telegramOwnerPhone?:string}; revision: number; clients: Client[]; messages: Message[]; tasks: Task[]; schedules: Schedule[]; notifications: Notification[]; proposals: Proposal[]; templates: Template[]; sequence: Record<string, number>; analyzed: string[]; analysis: Record<string, { status: string; error?: string; at: string }>; connection: string };
export function validDeadline(value: string) { if(!/^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2}))?$/.test(value)||Number.isNaN(Date.parse(value)))return false; const day=value.slice(0,10);return new Date(`${day}T00:00:00Z`).toISOString().slice(0,10)===day; }
export const deadlineSchema=z.string().refine(validDeadline,'Use a valid YYYY-MM-DD date or ISO time with timezone').nullable();
export function scheduleEligibility(item: Schedule,task:Task|undefined,sequence:number,now:number):string|null {
  if(item.status!=='approved')return 'Not approved';
  if(!task||task.clientId!==item.clientId||task.revision!==item.taskRevision)return 'Task approval is stale';
  if(['completed','cancelled','review'].includes(task.status))return 'Task is closed or awaiting review';
  if(sequence!==item.approvedSeq)return 'Conversation changed';
  if(now<Date.parse(item.at))return 'Not due yet';
  if(now-Date.parse(item.at)>15*60_000)return 'More than fifteen minutes overdue';
  return null;
}
export const changeSchema = z.object({
  action: z.enum(['create', 'update', 'complete', 'cancel']), taskId: z.string().nullable(),
  title: z.string().min(1).max(200), responsible: z.enum(['owner', 'client']),
  status: z.enum(['review', 'open', 'waiting', 'completed', 'cancelled']),
  due: z.string().nullable(), evidence: z.array(z.string()).min(1).max(10),
  explicit: z.boolean(), reason: z.string().max(500),
}).strict();
export type Change = z.infer<typeof changeSchema>;
export const extractionSchema = z.object({ changes: z.array(changeSchema).max(12) }).strict();
export function validateChanges(changes: Change[], messages: Message[], tasks: Task[], clientId: string): Change[] {
  const ids = new Set(messages.filter(m => m.clientId === clientId).map(m => m.id));
  for (const c of changes) {
    if (!c.evidence.every(id => ids.has(id))) throw new Error('Model referenced unavailable evidence');
    if (c.action !== 'create' && !tasks.some(t => t.id === c.taskId && t.clientId === clientId)) throw new Error('Model referenced an unknown task');
    if (c.action === 'create' && c.taskId !== null) throw new Error('New task must not contain an existing ID');
    if (c.due !== null && !validDeadline(c.due)) throw new Error('Invalid model deadline');
  }
  return changes;
}
export function contextBoundary(state: State, clientId: string): number {
  return state.tasks.filter(t=>t.clientId===clientId && ['completed','cancelled'].includes(t.status))
    .reduce((latest,t)=>Math.max(latest,Date.parse(t.updatedAt)||0),0);
}
export function boundedContext(state: State, clientId: string, batch: Message[]) {
  const selected = new Map<string, Message>();
  const boundary = contextBoundary(state, clientId);
  const tasks = state.tasks.filter(t => t.clientId === clientId && !['completed', 'cancelled'].includes(t.status)).slice(-20);
  for (const t of tasks) for (const id of t.evidence) { const m = state.messages.find(m => m.id === id && m.clientId === clientId); if (m) selected.set(id, m); }
  for (const m of state.messages.filter(m => m.clientId === clientId && Date.parse(m.sentAt)>boundary).slice(-16)) selected.set(m.id, m);
  for (const m of batch) selected.set(m.id, m);
  const priority = [...batch, ...[...selected.values()].reverse()];
  const bounded = new Map<string, Message>(); let remaining = 24000;
  for (const m of priority) { if (bounded.has(m.id)) continue; const text=m.text.slice(0,Math.min(2000,remaining)); if(!text) break; bounded.set(m.id,{...m,text}); remaining-=text.length; }
  const order = new Map<string,number>(); for(const m of [...state.messages,...batch]) if(!order.has(m.id))order.set(m.id,order.size);
  const messages = [...bounded.values()].sort((a,b) => Date.parse(a.sentAt)-Date.parse(b.sentAt) || (order.get(a.id)||0)-(order.get(b.id)||0));
  return { tasks, messages };
}
export function emptyState(clients: Client[]): State { return { revision: 0, clients, messages: [], tasks: [], schedules: [], notifications: [], proposals: [], templates: [{ id: 'inputs', title: 'Ask for input', text: 'Hi {{name}}, could you send the remaining details when you have a moment?' }, { id: 'update', title: 'Progress update', text: 'Hi {{name}}, a quick update on our work: ' }], sequence: {}, analyzed: [], analysis: {}, connection: 'disconnected' }; }
