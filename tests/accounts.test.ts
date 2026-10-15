import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawn, type ChildProcess } from 'node:child_process';
import { createServer } from 'node:net';
import { workspaceSetupSchema, applyWorkspaceSetup } from '../src/workspace-settings.js';
import { emptyState } from '../src/domain.js';
import { withWorkspace, workspaceId } from '../src/tenant.js';

test('workspace context fails closed and stays isolated across concurrent requests',async()=>{
  assert.throws(()=>workspaceId(),/context required/);
  const ids=['11111111-1111-1111-1111-111111111111','22222222-2222-2222-2222-222222222222'];
  const actual=await Promise.all(ids.map(id=>withWorkspace(id,async()=>{await new Promise(r=>setTimeout(r,5));return workspaceId();})));
  assert.deepEqual(actual,ids);assert.throws(()=>workspaceId(),/context required/);
});
test('number setup preserves client identity and pauses removed-client sends',()=>{
  assert.equal(workspaceSetupSchema.safeParse({ownerPhone:'+15551230000',clients:[{name:'Self',phone:'+15551230000'}]}).success,false);
  assert.equal(workspaceSetupSchema.safeParse({ownerPhone:'+15551230000',clients:[{name:'A',phone:'+15551230001'},{name:'B',phone:'+15551230001'}]}).success,false);
  const state=emptyState([{id:'kept',name:'Old',chatId:'15551230001@c.us'},{id:'removed',name:'Other',chatId:'15551230002@c.us'}]);
  state.settings={ownerPhone:'+15551230000'};
  state.schedules.push({id:'schedule',clientId:'removed',taskId:'task',taskRevision:1,text:'Hello',at:new Date().toISOString(),approvedSeq:0,status:'approved'});
  applyWorkspaceSetup(state,workspaceSetupSchema.parse({ownerPhone:'+1 (555) 123-0000',clients:[{name:'Updated',phone:'+15551230001'}]}));
  assert.equal(state.clients[0].id,'kept');assert.equal(state.clients[0].name,'Updated');assert.equal(state.clients[1].enabled,false);assert.equal(state.schedules[0].status,'paused');
});

