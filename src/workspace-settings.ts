import { clientChannel } from './channels.js';
import { z } from 'zod';
import { randomUUID } from 'node:crypto';
import type { State } from './domain.js';
export const phoneSchema = z.string().trim().transform(value => value.replace(/[\s()-]/g, '')).pipe(z.string().regex(/^\+[1-9]\d{7,14}$/, 'Use an international number starting with + and country code'));
export const workspaceSetupSchema = z.object({
  ownerPhone: phoneSchema,
  clients: z.array(z.object({name:z.string().trim().min(1).max(100),phone:phoneSchema})).max(100),
}).superRefine((value,ctx)=>{
  const numbers = new Set<string>();
  for(const client of value.clients) {
    if(client.phone===value.ownerPhone)ctx.addIssue({code:'custom',message:'Owner and client numbers must differ'});
    if(numbers.has(client.phone))ctx.addIssue({code:'custom',message:'Client numbers must be unique'});
    numbers.add(client.phone);
  }
});
export function applyWorkspaceSetup(state:State, input:z.infer<typeof workspaceSetupSchema>) {
  const ownerChanged=state.settings?.ownerPhone!==input.ownerPhone;
  const allowed = new Set(input.clients.map(c=>`${c.phone.slice(1)}@c.us`));
  for(const client of state.clients) if(clientChannel(client)==='whatsapp')client.enabled=allowed.has(client.chatId);
  for(const row of input.clients) {
    const chatId=`${row.phone.slice(1)}@c.us`, existing=state.clients.find(c=>clientChannel(c)==='whatsapp'&&c.chatId===chatId);
    if(existing) {existing.name=row.name;existing.enabled=true;}
    else state.clients.push({id:randomUUID(),name:row.name,chatId,channel:'whatsapp',enabled:true});
  }
  for(const item of state.schedules) if(item.status==='approved'&&(ownerChanged||!state.clients.some(c=>c.id===item.clientId&&c.enabled!==false))) {
    item.status='paused';item.error='WhatsApp setup changed. Review before scheduling again.';
  }
  state.settings={...state.settings,ownerPhone:input.ownerPhone};
  if(ownerChanged)state.connection='disconnected';
}
