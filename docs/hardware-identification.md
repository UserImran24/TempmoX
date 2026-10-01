# Hardware identification

Evidence: the eight screenshots supplied by the owner on 2026-09-29 and the owner's project brief. The screenshots show app screens, not a physical model label. A screen label such as “Office” is a device name, not a model.

Additional evidence: five owner-supplied images on 2026-09-29 show the Device Update page, the Office panel, its menu, and both sides of the opened enclosure.

## Verified from the screenshots

| Item | Observation | Source |
| --- | --- | --- |
| Device app name | Office | Screenshot 3 |
| Temperature shown | 28.2 °C at capture | Screenshot 3 |
| Humidity shown | 75.8% at capture | Screenshot 3 |
| Other UI | Luminance tab and a `0%` widget | Screenshot 3 |
| Alarm settings | Temperature and humidity upper/lower limits | Screenshot 4 |
| Additional settings | Battery, switch, report intervals, calibration, alarm push switches | Screenshots 5–6 |
| Device MAC as shown in app | Redacted from public repository | Screenshots 1–2 |
| Device time zone | Configured in the app | Screenshot 1 |
| Device network test | “Good”, signal around −41 to −43 dBm | Screenshots 1–2 |
| Network test IP | Redacted from public repository | Screenshot 2 |
| Firmware versions | Main Module V1.2.7 and MCU Module V1.2.7; no update offered at capture | New screenshot 1 |
| Wi-Fi module | Board label reads CB3S | New screenshot 4 |
| Power source | Internal cell is marked 3.7 V, 600 mAh | New screenshot 5 |
| Audible component | A board component marked B2 looks like a buzzer | New screenshots 4–5 |
| Device LAN address during live check | Redacted from public repository | Local network scan on 2026-09-29; DHCP address may change |
| Local announcement ID | Matched app Virtual ID; redacted from public repository | Decoded local UDP broadcast on 2026-09-29 |
| Advertised local protocol | Version `3.4` | Decoded local UDP broadcast on 2026-09-29 |
| Product key | `rocfghml4gy1vvr8` | Decoded local UDP broadcast on 2026-09-29 |
| Local TCP service | Port `6668` accepts a TCP connection | Local network check on 2026-09-29 |

The network test IP is **not a verified local/LAN IP**. The phone's private address and private Wi-Fi MAC in screenshots 7–8 belong to the phone. The router address is also not the device address. The Wi-Fi name is redacted; no password was supplied or requested.

The project brief says the physical device bears Tuya Smart, Smart Life, 2.4 GHz Wi-Fi IEEE 802.11 b/g/n, DC 5V USB, and CE/FCC/RoHS markings. These remain **owner-reported details** because the new photos show the interior rather than the exterior label. The CB3S is a Tuya Wi-Fi/BLE module according to its [official datasheet](https://developer.tuya.com/en/docs/iot/cb3s?id=Kai94mec0s076), but CB3S is the **radio module model, not the final device model**. A buzzer-like component does not prove software control of a siren. The label also shows a module serial and part number; these are omitted from this repository.

## Still unknown

- Exact finished-device model, manufacturer, product ID, and hardware revision.
- Whether readings come from sensors inside this device or another connected component.
- Whether the buzzer functions as an alarm and whether local software can control it.
- The device's local encryption key. Version 3.4 requires it to read telemetry; it was not present in the supplied screenshots.
- Sensor Data Point IDs and units as returned by a successful local status read.

The owner has no further photos available. An exterior product label would be useful if found later. Local hardware investigation options are in [device investigation](device-investigation.md).
