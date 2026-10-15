import { spawn, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { connect } from 'node:net';
import { openSync, closeSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { config } from '../src/config.js';

const execute = promisify(execFile);
const pause = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
async function ready(check: () => Promise<boolean>, name: string, timeout = 120_000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if (await check()) { console.log(`${name} ready.`); return; }
    await pause(1000);
  }
  throw new Error(`${name} did not become ready. Check its logs and try again.`);
}
async function tcp(host: string, port: number): Promise<boolean> {
  return new Promise(resolve => {
    const socket = connect({ host, port });
    const done = (value: boolean) => { socket.destroy(); resolve(value); };
    socket.setTimeout(1500);
    socket.once('connect', () => done(true));
    socket.once('error', () => done(false));
    socket.once('timeout', () => done(false));
  });
}
async function http(url: string): Promise<boolean> {
  try { const response = await fetch(url, { signal: AbortSignal.timeout(2000) }); await response.body?.cancel(); return response.ok; }
  catch { return false; }
}
async function dockerReady(): Promise<boolean> {
  try { await execute('docker', ['info', '--format', '{{.ServerVersion}}'], { timeout: 4000 }); return true; }
  catch { return false; }
}
function local(url: URL) { return ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname); }

async function main() {
  if (await tcp('127.0.0.1', config.PORT)) throw new Error(`Port ${config.PORT} is already in use. Stop the running app/debug session before pressing F5 again.`);
  const temporalUrl = new URL(`http://${config.TEMPORAL_ADDRESS}`);
  const wahaUrl = new URL(config.WAHA_URL);
  const startTemporal = config.DURABLE_MODE === 'temporal' && local(temporalUrl);
  const startWaha = config.WHATSAPP_PROVIDER === 'waha' && local(wahaUrl);
  if (startTemporal || startWaha) {
    if (!(await dockerReady())) {
      if (process.platform !== 'darwin') throw new Error('Start Docker Desktop or the Docker daemon, then press F5 again.');
      console.log('Starting Docker Desktop…');
      await execute('open', ['-a', 'Docker']);
      await ready(dockerReady, 'Docker Desktop');
    }
    const services = [...(startTemporal ? ['temporal'] : []), ...(startWaha ? ['waha'] : [])];
    console.log(`Starting ${services.join(' and ')}…`);
    // Compose reads the existing .env and preserves named session/database volumes.
    await new Promise<void>((resolve, reject) => {
      const child = spawn('docker', ['compose', '--profile', 'whatsapp', 'up', '-d', ...services], { stdio: 'inherit' });
      child.once('error', reject);
      child.once('exit', code => code === 0 ? resolve() : reject(new Error('Docker Compose startup failed.')));
    });
  }
  if (config.DURABLE_MODE === 'temporal') await ready(() => tcp(temporalUrl.hostname, Number(temporalUrl.port || 7233)), 'Temporal');
  if (config.WHATSAPP_PROVIDER === 'waha') {
    await ready(async () => {
      try {
        const response = await fetch(new URL('/api/server/status', wahaUrl), { headers: { 'X-Api-Key': config.WAHA_API_KEY }, signal: AbortSignal.timeout(2000) });
        await response.body?.cancel(); return response.ok;
      } catch { return false; }
    }, 'WhatsApp connector');
  }
  if (config.AI_PROVIDER === 'ollama') {
    const base = new URL(config.OLLAMA_BASE_URL);
    const tags = new URL('/api/tags', base).href;
    if (!(await http(tags)) && local(base)) {
      console.log('Starting Ollama…');
      const logPath = join(tmpdir(), 'followthrough-ollama.log');
      const fd = openSync(logPath, 'a', 0o600);
      try {
        const child = spawn('ollama', ['serve'], { detached: true, stdio: ['ignore', fd, fd] });
        await new Promise<void>((resolve, reject) => { child.once('spawn', resolve); child.once('error', reject); });
        child.unref();
      } finally { closeSync(fd); }
      console.log(`Ollama log: ${logPath}`);
    }
    await ready(() => http(tags), 'Ollama');
    const response = await fetch(tags, { signal: AbortSignal.timeout(5000) });
    const body = await response.json() as { models?: { name: string }[] };
    const model = config.OLLAMA_MODEL.includes(':') ? config.OLLAMA_MODEL : `${config.OLLAMA_MODEL}:latest`;
    if (!body.models?.some(item => item.name === model)) throw new Error(`Ollama model ${model} is missing. Run: ollama pull ${model}`);
    console.log(`Gemma model available: ${model}`);
  }
  console.log('Dependencies ready. VS Code will build the dashboard and launch the API with its embedded Temporal worker.');
  console.log('Telegram runs inside the API; configure TELEGRAM_API_ID and TELEGRAM_API_HASH to enable personal-account QR linking.');
  console.log('Tiger is hosted; the API uses the existing .env connection. Docker services and Ollama stay running after debugging stops.');
}
main().catch(error => { console.error(error instanceof Error ? error.message : 'Local startup failed.'); process.exitCode = 1; });
