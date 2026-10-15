export type Channel='whatsapp'|'telegram';
export function clientChannel(client?:{channel?:Channel}):Channel{return client?.channel||'whatsapp';}
export function channelLabel(channel:Channel){return channel==='telegram'?'Telegram':'WhatsApp';}
