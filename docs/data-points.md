# Local signal mapping

The existing sensor's local status response has now been queried twice over protocol 3.4. DP `1` changed from `274` to `275` (shown as 27.4 to 27.5 °C with scale 10), DP `2` changed from `685` to `700` (68.5 to 70.0% with scale 10), and DP `4` was `100`, matching the 100% battery value shown in Smart Life. DPs `17` and `18` were both `30`, matching the app's 30-second temperature and humidity report settings. This supports mapping DP `1` to temperature and DP `2` to humidity; verify the values against the phone app after the dashboard starts.

Live LAN discovery verifies the device's private LAN address (assigned by DHCP and subject to change) and protocol version 3.4. Authenticated local status queries now return changing readings and the DP IDs above. The broadcast still provides identity and protocol metadata only; it is not telemetry.

If open firmware is installed after a full backup and pinout investigation, record for each discovered MCU signal: UART pins and baud rate, numeric data point or message identifier, type, raw value, scale, unit, direction, observed behavior, and evidence. ESPHome's [MCU serial component](https://esphome.io/components/tuya/) can log observed data points locally, but its example IDs are **not** this device's IDs.

If using an independent ESPHome sensor, record the exact web API entity names and units instead. Do not add a sensor path to `.env` until its returned value and unit have been checked against the physical environment.
