import React, { useCallback, useEffect, useRef, useState } from 'react';
type Toast = {id: string; type: 'success' | 'error' | 'info'; text: string};
export function useToasts() {
  const [items,setItems] = useState<Toast[]>([]);
  const timers = useRef(new Map<string,ReturnType<typeof setTimeout>>());
  const recent = useRef(new Map<string,number>());
  const dismiss = useCallback((id:string) => {clearTimeout(timers.current.get(id));timers.current.delete(id);setItems(list=>list.filter(t=>t.id!==id));},[]);
  const notify = useCallback((text:string,type:Toast['type']='success',key?:string) => {
    const identity=key || `${type}:${text}`,now=Date.now();
    if(now-(recent.current.get(identity)||0)<10000)return;
    recent.current.set(identity,now);
    for(const [k,at] of recent.current)if(now-at>60000)recent.current.delete(k);
    const id=crypto.randomUUID();setItems(list=>[...list,{id,type,text}].slice(-4));
    timers.current.set(id,setTimeout(()=>dismiss(id),type==='error'?10000:6000));
  },[dismiss]);
  useEffect(()=>()=>{for(const timer of timers.current.values())clearTimeout(timer);},[]);
  return {notify, display:<div className="toast-stack" aria-label="Notifications">{items.map(t=><div key={t.id} className={`toast toast-${t.type}`} role={t.type==='error'?'alert':'status'}><span className="toast-icon" aria-hidden="true">{t.type==='success'?'✓':t.type==='error'?'!':'i'}</span><p>{t.text}</p><button type="button" aria-label="Dismiss notification" onClick={()=>dismiss(t.id)}>×</button></div>)}</div>};
}