test('accounts persist, isolate workspaces, revoke sessions, and reject forged access',{timeout:60000},async()=>{
  const directory=await mkdtemp(join(tmpdir(),'followthrough-accounts-'));
  const probe=createServer();await new Promise<void>(r=>probe.listen(0,'127.0.0.1',r));const port=(probe.address() as any).port;await new Promise<void>(r=>probe.close(()=>r()));
  const base=`http://127.0.0.1:${port}`;let child:ChildProcess;let logs='';
  async function start(){
    child=spawn(process.execPath,['--import','tsx','src/server.ts'],{cwd:resolve('.'),env:{...process.env,NODE_ENV:'development',PORT:String(port),HOST:'127.0.0.1',STORE_DRIVER:'file',DATA_PATH:join(directory,'state.json'),TIGER_DATABASE_URL:'',DURABLE_MODE:'local',WHATSAPP_PROVIDER:'mock',AI_PROVIDER:'ollama',APP_ORIGINS:base},stdio:['ignore','pipe','pipe']});
    child.stdout?.on('data',chunk=>{logs+=chunk;});child.stderr?.on('data',chunk=>{logs+=chunk;});
    for(let n=0;n<80;n++){if(child.exitCode!==null)throw new Error('Test server exited: '+logs.slice(-1000));try{if((await fetch(base+'/api/health')).ok)return;}catch{}await new Promise(r=>setTimeout(r,100));}throw new Error('Test server timed out');
  }
  async function stop(){if(!child||child.exitCode!==null)return;await new Promise<void>(resolve=>{const timer=setTimeout(()=>child.kill('SIGKILL'),5000);child.once('exit',()=>{clearTimeout(timer);resolve();});child.kill('SIGTERM');});}
  async function call(path:string,method='GET',body?:unknown,cookie?:string,origin?:string){const response=await fetch(base+'/api'+path,{method,headers:{...(body===undefined?{}:{'Content-Type':'application/json'}),'X-ScheduleUp':'dashboard',...(cookie?{Cookie:cookie}:{}),...(origin?{Origin:origin}:{})},body:body===undefined?undefined:JSON.stringify(body)});return {status:response.status,body:await response.json() as any,setCookie:response.headers.get('set-cookie'),cookie:response.headers.get('set-cookie')?.split(';')[0]};}
  try{
    await start();assert.equal((await call('/state')).status,401);
    assert.equal((await call('/auth/register','POST',{name:'Weak',email:'weak@example.test',password:'short'})).status,400);
    const password='Long test passphrase 847!',a=await call('/auth/register','POST',{name:'Alice',email:'Alice@example.test',password}),b=await call('/auth/register','POST',{name:'Bob',email:'bob@example.test',password});
    assert.equal(a.status,200);assert.equal(b.status,200);assert.ok(a.cookie);assert.match(a.setCookie!,/HttpOnly/);assert.match(a.setCookie!,/SameSite=Strict/);assert.notEqual(a.body.user.id,b.body.user.id);assert.equal(a.body.user.passwordHash,undefined);
    const setup={ownerPhone:'+15551230000',clients:[{name:'Client A',phone:'+15551230001'}]};
    assert.equal((await call('/setup','PUT',setup,a.cookie)).status,200);
    const client=(await call('/state','GET',undefined,a.cookie)).body.clients[0];
    const extra=await call('/clients','POST',{name:'Second client',phone:'+15551230002'},a.cookie);assert.equal(extra.status,200);
    assert.equal((await call('/clients','POST',{name:'Duplicate',phone:'+15551230002'},a.cookie)).status,400);
    assert.equal((await call('/clients/'+extra.body.id,'DELETE',undefined,b.cookie)).status,400);
    assert.equal((await call('/clients/'+extra.body.id,'DELETE',undefined,a.cookie)).status,200);
    assert.equal((await call('/state','GET',undefined,a.cookie)).body.clients.find((c:any)=>c.id===extra.body.id).enabled,false);
    const restored=await call('/clients','POST',{name:'Restored client',phone:'+15551230002'},a.cookie);assert.equal(restored.body.id,extra.body.id);
    const task=await call('/tasks','POST',{clientId:client.id,title:'Alice private task'},a.cookie);assert.equal(task.status,200);
    assert.equal((await call('/tasks/'+task.body.id,'PATCH',{revision:1,status:'completed'},b.cookie)).status,400);
    assert.deepEqual((await call('/state','GET',undefined,b.cookie)).body.clients,[]);
    assert.equal((await call('/state','GET',undefined,b.cookie)).body.tasks.length,0);
    assert.equal((await call('/state','GET',undefined,'ft_session=forged')).status,401);
    assert.equal((await call('/templates','POST',{title:'Attack',text:'No'},a.cookie,'https://untrusted.example')).status,403);
    assert.equal((await call('/auth/login','POST',{email:'alice@example.test',password:'incorrect'})).status,401);
    await stop();await start();
    const aState=(await call('/state','GET',undefined,a.cookie)).body;assert.equal(aState.tasks[0].title,'Alice private task');assert.equal(aState.settings.ownerPhone,setup.ownerPhone);
    const second=await call('/auth/login','POST',{email:'alice@example.test',password});assert.equal(second.status,200);
    const changed=await call('/auth/password','POST',{currentPassword:password,password:'Another long passphrase 926!'},second.cookie);assert.equal(changed.status,200);
    assert.equal((await call('/state','GET',undefined,a.cookie)).status,401);assert.equal((await call('/state','GET',undefined,second.cookie)).status,401);
    assert.equal((await call('/state','GET',undefined,changed.cookie)).status,200);
    assert.equal((await call('/auth/logout','POST',{},changed.cookie)).status,200);assert.equal((await call('/state','GET',undefined,changed.cookie)).status,401);
    let limited;for(let i=0;i<5;i++)limited=await call('/auth/register','POST',{name:'Weak',email:'weak@example.test',password:'short'});assert.equal(limited!.status,429);
    const stored=JSON.parse(await readFile(join(directory,'accounts.json'),'utf8'));assert.ok(stored.users.every((u:any)=>u.passwordHash.startsWith('scrypt$')));assert.equal(JSON.stringify(stored).includes(password),false);assert.equal(JSON.stringify(stored).includes(changed.cookie!.split('=')[1]),false);
  }finally{await stop();await rm(directory,{recursive:true,force:true});}
});
