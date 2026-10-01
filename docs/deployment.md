# Deployment and recovery status

TempmoX is a tested local application. It has not been validated 24/7 against the physical device, because no verified local sensor feed exists yet. Production deployment is blocked on hardware integration, long-running reliability observation, notification choice, and a secure host.

Use Node.js 24+, a persistent writable `DATA_DIR`, a local `.env` outside Git, and `APP_PASSWORD`. Keep `HOST=127.0.0.1`. A service manager should restart the process and retain stdout/stderr logs. Remote access requires HTTPS termination and authentication in front of this loopback service.

For a simple cold backup, stop the process, copy the entire `data/` directory to protected storage, and restart. Test restoration with a copy in a separate directory. Do not commit backups or exports. An automated backup job and restore drill depend on the eventual deployment environment.

Before production: verify real readings for several days, compare against a trusted thermometer/hygrometer, test source outages and stale display, validate alarm thresholds, confirm PWA behavior on intended phones, and test authentication, TLS, restart, and backup recovery.
