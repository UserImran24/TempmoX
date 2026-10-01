import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import { timingSafeEqual } from 'node:crypto';
import { once } from 'node:events';
import { loadConfig } from './config.js';
import { Store } from './store.js';
import { LocalSensorClient } from './local-sensor.js';
import { TuyaLocalClient } from './tuya-local.js';
import { MonitorService } from './service.js';

const config = loadConfig();
const store = new Store(config.dataDir);
const deviceClient = config.source === 'esphome' ? new LocalSensorClient(config.localSensor) : config.source === 'tuya' ? new TuyaLocalClient(config.tuya) : null;
const service = new MonitorService(config, store, deviceClient);
const publicDir = resolve(import.meta.dirname, '../../frontend');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png' };

function json(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
  res.end(JSON.stringify(data));
}
function authorized(req) {
  if (!config.password) return true;
  const expected = Buffer.from(`Basic ${Buffer.from(`tempmox:${config.password}`).toString('base64')}`);
  const actual = Buffer.from(req.headers.authorization || '');
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
function authorizedIngest(req) {
  const expected = Buffer.from(`Bearer ${config.ingestToken}`);
  const actual = Buffer.from(req.headers.authorization || '');
  return config.source === 'push' && actual.length === expected.length && timingSafeEqual(actual, expected);
}
async function body(req) {
  let data = '';
  for await (const chunk of req) {
    data += chunk;
    if (data.length > 4096) throw new Error('Request body too large');
  }
  return JSON.parse(data || '{}');
}
function dates(url) {
  const from = url.searchParams.get('from') || '1970-01-01T00:00:00.000Z';
  const to = url.searchParams.get('to') || '9999-12-31T23:59:59.999Z';
  if (!Number.isFinite(Date.parse(from)) || !Number.isFinite(Date.parse(to)) || from > to) throw new Error('Invalid date range');
  return { from, to };
}

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const path = url.pathname;
    if (req.method === 'POST' && path === '/api/ingest') {
      if (!authorizedIngest(req)) return json(res, 401, { error: 'Invalid ingest token' });
      return json(res, 201, service.ingest(await body(req)));
    }
    if (!authorized(req)) {
      res.writeHead(401, { 'WWW-Authenticate': 'Basic realm="TempmoX"', 'Cache-Control': 'no-store' });
      res.end('Authentication required');
      return;
    }
    if (!['GET', 'HEAD'].includes(req.method) && req.headers.origin && req.headers.origin !== `http://${req.headers.host}`) {
      return json(res, 403, { error: 'Cross-origin mutation blocked' });
    }
    if (req.method === 'GET' && path === '/api/overview') return json(res, 200, service.overview());
    if (req.method === 'GET' && path === '/api/history') { const { from, to } = dates(url); return json(res, 200, store.history(from, to, 500, config.source)); }
    if (req.method === 'GET' && path === '/api/rules') return json(res, 200, store.rules());
    if (req.method === 'GET' && path === '/api/alarms') return json(res, 200, store.alarms(config.source));
    if (req.method === 'POST' && path === '/api/device/check') {
      if (!['esphome', 'tuya'].includes(config.source)) return json(res, 409, { error: 'Local polling is not configured' });
      if (config.source === 'tuya' && config.tuya.discoverDps) return json(res, 409, { error: 'Inspect and map the Tuya data points first' });
      await service.poll();
      return json(res, 200, service.overview());
    }
    if (req.method === 'POST' && path === '/api/device/tuya/discover-dps') {
      if (config.source !== 'tuya' || !config.tuya.discoverDps) return json(res, 404, { error: 'Read-only DP inspection is not enabled' });
      const points = await deviceClient.inspectDataPoints();
      return json(res, 200, { dataPoints: points, note: 'DP IDs and values only; no device key or cloud credentials are returned.' });
    }
    if (req.method === 'POST' && path === '/api/rules') {
      const value = await body(req);
      if (!['temperature', 'humidity'].includes(value.metric) || !['above', 'below'].includes(value.operator) || !Number.isFinite(value.threshold)) throw new Error('Invalid rule');
      return json(res, 201, { id: store.addRule(value.metric, value.operator, value.threshold) });
    }
    if (req.method === 'DELETE' && /^\/api\/rules\/\d+$/.test(path)) { store.deleteRule(Number(path.split('/').at(-1))); return json(res, 200, { ok: true }); }
    if (req.method === 'POST' && /^\/api\/alarms\/\d+\/ack$/.test(path)) return json(res, 200, { updated: store.acknowledge(Number(path.split('/')[3])) });
    if (req.method === 'GET' && path === '/api/export.csv') {
      const { from, to } = dates(url);
      res.writeHead(200, { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="tempmox-readings.csv"', 'Cache-Control': 'no-store' });
      res.write('captured_at,source,temperature_c,humidity_percent\n');
      for (const row of store.exportRows(from, to, config.source)) {
        const safe = value => `"${String(value ?? '').replaceAll('"', '""')}"`;
        if (!res.write([row.capturedAt, row.source, row.temperature, row.humidity].map(safe).join(',') + '\n')) await once(res, 'drain');
      }
      return res.end();
    }
    if (req.method !== 'GET') return json(res, 404, { error: 'Not found' });
    const file = path === '/' ? 'index.html' : path.slice(1);
    if (!['index.html', 'app.js', 'styles.css', 'manifest.json', 'icon.svg', 'icon-192.png', 'icon-512.png', 'sw.js'].includes(file)) return json(res, 404, { error: 'Not found' });
    const content = await readFile(resolve(publicDir, file));
    res.writeHead(200, { 'Content-Type': types[extname(file)] || 'application/octet-stream', 'X-Content-Type-Options': 'nosniff' });
    res.end(content);
  } catch (error) {
    if (!res.headersSent) json(res, error.message.startsWith('Local sensor') ? 502 : 400, { error: String(error.message).slice(0, 200) });
    else res.end();
  }
});

server.listen(config.port, config.host, () => {
  console.log(JSON.stringify({ level: 'info', event: 'started', url: `http://${config.host}:${config.port}`, source: config.source }));
  if (config.source !== 'push' && !(config.source === 'tuya' && config.tuya.discoverDps)) void service.poll();
});
const timer = config.source === 'push' || config.source === 'tuya' && config.tuya.discoverDps ? null : setInterval(() => void service.poll(), config.pollMs);
function shutdown() { if (timer) clearInterval(timer); server.close(() => { store.close(); process.exit(0); }); }
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
