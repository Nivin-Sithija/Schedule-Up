import { z } from 'zod';
const env = z.object({
  AI_PROVIDER: z.enum(['ollama', 'openrouter']).default('ollama'),
  OLLAMA_BASE_URL: z.string().url().default('http://localhost:11434/v1'),
  OLLAMA_MODEL: z.string().default('gemma4:12b'),
  OLLAMA_CONTEXT_TOKENS: z.coerce.number().int().min(2048).default(4096),
  OPENROUTER_API_KEY: z.string().default(''),
  OPENROUTER_MODEL: z.string().default('google/gemma-4-26b-a4b-it:free'),
  OPENROUTER_FALLBACK_MODEL: z.string().default('google/gemma-4-31b-it:free'),
  APP_TIMEZONE: z.string().default('Asia/Colombo'), PORT: z.coerce.number().default(3001), HOST: z.string().default('127.0.0.1'),
  STORE_DRIVER: z.enum(['file', 'postgres']).default('file'), DATA_PATH: z.string().default('./data/state.json'),
  TIGER_DATABASE_URL: z.string().default(''), TIGER_CA_PATH: z.string().default(''), TIGER_CA_BASE64:z.string().default(''), EMBEDDING_CACHE_PATH:z.string().default(''), DURABLE_MODE: z.enum(['local', 'temporal']).default('local'),
  TEMPORAL_ADDRESS: z.string().default('localhost:7233'), TEMPORAL_NAMESPACE: z.string().default('default'),
  WHATSAPP_PROVIDER: z.enum(['mock', 'waha']).default('mock'), WAHA_URL: z.string().url().default('http://localhost:3000'), WAHA_HOSTPORT: z.string().optional(),
  WAHA_SESSION: z.string().default('default'), WAHA_API_KEY: z.string().default(''), WAHA_WEBHOOK_HMAC_KEY: z.string().default(''),
  TELEGRAM_API_ID:z.coerce.number().int().nonnegative().default(0), TELEGRAM_API_HASH:z.string().default(''), SESSION_ENCRYPTION_KEY:z.string().default(''),
  SENTRY_DSN: z.string().default(''),
}).parse(process.env);
new Intl.DateTimeFormat('en', { timeZone: env.APP_TIMEZONE });
const hosted = process.env.NODE_ENV === 'production';
if (env.AI_PROVIDER === 'openrouter' && (!env.OPENROUTER_API_KEY || ![env.OPENROUTER_MODEL, env.OPENROUTER_FALLBACK_MODEL].every(m => m.startsWith('google/gemma') && m.endsWith(':free')))) throw new Error('Hosted inference requires an OpenRouter key and free Gemma model IDs.');
if (env.STORE_DRIVER === 'postgres' && !env.TIGER_DATABASE_URL) throw new Error('TIGER_DATABASE_URL required');
if (hosted && (env.STORE_DRIVER !== 'postgres' || env.DURABLE_MODE !== 'temporal')) throw new Error('Production requires Tiger PostgreSQL and Temporal.');
if (env.WHATSAPP_PROVIDER === 'waha' && (!env.WAHA_API_KEY || !env.WAHA_WEBHOOK_HMAC_KEY)) throw new Error('WAHA connector credentials required');
export const config = { ...env, WAHA_URL: env.WAHA_HOSTPORT ? `http://${env.WAHA_HOSTPORT}` : env.WAHA_URL, hosted };
