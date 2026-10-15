import { createHmac, timingSafeEqual, randomUUID } from 'node:crypto';
import { workspaceId } from './tenant.js';
import { getState } from './store.js';
import { clientChannel } from './channels.js';
import { sendTelegram } from './telegram.js';
import { config } from './config.js';
import type { Client, Message } from './domain.js';
import { createPairingController } from './pairing.js';
export function activeSession(){const id=workspaceId();return id==='owner'?config.WAHA_SESSION:`ft-${id}`;}
export function validSignature(raw: string, signature?: string, algorithm?: string) {
  if (!signature || algorithm !== 'sha512' || !config.WAHA_WEBHOOK_HMAC_KEY) return false;
  const expected = createHmac('sha512', config.WAHA_WEBHOOK_HMAC_KEY).update(raw).digest('hex');
  const a = Buffer.from(signature), b = Buffer.from(expected); return a.length === b.length && timingSafeEqual(a,b);
}
function canonicalPeer(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  return value.replace(/:\d+(?=@)/, '').replace(/@s\.whatsapp\.net$/, '@c.us');
}
export function eventPeer(payload: any): string | undefined {
  const key = payload?._data?.key;
  if (key?.participant || String(key?.remoteJid || '').endsWith('@g.us')) return undefined;
  const direct = payload?.fromMe ? payload?.to : payload?.from;
  if (direct) return canonicalPeer(direct);
  // NOWEB sends owner-phone messages with `from` as the peer and `to` absent.
  if (key && key.fromMe === payload?.fromMe && canonicalPeer(key.remoteJid) === canonicalPeer(payload?.from)) return canonicalPeer(key.remoteJid);
  return undefined;
}
function eventPhonePeer(payload: any): string | undefined {
  const peer = eventPeer(payload), key = payload?._data?.key;
  if (!peer?.endsWith('@lid') || !key || key.fromMe !== payload.fromMe || canonicalPeer(key.remoteJid) !== peer) return peer;
  const phone = canonicalPeer(key.remoteJidAlt);
  return phone?.endsWith('@c.us') ? phone : peer;
}
export function normalizeEvent(event: any, clients: Client[]): Message | null {
  if (!['message', 'message.any'].includes(event.event)) return null;
  const p = event.payload;
  if (!p?.id || !p.body || typeof p.body !== 'string' || p.hasMedia) return null;
  const chatId = eventPhonePeer(p);
  const client = clients.find(c => clientChannel(c)==='whatsapp' && c.chatId === chatId && c.enabled!==false);
  if (!client) return null; // Unknown linked IDs are ignored, never guessed across clients.
  const date = new Date(Number(p.timestamp) * 1000);
  if (Number.isNaN(date.getTime())) return null;
  return { id: `waha:${event.session || config.WAHA_SESSION}:${p.id}`, clientId: client.id, channel:'whatsapp', speaker: p.fromMe ? 'owner' : 'client', text: p.body.slice(0,4000), sentAt: date.toISOString(), origin: 'phone' };
}
export async function waha(path: string, method = 'GET', body?: unknown) {
  const response = await fetch(`${config.WAHA_URL}${path}`, { method, headers: { 'X-Api-Key': config.WAHA_API_KEY, 'Content-Type': 'application/json', Accept: 'application/json' }, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(20_000) });
  if (!response.ok) throw new Error(`Connector returned ${response.status}`);
  const raw=await response.text();return raw?JSON.parse(raw):{};
}
export async function normalizeResolvedEvent(event:any,clients:Client[]) {
  const direct=normalizeEvent(event,clients);if(direct)return direct;
  const p=event.payload;const chatId=eventPeer(p);
  if(typeof chatId!=='string'||!chatId.endsWith('@lid')||!['message','message.any'].includes(event.event))return null;
  try {const mapping=await waha(`/api/${encodeURIComponent(activeSession())}/lids/${encodeURIComponent(chatId)}`);const phone=mapping.pn;if(typeof phone!=='string'||!clients.some(c=>c.chatId===phone))return null;return normalizeEvent({...event,payload:{...p,[p.fromMe?'to':'from']:phone}},clients);}catch{return null;}
}
export function sentResponseId(result: any): string | undefined {
  if (typeof result?.id === 'string' && result.id) return result.id;
  if (typeof result?.id?._serialized === 'string' && result.id._serialized) return result.id._serialized;
  const key = result?.key;
  if (typeof key?.id !== 'string' || !key.id || key.fromMe !== true || typeof key.remoteJid !== 'string') return undefined;
  const peer = canonicalPeer(key.remoteJid);
  if (!peer || !peer.endsWith('@c.us') && !peer.endsWith('@lid') || key.participant) return undefined;
  return `true_${peer}_${key.id}`;
}
export async function send(client: Client, text: string): Promise<string> {
  if (!(await getState()).clients.some(c=>c.id===client.id && c.chatId===client.chatId && c.enabled!==false)) throw new Error('Client is not allowed. Update WhatsApp setup.');
  if(clientChannel(client)==='telegram')return sendTelegram(client,text);
  if (config.WHATSAPP_PROVIDER === 'mock') return `mock:${randomUUID()}`;
  await verifyBusinessAccount();
  const result = await waha('/api/sendText', 'POST', { session: activeSession(), chatId: client.chatId, text });
  const id = sentResponseId(result);
  if (!id) throw new Error('Send outcome unknown');
  return `waha:${activeSession()}:${id}`;
}

export async function verifyBusinessAccount() {
  const ownerPhone=(await getState()).settings?.ownerPhone;
  if(!ownerPhone)throw new Error('Save your WhatsApp owner and client numbers in Settings first.');
  const me = await waha(`/api/sessions/${encodeURIComponent(activeSession())}/me`);
  const phone = String(me?.id || '').split('@')[0].split(':')[0].replace(/\D/g, '');
  if (!phone || phone !== ownerPhone.replace(/\D/g, '')) throw new Error('Linked WhatsApp account does not match the configured business owner.');
}
const pairings=new Map<string,ReturnType<typeof createPairingController>>();
function pairing(){const session=activeSession();let controller=pairings.get(session);if(!controller){controller=createPairingController(waha,verifyBusinessAccount,session);pairings.set(session,controller);}return controller;}
async function requireSetup(){if(!(await getState()).settings?.ownerPhone)throw new Error('Save your WhatsApp owner and client numbers in Settings first.');}
export async function startConnection(){await requireSetup();return pairing().start();}
export async function pairingQr(){await requireSetup();return pairing().qr();}

export async function connectionStatus() {
  if(!(await getState()).settings?.ownerPhone)return {status:'SETUP_REQUIRED',ownerVerified:false};
  const sessions = await waha('/api/sessions?all=true');
  const session = Array.isArray(sessions) ? sessions.find((s: any) => s.name === activeSession()) : undefined;
  if (!session) return { status: 'STOPPED', ownerVerified: false };
  if (session.status === 'WORKING') {
    try { await verifyBusinessAccount(); } catch (error) { if (!(error instanceof Error) || error.message !== 'Linked WhatsApp account does not match the configured business owner.') throw error; return { status: 'OWNER_MISMATCH', ownerVerified: false, error: 'Linked account does not match the business owner. Disconnect and pair the correct phone.' }; }
  }
  return { status: String(session.status), ownerVerified: session.status === 'WORKING' };
}
