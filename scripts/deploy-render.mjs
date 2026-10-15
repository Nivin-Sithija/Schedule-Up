import { pathToFileURL } from 'node:url';

// Only the main-branch deploy job receives credentials. Never print API bodies,
// headers, secrets or environment-variable values in this script.
export async function deployRender({apiKey,serviceId,commit,repository,githubToken,request=fetch,wait=ms=>new Promise(r=>setTimeout(r,ms)),log=console.log}) {
  if(!apiKey || !/^srv-[a-z0-9]+$/.test(serviceId||'') || !/^[a-f0-9]{40}$/.test(commit||'') || !/^[\w.-]+\/[\w.-]+$/.test(repository||''))throw new Error('Deployment configuration is missing or invalid.');
  async function api(path,method='GET',body) {
    const r=await request(`https://api.render.com/v1${path}`,{method,headers:{Authorization:`Bearer ${apiKey}`,...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(30000)});
    if(!r.ok)throw new Error(`Render ${method} request failed (HTTP ${r.status}).`);
    const raw=await r.text();return raw?JSON.parse(raw):null;
  }
  const head=await request(`https://api.github.com/repos/${repository}/commits/main`,{headers:{Authorization:`Bearer ${githubToken}`,Accept:'application/vnd.github+json'},signal:AbortSignal.timeout(15000)});
  if(!head.ok)throw new Error('Could not verify the current main commit.');
  if((await head.json()).sha!==commit){log('Skipping superseded CI revision.');return;}
  const service=await api(`/services/${serviceId}`);
  if(service.suspended!=='not_suspended' || service.type!=='web_service' || service.repo?.replace(/\.git$/,'')!==`https://github.com/${repository}`)throw new Error('Refusing to deploy a suspended or unexpected service.');
  const list=async()=> (await api(`/services/${serviceId}/deploys?limit=20`)).map(x=>x.deploy);
  const existing=await list();
  if(existing.some(d=>['queued','build_in_progress','update_in_progress','pre_deploy_in_progress'].includes(d.status)))throw new Error('Another Render deployment is active. Retry after it finishes.');
  const previous=existing.find(d=>d.status==='live')?.commit?.id;
  if(!previous)throw new Error('A previous live revision is required for rollback.');

  async function rollout(sha) {
    const before=new Set((await list()).map(d=>d.id));
    log(`Deploying verified revision ${sha.slice(0,7)}; pausing the previous worker.`);
    const state=await api(`/services/${serviceId}`);
    if(state.suspended==='not_suspended')await api(`/services/${serviceId}/suspend`,'POST');
    // Render terminates the previous instance before the replacement starts.
    await wait(Math.max(35,(service.serviceDetails?.maxShutdownDelaySeconds||30)+5)*1000);
    await api(`/services/${serviceId}/resume`,'POST');
    let deploy;
    for(let i=0;i<20;i++){deploy=(await list()).find(d=>!before.has(d.id));if(deploy)break;await wait(1500);}
    if(!deploy)throw new Error('Render did not create a resumed deployment.');
    // Resume normally uses main. If main advanced, cancel that build and pin
    // the revision whose checks passed; never promote it merely for being newer.
    if(deploy.commit?.id!==sha){
      await api(`/services/${serviceId}/deploys/${deploy.id}/cancel`,'POST');
      const result=await api(`/services/${serviceId}/deploys`,'POST',{commitId:sha,clearCache:'do_not_clear'});
      deploy=result?.id?result:(await list()).find(d=>d.commit?.id===sha);
    }
    if(!deploy?.id)throw new Error('Pinned deployment was not created.');
    for(let i=0;i<80;i++){
      const current=await api(`/services/${serviceId}/deploys/${deploy.id}`);
      if(current.status==='live'){
        if(current.commit?.id!==sha)throw new Error('Live revision differs from the checked revision.');
        log(`Revision ${sha.slice(0,7)} is live.`);return;
      }
      if(['build_failed','update_failed','canceled','deactivated'].includes(current.status))throw new Error(`Deployment ${current.status}.`);
      await wait(7500);
    }
    await api(`/services/${serviceId}/deploys/${deploy.id}/cancel`,'POST');
    throw new Error('Deployment readiness timed out.');
  }
  try{await rollout(commit);}
  catch(error){
    log('Deployment failed. Restoring the previous verified live revision.');
    try{await rollout(previous);}catch{throw new Error('Deployment and rollback failed. Inspect the service in Render before retrying.');}
    throw new Error('Deployment failed; the previous live revision was restored.');
  }
}

if(process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href){
  try{await deployRender({apiKey:process.env.RENDER_API_KEY,serviceId:process.env.RENDER_SERVICE_ID,commit:process.env.GITHUB_SHA,repository:process.env.GITHUB_REPOSITORY,githubToken:process.env.GITHUB_TOKEN});}
  catch(error){console.error(error.message);process.exitCode=1;}
}
