# Device investigation without cloud integration

## Evidence already available

The supplied Smart Life screenshots show temperature, humidity, luminance UI, alarm thresholds, and settings. Device Update reports Main Module V1.2.7 and MCU Module V1.2.7. Interior photos show a CB3S Wi-Fi module, a 3.7 V battery, and a buzzer-like component. The finished-device model, sensor chip, and module-to-MCU wiring are still unknown. See [hardware identification](hardware-identification.md).

The device was subsequently found on the private LAN, matching the MAC shown in the app. It responds to ping, TCP port `6668` accepts connections, and it broadcasts a local discovery packet on UDP `6667`. The decoded packet confirms the app's Virtual ID and local protocol version `3.4`. The address can change with DHCP.

The TCP listener did not emit data until queried. Version 3.4 encrypts the local status exchange and requires the device's local encryption key. The provided screenshots contain a Virtual ID, not that key. The protocol reference documents that 3.4 monitoring needs the local key; the discovery broadcast alone does not include temperature or humidity. [Local protocol reference](https://github.com/jasonacox/tinytuya/blob/master/PROTOCOL.md#version-34)

When the device is awake on this same network, the owner can rerun `node scripts/find-device.js 192.168.1 <MAC-from-Smart-Life>` from the repository root. This scans only that private /24 subnet. The router's connected-client/DHCP page may also show the device IP. An absent scan result is inconclusive.

## Routes considered

| Route | Current assessment |
| --- | --- |
| Keep stock firmware and use its LAN protocol | **Working on this computer.** Protocol 3.4, the saved Local Key, and temperature/humidity data points have been verified with real readings. |
| Install open firmware on CB3S | Technically plausible: CB3S is BK7231N and is supported by [LibreTiny](https://docs.libretiny.eu/boards/cb3s/) and [ESPHome](https://esphome.io/components/libretiny/). Device-specific MCU wiring and sensor signals must be discovered; flashing now could disable the display, sensor, buzzer, or device recovery. |
| Use an independent local sensor/bridge | Most predictable route if stock hardware cannot be converted. An ESPHome-compatible temperature/humidity board could feed this app locally. It requires additional physical hardware. |
| USB serial bridge to existing board | Potentially possible if the MCU sends readable values on accessible UART lines, but the pins, voltage, baud rate, and messages are unverified. A hardware technician would need to inspect it safely. |

**Local client status:** TempmoX uses a local-only TinyTuya adapter for protocol 3.4. It has been run against the sensor and has stored real temperature and humidity readings. Keep the key in `.env` on the PC and out of chat/Git.

This is a battery-powered unit. If the replacement firmware sleeps to preserve battery, continuous HTTP polling may not be reachable; a wake-and-push design or continuous USB power may be needed. That choice requires measurement on the real device.

The dashboard on this computer uses `SOURCE=tuya` and shows authenticated local status responses. Discovery packets are not telemetry; only authenticated status responses are treated as readings.
