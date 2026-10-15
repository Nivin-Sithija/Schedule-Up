import { config } from '../src/config.js';
import { extract } from '../src/ai.js';
import { validateChanges, type Message } from '../src/domain.js';
if(config.AI_PROVIDER!=='ollama') throw new Error('Local evaluation refuses hosted inference. Set AI_PROVIDER=ollama.');
const scenarios=[
  {text:'I will send you the proposal on Friday.',speaker:'owner',expect:'open',due:'2026-10-16'},
  {text:'Could we perhaps launch next week?',speaker:'client',expect:'review'},
  {text:'Could you send the logo?',speaker:'owner',expect:'waiting'},
  {text:'Thank you!',speaker:'client',expect:'none'},
] as const;
let passed=0;
for(const [i,s] of scenarios.entries()) {const m:Message={id:`eval-${i}`,clientId:'eval',speaker:s.speaker,text:s.text,sentAt:'2026-10-13T09:00:00+05:30',origin:'mock'};const start=Date.now();try{const changes=await extract({timezone:config.APP_TIMEZONE,newMessageIds:[m.id],messages:[m],tasks:[],agreements:[]});validateChanges(changes,[m],[],'eval');const actual=changes.length?changes[0].explicit?changes[0].status:'review':'none';const ok=actual===s.expect&&(!('due' in s)||changes[0]?.due===s.due);passed+=Number(ok);console.log(JSON.stringify({scenario:i+1,passed:ok,expected:s.expect,actual,latencyMs:Date.now()-start,changes}));}catch(e){console.log(JSON.stringify({scenario:i+1,passed:false,error:e instanceof Error?e.message:'failure'}));}}
console.log(`${passed}/${scenarios.length} smoke scenarios passed. This is not the 40-case pilot evaluation.`);if(passed<scenarios.length)process.exitCode=1;
