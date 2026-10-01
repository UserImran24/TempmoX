import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const helper = fileURLToPath(new URL('./tuya_bridge.py', import.meta.url));

export class TuyaLocalClient {
  constructor(config, { timeoutMs = 12000 } = {}) {
    this.config = config;
    this.timeoutMs = timeoutMs;
  }

  async read() {
    const points = await this.#run('read');
    const dps = Object.fromEntries(points.map(point => [point.id, point.value]));
    const temp = Number(dps[this.config.temperatureDp]);
    const humidity = Number(dps[this.config.humidityDp]);
    if (!Number.isFinite(temp) || !Number.isFinite(humidity)) throw new Error('Tuya status received, but configured temperature/humidity DP IDs are missing or non-numeric');
    const temperature = temp / this.config.temperatureScale;
    const relativeHumidity = humidity / this.config.humidityScale;
    if (temperature < -50 || temperature > 100 || relativeHumidity < 0 || relativeHumidity > 100) throw new Error('Tuya readings outside accepted temperature/humidity range');
    return { temperature, humidity: relativeHumidity };
  }

  inspectDataPoints() { return this.#run('inspect'); }

  #run(action) {
    return new Promise((resolve, reject) => {
      const child = spawn(process.env.PYTHON || 'python', [helper, action], {
        env: { ...process.env, TUYA_DEVICE_ID: this.config.id, TUYA_DEVICE_IP: this.config.ip, TUYA_LOCAL_KEY: this.config.key },
        stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true,
      });
      let stdout = '';
      let stderr = '';
      let settled = false;
      const timer = setTimeout(() => { settled = true; child.kill(); reject(new Error('Local Tuya helper timed out; check device reachability and Python setup')); }, this.timeoutMs);
      child.stdout.setEncoding('utf8');
      child.stdout.on('data', chunk => { stdout += chunk; if (stdout.length > 32768) { child.kill(); } });
      child.stderr.setEncoding('utf8');
      child.stderr.on('data', chunk => { stderr += chunk; if (stderr.length > 1024) child.kill(); });
      child.on('error', () => { if (!settled) { settled = true; clearTimeout(timer); reject(new Error('Python is unavailable; install Python and the requirements in backend/requirements.txt')); } });
      child.on('close', code => {
        if (settled) return;
        settled = true; clearTimeout(timer);
        if (code !== 0) {
          const statusError = stderr.trim().match(/^TUYA_STATUS_ERROR(?:=(\d+))?$/);
          if (stderr.trim() === 'TINYTUYA_IMPORT_ERROR') return reject(new Error('TinyTuya is not readable by this Python runtime; install backend/requirements.txt for that Python interpreter'));
          return reject(new Error(statusError ? `Tuya device did not provide status (code ${statusError[1] || 'unknown'}); confirm it is awake and reachable on this Wi-Fi` : 'Local Tuya read failed; confirm the key, device IP, and Python dependency'));
        }
        try { resolve(JSON.parse(stdout)); } catch { reject(new Error('Local Tuya helper returned invalid output')); }
      });
    });
  }
}
