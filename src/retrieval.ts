import { workspaceId } from './tenant.js';
import { databasePool } from './database.js';
import { config } from './config.js';
import type { Message } from './domain.js';
import { trace } from './telemetry.js';
const pool = config.TIGER_DATABASE_URL ? databasePool() : undefined;
let embedder: any;
async function embed(text: string): Promise<number[]> {
  if (!embedder) { const moduleName = '@huggingface/transformers'; const { pipeline,env } = await import(moduleName); if(config.EMBEDDING_CACHE_PATH)env.cacheDir=config.EMBEDDING_CACHE_PATH; embedder = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2', { dtype: 'q8' }); }
  const out = await embedder(text.slice(0, 1200), { pooling: 'mean', normalize: true }); return Array.from(out.data);
}
export async function initRetrieval() {
  if (!pool) return;
  await pool.query('CREATE EXTENSION IF NOT EXISTS vector');
  await pool.query(`CREATE TABLE IF NOT EXISTS ft_chunks_v2 (workspace_id text NOT NULL, id text NOT NULL, client_id text NOT NULL, content text NOT NULL, embedding vector(384), keywords tsvector GENERATED ALWAYS AS (to_tsvector('english', content)) STORED, PRIMARY KEY(workspace_id,id))`);
  await pool.query('CREATE INDEX IF NOT EXISTS ft_chunks_v2_client ON ft_chunks_v2(workspace_id,client_id)');
  await pool.query('CREATE INDEX IF NOT EXISTS ft_chunks_v2_keywords ON ft_chunks_v2 USING gin(keywords)');
}
export async function indexMessages(messages: Message[]) {
  if (!pool) return;
  for (const m of messages) { const v = await embed(m.text); await pool.query('INSERT INTO ft_chunks_v2(id,client_id,content,embedding,workspace_id) VALUES($1,$2,$3,$4::vector,$5) ON CONFLICT(workspace_id,id) DO UPDATE SET content=EXCLUDED.content,embedding=EXCLUDED.embedding', [m.id,m.clientId,`${m.speaker}: ${m.text.slice(0,2000)}`, JSON.stringify(v),workspaceId()]); }
}
export async function search(clientId: string, query: string) {
  if (!pool || !query.trim()) return [];
  return trace('retrieval.hybrid', async () => {
    const vector = await embed(query);
    const result = await pool.query(`WITH kw AS (SELECT id, row_number() OVER (ORDER BY ts_rank(keywords,websearch_to_tsquery('english',$2)) DESC,id) AS rank FROM ft_chunks_v2 WHERE workspace_id=$4 AND client_id=$1 AND keywords @@ websearch_to_tsquery('english',$2) LIMIT 10), vec AS (SELECT id,row_number() OVER(ORDER BY embedding <=> $3::vector,id) AS rank FROM ft_chunks_v2 WHERE workspace_id=$4 AND client_id=$1 ORDER BY embedding <=> $3::vector,id LIMIT 10) SELECT c.id,c.content,COALESCE(1.0/(60+kw.rank),0)+COALESCE(1.0/(60+vec.rank),0) score FROM kw FULL JOIN vec USING(id) JOIN ft_chunks_v2 c ON c.id=COALESCE(kw.id,vec.id) WHERE c.workspace_id=$4 AND c.client_id=$1 ORDER BY score DESC,c.id LIMIT 4`, [clientId,query.slice(0,1000),JSON.stringify(vector),workspaceId()]);
    return result.rows;
  });
}
