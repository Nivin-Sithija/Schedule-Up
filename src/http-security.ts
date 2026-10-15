import type { FastifyInstance } from 'fastify';
import { WindowLimiter, RequestLimitError, operationLimits } from './limits.js';

export function installHttpSecurity(app:FastifyInstance, hosted:boolean, origins:string[]) {
  const requests=new WindowLimiter();
  app.addHook('onRequest',async(req,reply)=>{
    const path=req.url.split('?')[0];
    if(path.startsWith('/api') && path!=='/api/health')requests.consume(`ip:${req.ip}`,300,60000);
    if(!path.startsWith('/api') || !['POST','PUT','PATCH','DELETE'].includes(req.method) || path==='/api/webhooks/waha')return;
    if(req.headers['x-scheduleup']!=='dashboard' && req.headers['x-followthrough']!=='dashboard')return reply.code(403).send({error:'Dashboard request header required'});
    if(req.headers['sec-fetch-site']==='cross-site' || req.headers.origin && !origins.includes(req.headers.origin))return reply.code(403).send({error:'Untrusted origin'});
  });
  app.addHook('preHandler',async(req)=>{
    const account=(req as any).account;
    if(!account || !['POST','PUT','PATCH','DELETE'].includes(req.method))return;
    const path=req.url.split('?')[0];
    operationLimits.consume(`write:${account.id}`,60,60000);
    if(path==='/api/drafts' || /^\/api\/clients\/[^/]+\/retry$/.test(path))operationLimits.consume(`ai:${account.id}`,6,60000);
    if(path==='/api/send' || path==='/api/schedules')operationLimits.consume(`send:${account.id}`,12,60000);
    if(path.includes('/connection/') || ['/api/telegram/connect','/api/telegram/dialogs'].includes(path))operationLimits.consume(`connect:${account.id}`,10,60000);
  });
  app.addHook('onSend',async(_req,reply,payload)=>{
    reply.header('X-Content-Type-Options','nosniff').header('X-Frame-Options','DENY').header('Referrer-Policy','no-referrer').header('Permissions-Policy','camera=(), microphone=(), geolocation=(), payment=(), usb=()');
    if(hosted)reply.header('Strict-Transport-Security','max-age=31536000').header('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self' https://fonts.googleapis.com; style-src-attr 'unsafe-inline'; font-src 'self' https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self'; object-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'; upgrade-insecure-requests");
    return payload;
  });
}
export { RequestLimitError };
