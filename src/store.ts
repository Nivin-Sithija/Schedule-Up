import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { config } from './config.js';
import { emptyState, type State } from './domain.js';
import { databasePool, closeDatabase } from './database.js';
import { workspaceId } from './tenant.js';
const initial = () => emptyState([]);
const filePath = () => workspaceId()==='owner' ? config.DATA_PATH : join(dirname(config.DATA_PATH),'workspaces',`${workspaceId()}.json`);
const tails=new Map<string,Promise<unknown>>();
export async function initStore() {
  if (config.STORE_DRIVER === 'postgres') await databasePool().query('CREATE TABLE IF NOT EXISTS ft_workspace (id text PRIMARY KEY, revision bigint NOT NULL, state jsonb NOT NULL, updated_at timestamptz NOT NULL DEFAULT now())');
  else await mkdir(dirname(config.DATA_PATH),{recursive:true});
}
export async function createWorkspace() {
  const id=workspaceId();
  if(config.STORE_DRIVER==='postgres') await databasePool().query('INSERT INTO ft_workspace(id,revision,state) VALUES($1,0,$2::jsonb) ON CONFLICT(id) DO NOTHING',[id,JSON.stringify(initial())]);
  else {const path=filePath();await mkdir(dirname(path),{recursive:true});try{await writeFile(path,JSON.stringify(initial()),{flag:'wx',mode:0o600});}catch(error:any){if(error.code!=='EEXIST')throw error;}}
}
export async function getState(): Promise<State> {
  if (config.STORE_DRIVER === 'postgres') {
    const result = await databasePool().query('SELECT state FROM ft_workspace WHERE id=$1', [workspaceId()]);
    if (!result.rows[0]) throw new Error('Workspace missing'); return result.rows[0].state;
  }
  return JSON.parse(await readFile(filePath(), 'utf8'));
}
export function mutate<T>(fn: (s: State) => T): Promise<T> {
  const id=workspaceId();
  const work = (tails.get(id)||Promise.resolve()).then(async () => {
    for (let attempt = 0; attempt < 20; attempt++) {
      const s = await getState(); const expected = s.revision; const result = fn(s); s.revision++;
      if (Buffer.byteLength(JSON.stringify(s)) > 12_000_000) throw new Error('Pilot workspace storage limit reached');
      if (config.STORE_DRIVER === 'postgres') {
        const saved = await databasePool().query('UPDATE ft_workspace SET revision=$1,state=$2::jsonb,updated_at=now() WHERE id=$3 AND revision=$4', [s.revision,JSON.stringify(s),id,expected]);
        if (saved.rowCount === 0) continue;
      } else { const path=filePath(),tmp=`${path}.tmp`; await writeFile(tmp, JSON.stringify(s),{mode:0o600}); await rename(tmp,path); }
      return result;
    }
    throw new Error('Concurrent workspace updates; retry');
  }); const tail=work.catch(()=>{});tails.set(id,tail);void tail.finally(()=>{if(tails.get(id)===tail)tails.delete(id);});return work;
}
export async function listWorkspaces():Promise<string[]> {
  if(config.STORE_DRIVER==='postgres')return (await databasePool().query("SELECT id FROM ft_workspace WHERE id <> 'owner'")).rows.map(row=>row.id);
  const {readdir}=await import('node:fs/promises');try{return (await readdir(join(dirname(config.DATA_PATH),'workspaces'))).filter(p=>/^[a-f0-9-]{36}\.json$/.test(p)).map(p=>p.slice(0,-5));}catch(error:any){if(error.code==='ENOENT')return [];throw error;}
}
export async function closeStore() { await closeDatabase(); }
