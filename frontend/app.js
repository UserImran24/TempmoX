const $ = id => document.getElementById(id);
const fmt = value => value === null || value === undefined ? '—' : Number(value).toFixed(1);
const date = value => value ? new Date(value).toLocaleString() : '—';
let history = [];
let lastAlarmId = null;
async function api(path, options) {
  const response = await fetch(path, { cache: 'no-store', ...options });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
  return data;
}

function renderChart() {
  const metric = $('chart-metric').value;
  const values = history.slice().reverse().filter(r => r[metric] !== null).map(r => Number(r[metric]));
  if (values.length < 2) { $('chart').replaceChildren(); $('chart-empty').textContent = 'The chart will appear after two readings have been collected.'; return; }
  $('chart-empty').textContent = '';
  const min = Math.min(...values), max = Math.max(...values), span = Math.max(max - min, 1);
  const points = values.map((v, i) => `${40 + i * 620 / (values.length - 1)},${175 - (v - min) / span * 135}`).join(' ');
  $('chart').innerHTML = `<line x1="40" y1="175" x2="660" y2="175" stroke="#cddfe2"/><line x1="40" y1="40" x2="660" y2="40" stroke="#e9f0f1"/><polyline points="${points}" fill="none" stroke="#0b9e91" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><text x="5" y="44" fill="#78909c" font-size="13">${max.toFixed(1)}</text><text x="5" y="179" fill="#78909c" font-size="13">${min.toFixed(1)}</text>`;
}

async function refresh() {
  try {
    const [overview, recent, rules, alarms] = await Promise.all([
      api('/api/overview'), api('/api/history'), api('/api/rules'), api('/api/alarms'),
    ]);
    $('source').textContent = overview.label;
    $('source').className = `badge ${overview.source}`;
    $('temperature').textContent = fmt(overview.latest?.temperature);
    $('humidity').textContent = fmt(overview.latest?.humidity);
    $('captured').textContent = date(overview.latest?.capturedAt);
    $('temperature-meta').textContent = overview.source === 'demo' ? 'Simulated reading' : overview.source === 'esphome' ? 'Local sensor' : overview.source === 'tuya' ? 'Existing sensor · local LAN' : 'Local bridge reading';
    $('humidity-meta').textContent = overview.source === 'demo' ? 'Simulated reading' : overview.source === 'esphome' ? 'Local sensor' : overview.source === 'tuya' ? 'Existing sensor · local LAN' : 'Local bridge reading';
    $('polling').textContent = overview.pollSeconds ? `Backend polls every ${overview.pollSeconds} seconds` : 'Readings arrive from a local bridge';
    $('status').textContent = overview.lastError ? 'Polling error' : overview.stale ? 'Stale / no data' : 'Current snapshot';
    $('status').className = `status ${overview.stale || overview.lastError ? 'stale' : ''}`;
    $('message').textContent = overview.lastError || ({ demo: 'This is a local simulation. No physical device is connected.', esphome: 'Values come from a sensor on your local network.', push: 'Values arrive from your local bridge.', tuya: 'Values are read directly from the sensor over your local network. Tuya Cloud is not used.' }[overview.source]);
    history = recent; renderChart();
    $('rules').replaceChildren(...rules.map(rule => {
      const row = document.createElement('div'); row.className = 'row';
      const label = document.createElement('span'); label.textContent = `${rule.metric} ${rule.operator} ${rule.threshold}${rule.metric === 'temperature' ? ' °C' : ' %'}${rule.enabled ? '' : ' (disabled)'}`;
      const button = document.createElement('button'); button.textContent = 'Disable'; button.disabled = !rule.enabled;
      button.onclick = async () => { await api(`/api/rules/${rule.id}`, { method: 'DELETE' }); refresh(); };
      row.append(label, button); return row;
    }));
    $('alarms').replaceChildren(...alarms.map(alarm => {
      const row = document.createElement('div'); row.className = 'row';
      const label = document.createElement('span'); label.textContent = `${alarm.metric} ${alarm.operator} ${alarm.threshold}: ${alarm.value} · ${date(alarm.triggeredAt)}`;
      const button = document.createElement('button'); button.textContent = alarm.acknowledgedAt ? 'Acknowledged' : 'Acknowledge'; button.disabled = Boolean(alarm.acknowledgedAt);
      button.onclick = async () => { await api(`/api/alarms/${alarm.id}/ack`, { method: 'POST' }); refresh(); };
      row.append(label, button); return row;
    }));
    if (!rules.length) $('rules').textContent = 'No rules configured.';
    if (!alarms.length) $('alarms').textContent = 'No alarm events yet.';
    const newestAlarmId = alarms.reduce((max, alarm) => Math.max(max, alarm.id), 0);
    if (lastAlarmId !== null && 'Notification' in window && Notification.permission === 'granted' && localStorage.getItem('tempmox-alerts') === 'on') {
      for (const alarm of alarms.filter(item => item.id > lastAlarmId && !item.acknowledgedAt)) {
        new Notification('TempmoX alarm', { body: `${alarm.metric} ${alarm.operator} ${alarm.threshold}: ${alarm.value}` });
      }
    }
    lastAlarmId = newestAlarmId;
    $('alert-help').textContent = 'Notification' in window && Notification.permission === 'granted' && localStorage.getItem('tempmox-alerts') === 'on' ? 'Browser alerts are on while this page is open.' : 'Alerts work while this dashboard is open.';
    $('check-device').disabled = !['esphome', 'tuya'].includes(overview.source) || Boolean(overview.discoverDps);
    $('discover-dps').hidden = overview.source !== 'tuya' || !overview.discoverDps;
    $('device-help').textContent = ({ demo: 'Choose a local sensor or bridge in .env to connect real hardware.', esphome: 'The backend reads the configured ESPHome web API. Check sensor now requests a new snapshot.', push: 'A local bridge sends readings to the authenticated ingest endpoint.', tuya: overview.discoverDps ? 'Inspect read-only sensor data points first; the app will not poll until temperature and humidity IDs are configured.' : 'The backend reads the existing sensor over the local LAN. Check sensor now requests a fresh status.' }[overview.source]);
    $('device').textContent = overview.sensorPaths ? JSON.stringify(overview.sensorPaths, null, 2) : '';
  } catch (error) { $('message').textContent = error.message; $('status').textContent = 'Connection error'; $('status').className = 'status stale'; }
}

