# Local setup

## Demo mode

Run `node backend/src/server.js` from the repository root and open <http://127.0.0.1:3000>. The dashboard says **SIMULATED DATA**. This tests the app, database, alarms, charts, and export without claiming to read the physical device.

## ESPHome local sensor mode

This mode is ready for a device already running ESPHome with named temperature and humidity entities and `web_server:` enabled. For the selected independent ESP32 + SHT31-D path, follow [separate sensor setup](separate-sensor.md) first. The supplied CB3S device does **not** currently meet this requirement. ESPHome's [web API](https://esphome.io/web-api/) returns numeric sensor `value` fields at `/sensor/<entity_name>`.

1. Copy `.env.example` to `.env`.
2. Set `SOURCE=esphome`, `LOCAL_BASE_URL=http://<device-LAN-IP>/`, and the exact entity paths such as `/sensor/Room Temperature`. Those names are examples, not discovered names from this hardware.
3. If the ESPHome web server uses Basic auth, set `LOCAL_USERNAME` and `LOCAL_PASSWORD` locally. The app does not support Digest auth yet. Keep the web server on a trusted private network; HTTP Basic exposes credentials to observers on that network. ESPHome [recommends authentication and network isolation](https://esphome.io/components/web_server/).
4. Start with `node --env-file=.env backend/src/server.js`. The backend checks that the values are numeric and labelled °C and %. The UI reports polling errors and stale data.

## Local push bridge mode

Use this when a separate bridge program can decode real sensor values and POST to TempmoX on the **same computer**. The bridge implementation depends on verified hardware communication; none has been invented.

1. Set `SOURCE=push` in `.env` and generate a random token: `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"`. Put it in `INGEST_TOKEN`. Do not commit or share it.
2. Start with `node --env-file=.env backend/src/server.js`.
3. A bridge POSTs JSON such as `{"temperature":26.6,"humidity":79.4}` to `http://127.0.0.1:3000/api/ingest` with header `Authorization: Bearer <INGEST_TOKEN>` and `Content-Type: application/json`. The numbers are an **example payload**, not a hardware reading.

The server uses its receive time as the capture time. It accepts only numbers within −50 to 100 °C and 0 to 100% humidity. It listens on loopback only. A bridge on another machine needs an authenticated HTTPS reverse proxy or a secure tunnel; do not expose the Node port directly.

## Existing Tuya sensor, local LAN only

This uses TinyTuya only for its local encrypted protocol client. TempmoX does not call Tuya Cloud at runtime. The existing sensor was discovered on the local network at TCP port 6668 and advertises protocol 3.4; DHCP may change its address.

On this computer, `.env` is already configured, and the running dashboard is at <http://127.0.0.1:3001/>. It has stored and displayed real readings from the existing sensor. The steps below are for setting up another computer or replacing the local configuration.

1. Install Python 3 for Windows from [python.org](https://www.python.org/downloads/windows/). In the installer, enable **Add python.exe to PATH**.
2. Open PowerShell in the TempmoX project folder and install the small local protocol dependency: `python -m pip install -r backend/requirements.txt`.
3. In `.env`, keep `TUYA_LOCAL_KEY` private. Set `SOURCE=tuya`, `TUYA_DEVICE_ID=<your-device-id>`, `TUYA_DEVICE_IP=<your-device-LAN-IP>`, `TUYA_PROTOCOL_VERSION=3.4`, and `TUYA_DISCOVER_DPS=true`.
4. Start TempmoX with `node --env-file=.env backend/src/server.js`, open <http://127.0.0.1:3000>, and press **Inspect sensor data points**. This performs a read-only LAN status query. Match the numeric DP values to the temperature and humidity visible in Smart Life. The UI never prints the Local Key.
5. Set `TUYA_TEMPERATURE_DP` and `TUYA_HUMIDITY_DP` to the matching IDs. Set scales based on raw values: for example, a raw temperature `266` for `26.6 °C` means scale `10`; a raw humidity `794` for `79.4%` means scale `10`. Set `TUYA_DISCOVER_DPS=false`, restart the app, then use **Check sensor now**. Only then will it store actual local readings.

The Tuya device and PC must be on the same trusted Wi-Fi/LAN, and the sensor must be awake. If the key appeared in a screenshot, treat it as exposed; re-pairing may be required to rotate it. Do not paste a key, `.env`, Cloud Access Secret, token, or unredacted API response into chat.

## Source changes

Demo, ESPHome, push, and Tuya LAN history stay separated in the dashboard and CSV export. Rules apply to the active source. The app resets the alarm crossing state when the source changes. Restart after changing `.env`.
