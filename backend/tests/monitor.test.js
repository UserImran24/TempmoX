import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Store } from '../src/store.js';
import { LocalSensorClient } from '../src/local-sensor.js';
import { MonitorService } from '../src/service.js';

test('local sensor reads verified numeric Celsius and percent values', async () => {
  const calls = [];
  const client = new LocalSensorClient({ baseUrl: 'http://192.168.1.50/', temperaturePath: '/sensor/Room Temperature', humidityPath: '/sensor/Room Humidity', username: '', password: '' }, async url => {
    calls.push(url);
    return { ok: true, json: async () => url.includes('Temperature') ? { state: '26.6 °C', value: 26.6 } : { state: '79.4 %', value: 79.4 } };
  });
  assert.deepEqual(await client.read(), { temperature: 26.6, humidity: 79.4 });
  assert.equal(calls.length, 2);
  assert.equal(calls[0].includes('Room%20Temperature'), true);
});
test('local sensor rejects wrong units and nonnumeric readings', async () => {
  const client = new LocalSensorClient({ baseUrl: 'http://192.168.1.50/', temperaturePath: '/sensor/Temperature', humidityPath: '/sensor/Humidity', username: '', password: '' }, async url => ({
    ok: true, json: async () => url.includes('Temperature') ? { state: '80 °F', value: 80 } : { state: '50 %', value: 50 },
  }));
  await assert.rejects(client.read(), /unit is not °C/);
});

test('alarm fires once per crossing; demo history stays out of push view', () => {
  const dir = mkdtempSync(join(tmpdir(), 'tempmox-'));
  const store = new Store(dir);
  try {
    store.addRule('temperature', 'above', 30);
    for (const temperature of [29, 31, 32, 29, 31]) {
      store.addReading({ capturedAt: new Date().toISOString(), source: 'demo', temperature, humidity: 50 });
    }
    assert.equal(store.alarms('demo').length, 2);
    assert.equal(store.history('1970-01-01', '9999-12-31', 500, 'demo').length, 5);
    assert.equal(store.latest('push'), null);
    store.addReading({ capturedAt: new Date().toISOString(), source: 'push', temperature: 31, humidity: 60 });
    assert.equal(store.alarms('push').length, 1);
    assert.equal(store.history('1970-01-01', '9999-12-31', 500, 'push').length, 1);
  } finally { store.close(); rmSync(dir, { recursive: true, force: true }); }
});

test('push service validates readings and records only local bridge data', () => {
  const dir = mkdtempSync(join(tmpdir(), 'tempmox-'));
  const store = new Store(dir);
  try {
    const service = new MonitorService({ source: 'push', staleMs: 180000, pollMs: 60000 }, store);
    assert.throws(() => service.ingest({ temperature: 25, humidity: 105 }), /Invalid/);
    service.ingest({ temperature: 25.5, humidity: 65 });
    assert.equal(service.overview().latest.temperature, 25.5);
    assert.equal(service.overview().source, 'push');
  } finally { store.close(); rmSync(dir, { recursive: true, force: true }); }
});

test('local polling retries immediately after a failed read', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'tempmox-'));
  const store = new Store(dir);
  let reads = 0;
  const sensor = { read: async () => {
    reads += 1;
    if (reads === 1) throw new Error('Sensor asleep');
    return { temperature: 25, humidity: 67.6 };
  } };
  try {
    const service = new MonitorService({ source: 'tuya', tuya: { discoverDps: false }, staleMs: 180000, pollMs: 60000 }, store, sensor);
    assert.equal(await service.poll(), false);
    assert.match(service.overview().lastError, /Sensor asleep/);
    assert.equal(await service.poll(), true);
    assert.equal(reads, 2);
    assert.equal(service.overview().latest.humidity, 67.6);
    assert.equal(service.overview().lastError, null);
  } finally { store.close(); rmSync(dir, { recursive: true, force: true }); }
});

test('simultaneous sensor checks share one hardware read', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'tempmox-'));
  const store = new Store(dir);
  let finishRead;
  let reads = 0;
  const sensor = { read: () => { reads += 1; return new Promise(resolve => { finishRead = resolve; }); } };
  try {
    const service = new MonitorService({ source: 'tuya', tuya: { discoverDps: false }, staleMs: 180000, pollMs: 60000 }, store, sensor);
    const scheduled = service.poll();
    const manual = service.poll();
    assert.equal(reads, 1);
    finishRead({ temperature: 25, humidity: 67.6 });
    assert.deepEqual(await Promise.all([scheduled, manual]), [true, true]);
    assert.equal(store.history('1970-01-01', '9999-12-31', 500, 'tuya').length, 1);
  } finally { store.close(); rmSync(dir, { recursive: true, force: true }); }
});
