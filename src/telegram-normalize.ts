import type { Client,Message } from './domain.js';
import { clientChannel } from './channels.js';
export type TelegramText={peerId:string;id:number;out:boolean;text:string;date:number;private:boolean};
export function normalizeTelegram(message:TelegramText,clients:Client[],tenant:string):Message|null{
  if(!message.private||!/^\d+$/.test(message.peerId)||!Number.isSafeInteger(message.id)||message.id<=0||!message.text?.trim()||!Number.isFinite(message.date))return null;
  const client=clients.find(c=>clientChannel(c)==='telegram'&&c.enabled!==false&&c.chatId===message.peerId);
  if(!client)return null;const date=new Date(message.date*1000);if(Number.isNaN(date.getTime()))return null;
  return {id:`telegram:${tenant}:${message.peerId}:${message.id}`,clientId:client.id,channel:'telegram',speaker:message.out?'owner':'client',text:message.text.slice(0,4000),sentAt:date.toISOString(),origin:'phone'};
}
