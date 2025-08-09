// Simple smoke test: start API, probe readiness, hit tools endpoints, print summary, exit
let app;
try {
  app = require('../packages/api/dist/server.js').default;
} catch (e) {
  console.error('SMOKE_FAIL cannot import API app:', e?.message || e);
  process.exit(1);
}

const BASE = 'http://localhost:8080';
const TIMEOUT_MS = 60000;

function wait(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchJson(path, timeoutMs = 5000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(BASE + path, { signal: ctrl.signal });
    const text = await res.text();
    try {
      return { ok: res.ok, json: JSON.parse(text) };
    } catch {
      return { ok: res.ok, json: text };
    }
  } finally {
    clearTimeout(t);
  }
}

async function main() {
  const http = require('http');
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  const BASE = `http://127.0.0.1:${port}`;

  const fetchJsonAbs = (path, t) => fetchJson(path.replace(/^\//, '/'), t).then((r) => ({ ...r }));
  const deadline = Date.now() + TIMEOUT_MS;
  let ready = false;
  while (Date.now() < deadline && !ready) {
    try {
      const r = await fetch(BASE + '/healthz');
      const text = await r.text();
      if (r.ok && text === 'ok') ready = true;
    } catch {}
    if (!ready) await wait(100);
  }
  if (!ready) {
    server.close();
    console.error('SMOKE_FAIL api not ready');
    process.exit(1);
  }

  async function fetchJson(path, timeoutMs = 5000) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(BASE + path, { signal: ctrl.signal });
      const text = await res.text();
      try {
        return { ok: res.ok, json: JSON.parse(text) };
      } catch {
        return { ok: res.ok, json: text };
      }
    } finally {
      clearTimeout(t);
    }
  }

  const r1 = await fetchJson('/v1/tools?limit=2');
  const r2 = await fetchJson('/v1/tools?limit=2&offset=2');
  const r3 = await fetchJson('/v1/tools?category=Vibe%20Coding%20Tool&limit=5');
  const r4 = await fetchJson('/v1/tools?q=cursor&limit=5');

  server.close();

  if (!r1.ok || !r2.ok || !r3.ok || !r4.ok) {
    console.error('SMOKE_FAIL bad http');
    process.exit(1);
  }
  if (!r1.json?.success || !r2.json?.success || !r3.json?.success || !r4.json?.success) {
    console.error('SMOKE_FAIL missing success flag');
    process.exit(1);
  }
  const s = `SMOKE_OK total=${r1.json.total ?? 'n/a'} p1=${r1.json.data?.length ?? 0} p2=${r2.json.data?.length ?? 0} cat=${r3.json.data?.length ?? 0} q=${r4.json.data?.length ?? 0}`;
  console.log(s);
}

main().catch((e) => {
  console.error('SMOKE_FAIL', e?.message || e);
  process.exit(1);
});


