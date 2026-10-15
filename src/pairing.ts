type Connector = (path: string, method?: string, body?: unknown) => Promise<any>;
type Session = { name: string; status: string };
export function createPairingController(connector: Connector, verifyOwner: () => Promise<void>, session: string, sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms))) {
  let pending: Promise<any> | undefined;
  const path = `/api/sessions/${encodeURIComponent(session)}`;
  async function start(): Promise<Session> {
    const sessions = await connector('/api/sessions?all=true');
    if (!Array.isArray(sessions)) throw new Error('Invalid connector session response');
    const existing = sessions.find(s => s.name === session) as Session | undefined;
    if (!existing) await connector('/api/sessions', 'POST', { name: session, start: false });
    if (existing?.status === 'WORKING') { await verifyOwner(); return existing; }
    if (existing && ['STARTING', 'SCAN_QR_CODE'].includes(existing.status)) return existing;
    return connector(`${path}/${existing?.status === 'FAILED' ? 'restart' : 'start'}`, 'POST');
  }
  async function getQr() {
    let state = await start();
    for (let attempt = 0; attempt < 12; attempt++) {
      if (state.status === 'WORKING') {
        await verifyOwner(); return { status: 'WORKING' };
      }
      if (state.status === 'SCAN_QR_CODE') {
        const qr = await connector(`/api/${encodeURIComponent(session)}/auth/qr?format=image`);
        if (qr.mimetype !== 'image/png' || typeof qr.data !== 'string' || !qr.data) throw new Error('Pairing QR is not ready. Try again.');
        return { status: 'SCAN_QR_CODE', mimetype: qr.mimetype, data: qr.data };
      }
      if (state.status !== 'STARTING') throw new Error('WhatsApp pairing could not start. Try again to restart the session.');
      await sleep(500);
      state = await connector(path);
    }
    throw new Error('WhatsApp is still starting. Try Show pairing QR again in a few seconds.');
  }
  return { start, qr: () => {
    if (!pending) pending = getQr().finally(() => { pending = undefined; });
    return pending;
  } };
}
