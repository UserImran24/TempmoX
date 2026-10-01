# TempmoX

TempmoX is a local-first environmental monitor. The application has **no Tuya Cloud API, account, token, or client secret dependency**. It stores timestamped readings in SQLite and provides a responsive PWA dashboard, freshness status, charts, configurable alarm rules, browser alerts while the page is open, acknowledgement, and CSV export.

## Current state

On this computer, `.env` selects the existing sensor over its local Wi-Fi connection. Live temperature and humidity have been read, stored, and displayed at <http://127.0.0.1:3001/>. The repository default remains a clearly labelled simulation when `.env` is not loaded. Three real-device inputs are implemented:

- `SOURCE=esphome`: poll the [ESPHome web API](https://esphome.io/web-api/) on the local network for temperature and humidity. This requires working compatible firmware on the physical device or a separate ESPHome sensor.
- `SOURCE=push`: accept authenticated readings from a bridge process on the same computer. A USB serial bridge or other local collector can use this input after its hardware protocol is known.
- `SOURCE=tuya`: query the existing sensor using its encrypted local LAN protocol. Runtime does not call Tuya Cloud. Requires Python, TinyTuya, the Local Key, the current LAN IP, and confirmed temperature/humidity data points; see [Tuya local setup](docs/setup.md#existing-tuya-sensor-local-lan-only).

The existing sensor is the active hardware path. A separate ESP32 + SHT31-D option remains documented in [separate sensor setup](docs/separate-sensor.md) if the original hardware becomes unavailable. The supplied device's internal wiring is unverified; do not flash it based only on its radio module model.

## Run

Requires Node.js 24 or newer. No npm installation is needed.

```powershell
cd C:\Users\LENOVO\Documents\Codex\2026-09-29\the\tuya-monitoring
node --env-file=.env backend/src/server.js
```

Open <http://127.0.0.1:3001/> on this computer. The local `.env` supplies the device configuration and is excluded from Git. On another computer, copy `.env.example` to `.env`, configure its own sensor and port, then use the same start command. Run tests with `node --test backend/tests/*.test.js`.

See [separate sensor setup](docs/separate-sensor.md), [local setup](docs/setup.md), [hardware investigation](docs/hardware-identification.md), [device options](docs/device-investigation.md), and [signal mapping](docs/data-points.md).

## Limits

The existing sensor's LAN IP, protocol 3.4, and temperature/humidity data points have been verified. Its Wi-Fi address can change after a router restart, and the battery-powered device can become unreachable. The dashboard shows the last capture time, marks old data stale, and retries every configured interval. Physical controls, notifications while the page is closed, and production deployment remain open.

All local history is under `data/`, which Git ignores. Do not commit `.env`, exports, or backups. The server binds to loopback, and remote access needs a separate HTTPS proxy and authentication. See [architecture](docs/architecture.md) and [deployment](docs/deployment.md).
