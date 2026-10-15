import test from 'node:test';
import assert from 'node:assert/strict';
import { deployRender } from '../scripts/deploy-render.mjs';

const current='a'.repeat(40), previous='b'.repeat(40);
function fixture({stale=false,fail=false}={}){
  let suspended=false,deploys=[{id:'old',status:'live',commit:{id:previous}}],resumes=0;
  const calls=[];
  const request=async(url,options={})=>{
    const method=options.method||'GET',path=new URL(url).pathname;calls.push([method,path]);
    let result;
    if(url.includes('api.github.com'))result={sha:stale?previous:current};
    else if(path.endsWith('/suspend')){suspended=true;return new Response(null,{status:202});}
    else if(path.endsWith('/resume')){suspended=false;resumes++;deploys.unshift({id:`new${resumes}`,status:fail&&resumes===1?'build_failed':'live',commit:{id:current}});return new Response(null,{status:202});}
    else if(path.endsWith('/cancel'))return new Response(null,{status:202});
    else if(path.endsWith('/deploys')&&method==='POST'){result={id:'pinned',status:'live',commit:{id:JSON.parse(options.body).commitId}};deploys.unshift(result);}
    else if(path.endsWith('/deploys'))result=deploys.map(deploy=>({deploy}));
    else if(path.includes('/deploys/'))result=deploys.find(d=>path.endsWith('/'+d.id));
    else result={type:'web_service',suspended:suspended?'suspended':'not_suspended',repo:'https://github.com/example/scheduleup'};
    return Response.json(result);
  };
  return {calls,args:{apiKey:'test-secret',serviceId:'srv-test',commit:current,repository:'example/scheduleup',githubToken:'test-token',request,wait:async()=>{},log:()=>{}}};
}
test('deployment skips superseded commits without changing Render',async()=>{
  const f=fixture({stale:true});await deployRender(f.args);assert.equal(f.calls.length,1);
});
test('deployment pauses the old worker and verifies the checked commit is live',async()=>{
  const f=fixture();await deployRender(f.args);assert.ok(f.calls.some(([m,p])=>m==='POST'&&p.endsWith('/suspend')));assert.ok(f.calls.some(([m,p])=>m==='POST'&&p.endsWith('/resume')));
});
test('failed deployment pins and restores the previous live revision',async()=>{
  const f=fixture({fail:true});await assert.rejects(deployRender(f.args),/previous live revision was restored/);assert.ok(f.calls.some(([m,p])=>m==='POST'&&p.endsWith('/cancel')));assert.ok(f.calls.some(([m,p])=>m==='POST'&&p.endsWith('/deploys')));
});
test('deployment rejects missing configuration before making a request',async()=>{
  const f=fixture();await assert.rejects(deployRender({...f.args,apiKey:''}),/configuration/);assert.equal(f.calls.length,0);
});
