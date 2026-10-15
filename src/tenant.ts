import { AsyncLocalStorage } from 'node:async_hooks';
const context = new AsyncLocalStorage<string>();
export function workspaceId() { const id=context.getStore(); if(!id)throw new Error('Workspace context required');return id; }
export function withWorkspace<T>(id:string,fn:()=>T):T { if(!/^(?:owner|[a-f0-9-]{36})$/.test(id))throw new Error('Invalid workspace');return context.run(id,fn); }
