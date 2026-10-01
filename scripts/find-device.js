import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const exec = promisify(execFile);
const [prefix, mac] = process.argv.slice(2);
const octets = (prefix || '').split('.').map(Number);
const privateSubnet = octets.length === 3 && octets.every(n => Number.isInteger(n) && n >= 0 && n <= 255) &&
  (octets[0] === 10 || (octets[0] === 192 && octets[1] === 168) || (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31));
if (!privateSubnet || !/^([0-9a-f]{2}[:-]){5}[0-9a-f]{2}$/i.test(mac || '')) {
  console.error('Usage: node scripts/find-device.js <private /24 prefix> <device MAC>');
  console.error('Example: node scripts/find-device.js 192.168.1 aa:bb:cc:dd:ee:ff');
  process.exit(2);
}

const addresses = Array.from({ length: 254 }, (_, i) => `${prefix}.${i + 1}`);
for (let i = 0; i < addresses.length; i += 32) {
  await Promise.all(addresses.slice(i, i + 32).map(async address => {
    try { await exec('ping', ['-n', '1', '-w', '200', address], { timeout: 1200 }); } catch {}
  }));
}
const { stdout } = await exec('arp', ['-a']);
const normalizedMac = mac.toLowerCase().replaceAll(':', '-');
const row = stdout.split(/\r?\n/).find(line => line.toLowerCase().includes(normalizedMac));
if (row) console.log(`Possible device: ${row.trim()}`);
else console.log('MAC not seen. The device may be asleep, offline, isolated, or may not answer ping. This does not prove it has no LAN interface.');
