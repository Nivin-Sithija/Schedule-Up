import {mkdir,readFile,writeFile,chmod} from 'node:fs/promises';
import {resolve} from 'node:path';
// Local files only. Never uploads secrets or prints their values.
const root=resolve('data/deploy');await mkdir(root,{recursive:true,mode:0o700});await chmod(root,0o700);
const app:Record<string,string>={};
for(const key of ['OPENROUTER_API_KEY','TIGER_DATABASE_URL','TELEGRAM_API_ID','TELEGRAM_API_HASH','WAHA_API_KEY','WAHA_WEBHOOK_HMAC_KEY','SENTRY_DSN'])app[key]=process.env[key]||'';
app.TIGER_CA_BASE64=process.env.TIGER_CA_BASE64|| (process.env.TIGER_CA_PATH?Buffer.from(await readFile(process.env.TIGER_CA_PATH)).toString('base64'):'');
app.SESSION_ENCRYPTION_KEY=process.env.SESSION_ENCRYPTION_KEY||'';
if(!app.SESSION_ENCRYPTION_KEY){try{const key=await readFile(resolve('data/connections/encryption.key'));if(key.length!==32)throw new Error('Invalid existing Telegram encryption key');app.SESSION_ENCRYPTION_KEY=key.toString('hex');}catch(e:any){if(e.code!=='ENOENT')throw e;}}
const connector={WAHA_API_KEY:app.WAHA_API_KEY,WHATSAPP_HOOK_HMAC_KEY:app.WAHA_WEBHOOK_HMAC_KEY,WHATSAPP_HOOK_URL:''};
for(const [file,values]of [['render-app.env',app],['render-waha.env',connector]] as const){const path=resolve(root,file);await writeFile(path,Object.entries(values).map(([key,value])=>`${key}=${JSON.stringify(value)}`).join('\n')+'\n',{mode:0o600});await chmod(path,0o600);}
console.log('Prepared private data/deploy/render-app.env and render-waha.env. No values printed.');
console.log('Missing app values:',Object.entries(app).filter(([,value])=>!value).map(([key])=>key).join(', ')||'none');
console.log('Set APP_ORIGINS in Render to the exact HTTPS origin. Set the WAHA webhook URL after choosing the hosted app URL.');
