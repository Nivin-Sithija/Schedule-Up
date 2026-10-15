import { withWorkspace } from '../src/tenant.js';
const probeWorkspace=randomUUID();
import { Connection } from '@temporalio/client';
import { randomUUID } from 'node:crypto';
const result: { component: string; status: string; detail: string }[] = [];
async function check(component: string, fn: () => Promise<string>) {
  try { result.push({ component, status: 'PASS', detail: await fn() }); }
  catch (error: any) { result.push({ component, status: 'FAIL', detail: error.code || error.name || 'Connection failed' }); }
}
await check('Gemma / Ollama', async () => {
  const url = (process.env.OLLAMA_BASE_URL || 'http://localhost:11434/v1').replace(/\/$/, '');
  const response = await fetch(`${url}/chat/completions`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ model: process.env.OLLAMA_MODEL || 'gemma4:12b', messages: [{ role: 'user', content: 'Reply with the single word READY.' }], max_tokens: 16, temperature: 0, reasoning_effort: 'none' }), signal: AbortSignal.timeout(180000) });
  if (!response.ok) throw new Error('Ollama request failed');
  const data = await response.json() as any; if (!data.choices?.[0]?.message?.content?.trim()) throw new Error('Empty model response');
  return 'Local model returned a response';
});
await check('Tiger workspace persistence', async () => withWorkspace(probeWorkspace,async () => {
  const { initStore, getState, mutate, closeStore } = await import('../src/store.js');
  await initStore();const {createWorkspace}=await import('../src/store.js');await createWorkspace(); const before = await getState();
  await mutate(s => { if (!Array.isArray(s.tasks)) throw new Error('Invalid workspace state'); });
  const after = await getState(); if (after.revision <= before.revision) throw new Error('Workspace write failed');
  return 'Workspace read and optimistic-revision write passed';
}));
await check('Tiger hybrid retrieval', async () => withWorkspace(probeWorkspace,async () => {
  if (!process.env.TIGER_DATABASE_URL) throw new Error('Missing connection');
  const { initRetrieval, indexMessages, search } = await import('../src/retrieval.js');
  const id = `probe-${randomUUID()}`, clientId = `probe-client-${randomUUID()}`;
  await initRetrieval(); const { databasePool } = await import('../src/database.js'); const pool = databasePool();
  try { await indexMessages([{id, clientId, speaker: 'owner', text: 'I will send the revised proposal on Friday.', sentAt: new Date().toISOString(), origin: 'mock'}]);
    const rows = await search(clientId, 'revised proposal'); if (!rows.some((r: any) => r.id === id)) throw new Error('Retrieval mismatch');
    return 'Local embedding, pgvector write and hybrid search passed';
  } finally { await pool.query('DELETE FROM ft_chunks_v2 WHERE id=$1 AND client_id=$2 AND workspace_id=$3', [id, clientId,probeWorkspace]); }
}));
await check('Temporal', async () => {
  const connection = await Connection.connect({address:process.env.TEMPORAL_ADDRESS || 'localhost:7233', connectTimeout:10000});
  try { await connection.workflowService.describeNamespace({namespace:process.env.TEMPORAL_NAMESPACE || 'default'}); return 'Service and namespace reachable'; } finally { await connection.close(); }
});
await check('WhatsApp connector', async () => {
  const response = await fetch(`${process.env.WAHA_URL || 'http://localhost:3000'}/api/sessions?all=true`, {headers:{'X-Api-Key':process.env.WAHA_API_KEY || '', Accept:'application/json'},signal:AbortSignal.timeout(10000)});
  if (!response.ok) throw new Error('Connector request failed');
  const sessions = await response.json() as any[]; const session = sessions.find(s=>s.name === (process.env.WAHA_SESSION || 'default'));
  if (!session) return 'Connector reachable; create/pair the owner session in Settings';
  return `Connector reachable; session ${session.status}`;
});
if(process.env.STORE_DRIVER==='postgres'&&process.env.TIGER_DATABASE_URL){const {databasePool}=await import('../src/database.js');await databasePool().query('DELETE FROM ft_workspace WHERE id=$1',[probeWorkspace]);}else{const {rm}=await import('node:fs/promises');const {join,dirname}=await import('node:path');await rm(join(dirname(process.env.DATA_PATH||'./data/state.json'),'workspaces',probeWorkspace+'.json'),{force:true});}
const { closeDatabase } = await import('../src/database.js'); await closeDatabase();
console.table(result);
const failed = result.some(r=>r.status === 'FAIL');
process.exit(failed ? 1 : 0);
