# Connect a separate local sensor

This is the selected path for real readings without a vendor cloud or the supplied device's unknown protocol. TempmoX will read a **new, independent** Wi-Fi sensor. The supplied battery device does not need modification and will not provide the readings in this setup.

## Parts

- A **classic ESP32 development board** with USB and pins marked `3V3`, `GND`, `GPIO21`/`21`, and `GPIO22`/`22`. Do not substitute an ESP32-C3/C6/S3 board without adapting the pin configuration.
- An **SHT31-D breakout** with pins `VIN` (or `VCC`), `GND`, `SDA`, and `SCL`, default I²C address `0x44`.
- Four female-to-female jumper wires if both boards have male header pins, a USB **data** cable, and a USB power source for continuous operation. Choose a breakout with soldered headers if you do not want to solder.

An [official ESPHome Starter Kit](https://esphome.io/starter-kit/) also includes temperature and humidity sensing with easier physical assembly, but its ESP32-C6/AHT20F hardware needs a different firmware configuration than the one in this folder. This guide is specifically for the classic ESP32 + SHT31-D pair.

## Wire the boards

Disconnect USB power first. Use the labels printed on your actual boards.

| SHT31-D breakout | ESP32 development board |
| --- | --- |
| VIN / VCC | 3V3 |
| GND | GND |
| SDA | GPIO21 / 21 |
| SCL | GPIO22 / 22 |

The SHT31-D breakout's power range and default address depend on the particular board you buy; check its manufacturer's pinout. The linked [Adafruit breakout pinout](https://learn.adafruit.com/adafruit-sht31-d-temperature-and-humidity-sensor-breakout/pinouts) supports 3.3 V and uses address `0x44`. ESPHome documents [GPIO21 and GPIO22 as the usual classic ESP32 I²C pins](https://esphome.io/components/i2c/).

## Install firmware

1. Install the [ESPHome Device Builder desktop app for Windows](https://esphome.io/install/). Open its dashboard and use **Import from File** to load `firmware/tempmox-sensor.yaml` (see [ESPHome getting started](https://esphome.io/install/getting-started/)). Importing may copy the YAML into the builder's own configuration directory. Find the imported YAML there; `secrets.yaml` must be placed in that **same directory**.
2. Copy `firmware/secrets.yaml.example` to `secrets.yaml` beside the imported YAML in the builder's configuration directory. Enter your Wi-Fi name and password, and create a **different, random** password for the local sensor web server. The phone's IP is **not** the new sensor's IP. If you use the command line from this project instead of the desktop app, put `secrets.yaml` in this project's `firmware` folder.
3. Plug the **new ESP32** into the PC using a data-capable USB cable. In ESPHome, validate and install the imported configuration over USB. The [ESPHome command line equivalent](https://esphome.io/guides/cli/) is `esphome run firmware/tempmox-sensor.yaml`; the desktop app can do this without installing Python yourself.
4. Inspect the ESPHome logs for an I²C device at `0x44` and fresh temperature and humidity values. If `0x44` is absent, recheck power, SDA, SCL, and the breakout's actual address. Only the **new ESP32** should be flashed.
5. Find the new sensor's **LAN IP address** from your router's client list or ESPHome logs. In a browser on the same Wi-Fi, open `http://<NEW_SENSOR_IP>/` and sign in with `web_username` and `web_password`. The page should show **Room Temperature** and **Room Humidity**. Keep the sensor powered by USB.

## Connect TempmoX

1. In the TempmoX project root, copy `.env.example` to `.env`.
2. Set these exact lines, replacing the IP and matching the private web credentials in `secrets.yaml`:

   ```dotenv
   SOURCE=esphome
   LOCAL_BASE_URL=http://<NEW_SENSOR_IP>/
   LOCAL_TEMPERATURE_PATH=/sensor/Room Temperature
   LOCAL_HUMIDITY_PATH=/sensor/Room Humidity
   LOCAL_USERNAME=tempmox
   LOCAL_PASSWORD=<YOUR_WEB_PASSWORD>
   ```

3. From the project root, run `node --env-file=.env backend/src/server.js` and open <http://127.0.0.1:3000>. It should say **LOCAL SENSOR**, show a recent timestamp, and show numbers close to those on the ESPHome page. Use **Check sensor now** to request an immediate reading. `http://<NEW_SENSOR_IP>/sensor/Room%20Temperature` and `/sensor/Room%20Humidity` are the local JSON endpoints if you want to verify them directly.
4. Keep this PC and the ESP32 on the same reachable private network. The sensor's address may change after router restart, so reserve its LAN IP in the router once it works. The monitoring server must remain running for recording and alarms.

## Security and limits

The ESPHome web server uses HTTP on the private LAN. This template sets `basic` authentication so the current TempmoX client can access it; Basic credentials are recoverable by anyone who can inspect traffic on that LAN. Use a separate strong web password, a trusted Wi-Fi network, and never forward port 80 to the internet. ESPHome [documents this behavior and recommends authentication and network isolation](https://esphome.io/components/web_server/).

ESPHome publishes a new sensor measurement every 30 seconds. TempmoX polls every 60 seconds by default. The dashboard displays the last stored measurement and its capture time; browser alerts require the dashboard to remain open. This setup has not been validated against physical hardware because the new ESP32 and breakout are not present here. The firmware configuration has not been compiled in this workspace; ESPHome's validation and USB install are part of the device setup above.
