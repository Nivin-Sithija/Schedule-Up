import { withWorkspace } from './tenant.js';
import { processBatch, deliverSchedule, reminders } from './service.js';
import type { Message } from './domain.js';
export const tenantActivities={
  processBatch:(tenant:string,batch:Message[])=>withWorkspace(tenant,()=>processBatch(batch)),
  deliverSchedule:(tenant:string,id:string)=>withWorkspace(tenant,()=>deliverSchedule(id)),
  reminders:(tenant:string)=>withWorkspace(tenant,()=>reminders()),
};
