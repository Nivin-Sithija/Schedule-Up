import type { Change, Message, Task, Proposal } from './domain.js';
import {deadlineClause} from './calendar.js';
export function pendingRequestChanges(changes:Change[],tasks:Task[],requests:Proposal[]) {
  return changes.map(c=>{
    if(c.action!=='update' || tasks.some(t=>t.id===c.taskId))return c;
    const request=requests.find(p=>p.change.responsible===c.responsible && (p.change.title.toLowerCase().trim()===c.title.toLowerCase().trim() || p.change.evidence.some(id=>c.evidence.includes(id))));
    return request?{...c,action:'create' as const,taskId:null,evidence:[...new Set([...request.change.evidence,...c.evidence])].slice(-10)}:c;
  });
}
export function responsibilityGuard(changes:Change[],messages:Message[]) {
  return changes.map(original=>{
    const c={...original}; if(c.action!=='create'&&c.action!=='update')return c;
    const evidence=messages.filter(m=>c.evidence.includes(m.id)).sort((a,b)=>Date.parse(b.sentAt)-Date.parse(a.sentAt));
    const source=evidence[0];if(!source)return c;
    if(source.speaker==='owner' && /^\s*(?:can|could|may)\s+i\b/i.test(source.text)) {
      c.explicit=false;c.status='review';c.reason='Owner proposed a change; client agreement is still pending.';return c;
    }
    if(c.action!=='create')return c;
    if(/^\s*(?:(?:could|can|would|will)\s+you\b|please\s)/i.test(source.text)) {
      c.responsible=source.speaker==='owner'?'client':'owner';
      if(source.speaker==='owner' && c.explicit)c.status='waiting';
      if(source.speaker==='client'){c.explicit=false;c.status='review';c.reason='Client request; owner commitment has not yet been confirmed.';}
    } else if(/^\s*i(?:'ll| will| am going to)\b/i.test(source.text)) {
      c.responsible=source.speaker;if(c.explicit)c.status=source.speaker==='owner'?'open':'waiting';
    }
    return c;
  });
}

export function completionGuard(changes:Change[],messages:Message[],tasks:Task[],newMessageIds:string[]) {
  const fresh=new Set(newMessageIds);
  return changes.map(original=>{
    if(original.action!=='complete' && !(original.action==='update'&&original.status==='completed'))return original;
    const c={...original,action:'complete' as const};const task=tasks.find(t=>t.id===c.taskId);
    const proof=messages.filter(m=>fresh.has(m.id)&&c.evidence.includes(m.id));
    const clear=task && proof.some(m=>{
      const text=deadlineClause(m.text,task.title);
      if(/[?]|\b(?:not|never|haven['’]?t|hasn['’]?t|didn['’]?t|will|would|could|can|please|going to|pending)\b|\b(?:i|we|you|they|he|she)['’]ll\b/i.test(text))return false;
      const finished=/\b(?:sent|delivered|completed|finished|received|uploaded|submitted|paid|provided|done)\b/i.test(text);
      if(!finished)return false;
      if(m.speaker!==task.responsible && m.speaker!=='owner' && !/\b(?:received|got|delivered)\b/i.test(text))return false;
      if(tasks.length===1)return true;
      const score=(candidate:Task)=>(candidate.title.toLowerCase().match(/[a-z0-9]+/g)||[]).filter(w=>w.length>3&&!['send','sent','deliver','delivery','supply','provide','complete','finished','task','with','from','that','this'].includes(w)&&text.includes(w)).length;
      const best=Math.max(...tasks.map(score));return best>0 && score(task)===best && tasks.filter(t=>score(t)===best).length===1;
    });
    if(!clear){c.explicit=false;c.status='review';c.reason='Completion needs a clear new message confirming this task was finished.';}
    return c;
  });
}
