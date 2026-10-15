import { readFile, writeFile, rename, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { config } from './config.js';
import { databasePool } from './database.js';
export type User={id:string;name:string;email:string;passwordHash:string;createdAt:string};
export type Session={hash:string;userId:string;expires:number;lastSeen:number};
type AuthData={revision:number;users:User[];sessions:Session[];limits:Record<string,{count:number;until:number}>};
const blank=():AuthData=>({revision:0,users:[],sessions:[],limits:{}});
const path=join(dirname(config.DATA_PATH),'accounts.json');
let tail:Promise<unknown>=Promise.resolve();
export async function initAuthStore(){
  if(config.STORE_DRIVER==='postgres'){
    await databasePool().query('CREATE TABLE IF NOT EXISTS ft_auth (id text PRIMARY KEY, revision bigint NOT NULL, state jsonb NOT NULL)');
    await databasePool().query("INSERT INTO ft_auth(id,revision,state) VALUES('accounts',0,$1::jsonb) ON CONFLICT(id) DO NOTHING",[JSON.stringify(blank())]);
  }else{await mkdir(dirname(path),{recursive:true});try{await writeFile(path,JSON.stringify(blank()),{flag:'wx',mode:0o600});}catch(error:any){if(error.code!=='EEXIST')throw error;}}
}
export async function readAuth():Promise<AuthData>{return config.STORE_DRIVER==='postgres'?(await databasePool().query("SELECT state FROM ft_auth WHERE id='accounts'")).rows[0].state:JSON.parse(await readFile(path,'utf8'));}
export function updateAuth<T>(fn:(data:AuthData)=>T):Promise<T>{
  const work=tail.then(async()=>{
    for(let attempt=0;attempt<25;attempt++){
      const data=await readAuth(),expected=data.revision,result=fn(data);data.revision++;
      if(config.STORE_DRIVER==='postgres'){
        const result=await databasePool().query("UPDATE ft_auth SET revision=$1,state=$2::jsonb WHERE id='accounts' AND revision=$3",[data.revision,JSON.stringify(data),expected]);if(!result.rowCount)continue;
      }else{await writeFile(path+'.tmp',JSON.stringify(data),{mode:0o600});await rename(path+'.tmp',path);}
      return result;
    }throw new Error('Account update busy; try again');
  });tail=work.catch(()=>{});return work;
}
