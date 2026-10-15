import pg from 'pg';
import { config } from './config.js';
import {tigerTls} from './database-tls.js';
let pool: pg.Pool | undefined;
export function databasePool() {
  if (!config.TIGER_DATABASE_URL) throw new Error('TIGER_DATABASE_URL required');
  if (!pool) {
    const url = new URL(config.TIGER_DATABASE_URL);
    const ssl: pg.PoolConfig['ssl']=tigerTls(config.TIGER_CA_PATH,config.TIGER_CA_BASE64);
    if (ssl) {
      for (const key of ['sslmode','sslrootcert','sslcert','sslkey']) url.searchParams.delete(key);
    }
    pool = new pg.Pool({ connectionString: url.toString(), ssl, max: 3, connectionTimeoutMillis: 15000 });
  }
  return pool;
}
export async function closeDatabase() { await pool?.end(); pool = undefined; }
