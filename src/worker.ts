import { Worker, NativeConnection } from '@temporalio/worker';
import { fileURLToPath } from 'node:url';
import { config } from './config.js';
import { initStore } from './store.js';
import { initRetrieval } from './retrieval.js';
import { tenantActivities as activities } from './worker-activities.js';
export async function runWorker() { await initStore(); await initRetrieval(); const connection = await NativeConnection.connect({ address: config.TEMPORAL_ADDRESS }); const worker = await Worker.create({ connection, namespace: config.TEMPORAL_NAMESPACE, taskQueue:'followthrough-v2', workflowsPath:fileURLToPath(new URL('./workflows.ts',import.meta.url)), activities }); const stop = () => worker.shutdown(); process.once('SIGTERM',stop); process.once('SIGINT',stop); await worker.run(); await connection.close(); }
if (process.argv[1] === fileURLToPath(import.meta.url)) await runWorker();
