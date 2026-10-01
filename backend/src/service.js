export class MonitorService {
  constructor(config, store, localSensor = null) {
    this.config = config;
    this.store = store;
    this.localSensor = localSensor;
    this.lastError = null;
    this.lastPollAt = null;
    this.currentPoll = null;
  }

  async poll() {
    if (this.config.source === 'push') return;
    if (this.currentPoll) return this.currentPoll;
    this.currentPoll = this.#performPoll().finally(() => { this.currentPoll = null; });
    return this.currentPoll;
  }

  async #performPoll() {
    try {
      let reading;
      if (this.config.source === 'demo') {
        const x = Date.now() / 3600000;
        reading = { temperature: Math.round((24 + 2 * Math.sin(x)) * 10) / 10, humidity: Math.round((58 + 8 * Math.cos(x)) * 10) / 10 };
      } else if (this.config.source === 'esphome' || this.config.source === 'tuya') {
        reading = await this.localSensor.read();
      }
      const capturedAt = new Date().toISOString();
      this.store.addReading({ capturedAt, source: this.config.source, ...reading });
      this.lastPollAt = capturedAt;
      this.lastError = null;
      return true;
    } catch (error) {
      this.lastError = String(error.message).slice(0, 200);
      console.error(JSON.stringify({ level: 'error', event: 'poll_failed', message: this.lastError, at: new Date().toISOString() }));
      return false;
    }
  }

  ingest(reading) {
    if (this.config.source !== 'push') throw new Error('Push mode is not configured');
    const { temperature, humidity } = reading;
    if (typeof temperature !== 'number' || !Number.isFinite(temperature) || temperature < -50 || temperature > 100 ||
        typeof humidity !== 'number' || !Number.isFinite(humidity) || humidity < 0 || humidity > 100) {
      throw new Error('Invalid temperature or humidity');
    }
    const capturedAt = new Date().toISOString();
    this.store.addReading({ capturedAt, source: 'push', temperature, humidity });
    this.lastPollAt = capturedAt;
    this.lastError = null;
    return { capturedAt };
  }

  overview() {
    const latest = this.store.latest(this.config.source);
    return {
      source: this.config.source,
      label: { demo: 'SIMULATED DATA', esphome: 'LOCAL SENSOR POLLING', push: 'LOCAL BRIDGE', tuya: 'LOCAL TUYA LAN' }[this.config.source],
      discoverDps: this.config.source === 'tuya' && this.config.tuya.discoverDps,
      latest,
      stale: !latest || Date.now() - Date.parse(latest.capturedAt) > this.config.staleMs,
      pollSeconds: this.config.source === 'push' ? null : this.config.pollMs / 1000,
      lastPollAt: this.lastPollAt,
      lastError: this.lastError,
      sensorPaths: this.config.source === 'esphome' ? { temperature: this.config.localSensor.temperaturePath, humidity: this.config.localSensor.humidityPath } : null,
    };
  }
}
