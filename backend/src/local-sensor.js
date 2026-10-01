function sensorPath(value, label) {
  if (!/^\/sensor\/[A-Za-z0-9 _.-]+$/.test(value)) throw new Error(`Invalid ${label} sensor path`);
  return value;
}

function localHost(hostname) {
  if (hostname === 'localhost' || hostname.endsWith('.local')) return true;
  const octets = hostname.split('.').map(Number);
  if (octets.length !== 4 || octets.some(value => !Number.isInteger(value) || value < 0 || value > 255)) return false;
  return octets[0] === 10 || octets[0] === 127 ||
    (octets[0] === 192 && octets[1] === 168) ||
    (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31);
}

export class LocalSensorClient {
  constructor(config, fetchImpl = fetch) {
    const url = new URL(config.baseUrl);
    if (url.protocol !== 'http:' || url.username || url.password || url.search || url.hash || url.pathname !== '/' || !localHost(url.hostname)) {
      throw new Error('LOCAL_BASE_URL must be a private-network HTTP origin with no credentials or path');
    }
    this.baseUrl = url.origin;
    this.temperaturePath = sensorPath(config.temperaturePath, 'temperature');
    this.humidityPath = sensorPath(config.humidityPath, 'humidity');
    this.username = config.username;
    this.password = config.password;
    this.fetch = fetchImpl;
  }

  async #sensor(path, expectedUnit) {
    const headers = {};
    if (this.username || this.password) headers.Authorization = `Basic ${Buffer.from(`${this.username}:${this.password}`).toString('base64')}`;
    const response = await this.fetch(`${this.baseUrl}/sensor/${encodeURIComponent(path.slice('/sensor/'.length))}`, { headers, signal: AbortSignal.timeout(5000) });
    if (!response.ok) throw new Error(`Local sensor HTTP ${response.status}`);
    const body = await response.json();
    const value = body?.value;
    if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error(`Local sensor ${path} has no numeric value`);
    if (typeof body.state !== 'string' || !body.state.includes(expectedUnit)) throw new Error(`Local sensor ${path} unit is not ${expectedUnit}`);
    return value;
  }

  async read() {
    const [temperature, humidity] = await Promise.all([
      this.#sensor(this.temperaturePath, '°C'),
      this.#sensor(this.humidityPath, '%'),
    ]);
    if (temperature < -50 || temperature > 100 || humidity < 0 || humidity > 100) throw new Error('Local sensor reading outside accepted range');
    return { temperature, humidity };
  }
}
