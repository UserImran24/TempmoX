# Architecture

```text
Local sensor with ESPHome web API ─┐
                                   ├→ Node.js monitor → SQLite → local API → PWA
Local bridge on this computer ─────┘                 ↘ alarm rules/events
```

`local-sensor.js` polls only a configured private-network HTTP sensor endpoint. `service.js` handles polling, stale detection, and bridge ingestion. `store.js` owns SQLite migrations and data access. `server.js` exposes the local API and PWA. There is no Tuya Cloud client or browser-side hardware credential.

ESPHome and local Tuya modes poll every 60 seconds by default; the UI refreshes every 10 seconds. A reading is stale after 180 seconds by default. Failed polls retry at the next normal interval, and **Check sensor now** starts a read immediately. Push mode is event-driven by the bridge; it has no polling interval. Alarm events are application-level records and do not sound the physical buzzer. With the page open and browser permission granted, new events trigger browser notifications. There is no push delivery when the page is closed.

The PWA service worker caches static files only, never API responses. The UI reports an error or stale state when fresh data is unavailable. The server binds to loopback and requires a token for bridge ingestion. Optional `APP_PASSWORD` protects the UI on the local machine. An HTTPS reverse proxy, authentication, and a chosen deployment host are required before remote access.
