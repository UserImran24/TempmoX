import { resolve } from 'node:path';

function number(name, fallback, min, max) {
  const value = Number(process.env[name] ?? fallback);
  if (!Number.isFinite(value) || value < min || value > max) throw new Error(`Invalid ${name}`);
  return value;
}

export function loadConfig() {
  const source = process.env.SOURCE || 'demo';
  if (!['demo', 'esphome', 'push', 'tuya'].includes(source)) throw new Error('SOURCE must be demo, esphome, push, or tuya');
  const host = process.env.HOST || '127.0.0.1';
  const password = process.env.APP_PASSWORD || '';
  if (!['127.0.0.1', '::1', 'localhost'].includes(host)) throw new Error('Bind to loopback only; use a TLS reverse proxy for remote access');
  const localSensor = {
    baseUrl: process.env.LOCAL_BASE_URL || '',
    temperaturePath: process.env.LOCAL_TEMPERATURE_PATH || '',
    humidityPath: process.env.LOCAL_HUMIDITY_PATH || '',
    username: process.env.LOCAL_USERNAME || '',
    password: process.env.LOCAL_PASSWORD || '',
  };
  if (source === 'esphome' && (!localSensor.baseUrl || !localSensor.temperaturePath || !localSensor.humidityPath)) {
    throw new Error('ESPHome mode requires LOCAL_BASE_URL and both LOCAL_*_PATH values');
  }
  const tuya = {
    id: process.env.TUYA_DEVICE_ID || '',
    key: process.env.TUYA_LOCAL_KEY || '',
    ip: process.env.TUYA_DEVICE_IP || '',
    version: process.env.TUYA_PROTOCOL_VERSION || '3.4',
    temperatureDp: process.env.TUYA_TEMPERATURE_DP || '',
    humidityDp: process.env.TUYA_HUMIDITY_DP || '',
    temperatureScale: Number(process.env.TUYA_TEMPERATURE_SCALE || 10),
    humidityScale: Number(process.env.TUYA_HUMIDITY_SCALE || 10),
    discoverDps: process.env.TUYA_DISCOVER_DPS === 'true',
  };
  if (source === 'tuya') {
    const localKeyIsValid = Buffer.byteLength(tuya.key, 'utf8') === 16 && /^[\x20-\x7E]{16}$/.test(tuya.key);
    if (!tuya.id || !localKeyIsValid) throw new Error('Tuya mode requires TUYA_DEVICE_ID and a 16-byte printable TUYA_LOCAL_KEY in .env');
    if (!tuya.ip) throw new Error('Tuya mode requires TUYA_DEVICE_IP, the device’s current private-network IP');
    const ip = tuya.ip.split('.').map(Number);
    if (ip.length !== 4 || ip.some(o => !Number.isInteger(o) || o < 0 || o > 255) ||
        !(ip[0] === 10 || ip[0] === 192 && ip[1] === 168 || ip[0] === 172 && ip[1] >= 16 && ip[1] <= 31)) {
      throw new Error('TUYA_DEVICE_IP must be a private IPv4 address');
    }
    if (tuya.version !== '3.4') throw new Error('Only verified Tuya protocol 3.4 is supported');
    if ((!tuya.temperatureDp || !tuya.humidityDp) && !tuya.discoverDps) throw new Error('Set TUYA_DISCOVER_DPS=true until the temperature and humidity data-point IDs are confirmed');
    if (![tuya.temperatureScale, tuya.humidityScale].every(n => Number.isFinite(n) && n > 0 && n <= 10000)) throw new Error('Invalid Tuya data-point scale');
  }
  const ingestToken = process.env.INGEST_TOKEN || '';
  if (source === 'push' && ingestToken.length < 24) throw new Error('Push mode requires a random INGEST_TOKEN of at least 24 characters');
  return {
    source, host, password, localSensor, tuya, ingestToken,
    port: number('PORT', 3000, 1, 65535),
    pollMs: number('POLL_SECONDS', 60, 15, 3600) * 1000,
    staleMs: number('STALE_SECONDS', 180, 30, 86400) * 1000,
    dataDir: resolve(process.env.DATA_DIR || './data'),
  };
}
