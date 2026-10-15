import type { Change, Message } from './domain.js';
const weekdays=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
export function calendarContext(sentAt:string,timezone:string) {
  const parts=new Intl.DateTimeFormat('en-CA',{timeZone:timezone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(sentAt));const p=Object.fromEntries(parts.map(x=>[x.type,x.value]));const day=`${p.year}-${p.month}-${p.day}`;const start=Date.parse(`${day}T00:00:00Z`);const dow=new Date(start).getUTCDay();
  const date=(offset:number)=>new Date(start+offset*86400000).toISOString().slice(0,10);
  return {localDate:day,weekday:weekdays[dow],today:day,tomorrow:date(1),dayAfterTomorrow:date(2),nextWeekdays:Object.fromEntries(weekdays.map((name,i)=>[name,date((i-dow+7)%7)]))};
}
export function resolveCalendar(changes:Change[],messages:Message[],timezone:string) {
  return changes.map(original=>{
    const c={...original};const evidence=messages.filter(m=>c.evidence.includes(m.id)).sort((a,b)=>Date.parse(a.sentAt)-Date.parse(b.sentAt));
    for(const m of evidence.reverse()) {
      const cal=calendarContext(m.sentAt,timezone);
      const text=deadlineClause(m.text,c.title).split(/\b(?:because|becuase|instead of)\b/)[0];
      const candidates:{index:number;date:string;ambiguous?:boolean}[]=[];
      const add=(match:RegExpMatchArray,date:string,ambiguous=false)=>{if(!/\bnot\s+(?:the\s+)?$/.test(text.slice(0,match.index)))candidates.push({index:match.index!,date,ambiguous});};
      for(const match of text.matchAll(/\b(\d{4}-\d{2}-\d{2})\b/g))add(match,match[1]);
      const months=['january','february','march','april','may','june','july','august','september','october','november','december'];
      for(const match of text.matchAll(/\b(\d{1,2})(?:st|nd|rd|th)?\s+(january|february|march|april|may|june|july|august|september|october|november|december)(?:\s+(\d{4}))?\b/g)) {
        const date=`${match[3]||cal.localDate.slice(0,4)}-${String(months.indexOf(match[2])+1).padStart(2,'0')}-${match[1].padStart(2,'0')}`;
        if(!Number.isNaN(Date.parse(date))&&new Date(date).toISOString().slice(0,10)===date)add(match,date);
      }
      for(const match of text.matchAll(/\b(?:by|on)\s+(?:the\s+)?(\d{1,2})(?:st|nd|rd|th)\b/g)){
        const day=+match[1];const date=new Date(`${cal.localDate}T00:00:00Z`);if(day<date.getUTCDate())date.setUTCMonth(date.getUTCMonth()+1,1);date.setUTCDate(day);if(date.getUTCDate()===day)add(match,date.toISOString().slice(0,10));
      }
      for(const match of text.matchAll(/\b(day after tomorrow|tomorrow|today)\b/g))add(match,match[1]==='day after tomorrow'?cal.dayAfterTomorrow:match[1]==='tomorrow'?cal.tomorrow:cal.today);
      for(const match of text.matchAll(/\b(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/g)){const name=weekdays.find(w=>w.toLowerCase()===match[1])!;add(match,cal.nextWeekdays[name],/next\s+$/.test(text.slice(0,match.index)));}
      const selected=candidates.sort((a,b)=>a.index-b.index)[0];
      if(selected?.ambiguous){c.explicit=false;c.status='review';c.reason='“Next” weekday needs owner confirmation.';return c;}
      const resolved=selected?.date;
      if(resolved && c.action!=='complete' && c.action!=='cancel') {
        const clock=text.match(/\b(?:by|at)\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/);
        if(clock && (clock[2]||clock[3]) && +(clock[2]||0)<60 && (clock[3]?(+clock[1]>=1&&+clock[1]<=12):+clock[1]<24)){const hour=clock[3]?+clock[1]%12+(clock[3]==='pm'?12:0):+clock[1];c.due=zonedDeadline(resolved,hour,+(clock[2]||0),timezone);}
        else if(!c.due || c.due.slice(0,10)!==resolved)c.due=resolved;
        return c;
      }
    }
    return c;
  });
}
function zonedDeadline(day:string,hour:number,minute:number,timezone:string) {
  const wall=Date.parse(`${day}T${String(hour).padStart(2,'0')}:${String(minute).padStart(2,'0')}:00Z`);let guess=wall;
  for(let i=0;i<3;i++){const p=Object.fromEntries(new Intl.DateTimeFormat('en-GB',{timeZone:timezone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(new Date(guess)).map(p=>[p.type,p.value]));guess+=wall-Date.UTC(+p.year,+p.month-1,+p.day,+p.hour,+p.minute,+p.second);}
  return new Date(guess).toISOString();
}

export function deadlineClause(text:string,title:string) {
  const lower=text.toLowerCase();const clauses=lower.split(/[.;]\s+|\b(?:and|but)\s+(?=(?:i|we|the|your)\b)/);
  const words=(title.toLowerCase().match(/[a-z0-9]+/g)||[]).filter(w=>w.length>2&&!['send','deliver','provide','the','for','with','revised'].includes(w));
  const scored=clauses.map(text=>({text,score:words.filter(w=>new RegExp(`\\b${w}\\b`).test(text)).length}));
  const best=Math.max(...scored.map(c=>c.score));const matches=scored.filter(c=>c.score===best);
  return best>0&&matches.length===1?matches[0].text:lower;
}
