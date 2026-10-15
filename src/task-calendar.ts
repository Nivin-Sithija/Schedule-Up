import type {Task} from './domain.js';
export function calendarDayOffset(day:string, today:string):number {
  return Math.round((Date.parse(`${day}T12:00:00Z`)-Date.parse(`${today}T12:00:00Z`))/86400000);
}
export function monthCalendar(month:string) {
  const first=new Date(`${month}-01T12:00:00Z`);
  first.setUTCDate(1-first.getUTCDay());
  return Array.from({length:42},(_,index)=>{
    const date=new Date(first);date.setUTCDate(date.getUTCDate()+index);
    const day=date.toISOString().slice(0,10);
    return {day,inMonth:day.startsWith(`${month}-`),label:date.getUTCDate()};
  });
}
export function calendarDate(value: string, timezone: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const parts=new Intl.DateTimeFormat('en',{timeZone:timezone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(value));
  const fields=Object.fromEntries(parts.map(p=>[p.type,p.value]));return `${fields.year}-${fields.month}-${fields.day}`;
}
export function fourDayCalendar(tasks:Task[], timezone:string, now=new Date(), startOffset=0) {
  const today=calendarDate(now.toISOString(),timezone);
  return Array.from({length:4},(_,offset)=>{
    const date=new Date(`${today}T12:00:00Z`);date.setUTCDate(date.getUTCDate()+startOffset+offset);const day=date.toISOString().slice(0,10);
    return {day,today:day===today,tasks:tasks.filter(t=>!['completed','cancelled'].includes(t.status)&&t.due&&calendarDate(t.due,timezone)===day).sort((a,b)=>(a.due||'').localeCompare(b.due||''))};
  });
}
