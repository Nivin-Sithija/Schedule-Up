import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { mkdir, readFile, writeFile, rename, unlink } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { config } from './config.js';
import { databasePool } from './database.js';
import { workspaceId } from './tenant.js';
const root=join(dirname(config.DATA_PATH),'connections');
let keyPromise:Promise<Buffer>|undefined;
async function key(){
  return keyPromise ||= (async()=>{
    if(config.SESSION_ENCRYPTION_KEY){if(!/^[a-f\d]{64}$/i.test(config.SESSION_ENCRYPTION_KEY))throw new Error('SESSION_ENCRYPTION_KEY must contain 64 hexadecimal characters');return Buffer.from(config.SESSION_ENCRYPTION_KEY,'hex');}
    if(config.hosted)throw new Error('Telegram requires SESSION_ENCRYPTION_KEY in production');
    await mkdir(root,{recursive:true});const path=join(root,'encryption.key');
    try{await writeFile(path,randomBytes(32),{flag:'wx',mode:0o600});}catch(error:any){if(error.code!=='EEXIST')throw error;}
    const value=await readFile(path);if(value.length!==32)throw new Error('Invalid local session encryption key');return value;
  })();
}
export function sealSession(value:string,key:Buffer,tenant:string){const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',key,iv);cipher.setAAD(Buffer.from(`telegram:${tenant}:v1`));const encrypted=Buffer.concat([cipher.update(value,'utf8'),cipher.final()]);return ['v1',iv.toString('base64'),cipher.getAuthTag().toString('base64'),encrypted.toString('base64')].join('.');}
export function openSession(value:string,key:Buffer,tenant:string){const [version,iv,tag,data]=value.split('.');if(version!=='v1'||!iv||!tag||!data)throw new Error('Invalid encrypted session');const decipher=createDecipheriv('aes-256-gcm',key,Buffer.from(iv,'base64'));decipher.setAAD(Buffer.from(`telegram:${tenant}:v1`));decipher.setAuthTag(Buffer.from(tag,'base64'));return Buffer.concat([decipher.update(Buffer.from(data,'base64')),decipher.final()]).toString('utf8');}
export async function ensureSessionEncryption(){await key();}
export async function initSessionSecrets(){if(config.STORE_DRIVER==='postgres')await databasePool().query('CREATE TABLE IF NOT EXISTS ft_channel_sessions (workspace_id text PRIMARY KEY, telegram_session text NOT NULL)');else await mkdir(root,{recursive:true});}
export async function readTelegramSession(){const id=workspaceId();let encrypted:string|undefined;if(config.STORE_DRIVER==='postgres')encrypted=(await databasePool().query('SELECT telegram_session FROM ft_channel_sessions WHERE workspace_id=$1',[id])).rows[0]?.telegram_session;else try{encrypted=await readFile(join(root,id+'.telegram'),'utf8');}catch(error:any){if(error.code!=='ENOENT')throw error;}return encrypted?openSession(encrypted,await key(),id):'';}
export async function saveTelegramSession(value:string){const id=workspaceId(),encrypted=sealSession(value,await key(),id);if(config.STORE_DRIVER==='postgres')await databasePool().query('INSERT INTO ft_channel_sessions(workspace_id,telegram_session) VALUES($1,$2) ON CONFLICT(workspace_id) DO UPDATE SET telegram_session=EXCLUDED.telegram_session',[id,encrypted]);else{const path=join(root,id+'.telegram');await writeFile(path+'.tmp',encrypted,{mode:0o600});await rename(path+'.tmp',path);}}
export async function clearTelegramSession(){if(config.STORE_DRIVER==='postgres')await databasePool().query('DELETE FROM ft_channel_sessions WHERE workspace_id=$1',[workspaceId()]);else try{await unlink(join(root,workspaceId()+'.telegram'));}catch(error:any){if(error.code!=='ENOENT')throw error;}}