$('chart-metric').onchange = renderChart;
$('discover-dps').onclick = async () => {
  $('discover-dps').disabled = true;
  $('device').textContent = 'Reading the device locally…';
  try {
    const result = await api('/api/device/tuya/discover-dps', { method: 'POST' });
    $('device').textContent = JSON.stringify(result.dataPoints, null, 2);
    $('device-help').textContent = 'These are read-only datapoint IDs and current values. Use Smart Life readings to identify temperature and humidity; never share your .env file.';
  } catch (error) { $('device').textContent = error.message; }
  finally { $('discover-dps').disabled = false; }
};
$('rule-form').onsubmit = async event => {
  event.preventDefault(); const form = new FormData(event.target);
  try { await api('/api/rules', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ metric: form.get('metric'), operator: form.get('operator'), threshold: Number(form.get('threshold')) }) }); event.target.reset(); refresh(); }
  catch (error) { alert(error.message); }
};
$('check-device').onclick = async () => {
  const button = $('check-device');
  button.disabled = true;
  button.textContent = 'Checking…';
  try { await api('/api/device/check', { method: 'POST' }); await refresh(); }
  catch (error) { $('device').textContent = error.message; }
  finally { button.textContent = 'Check sensor now'; button.disabled = false; }
};
$('enable-alerts').onclick = async () => {
  if (!('Notification' in window)) { $('alert-help').textContent = 'This browser does not support notifications.'; return; }
  const permission = await Notification.requestPermission();
  if (permission === 'granted') { localStorage.setItem('tempmox-alerts', 'on'); $('alert-help').textContent = 'Browser alerts are on while this page is open.'; }
  else $('alert-help').textContent = 'Notification permission was not granted.';
};
if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {});
refresh(); setInterval(refresh, 10000);
