CREATE TABLE IF NOT EXISTS readings (
  id INTEGER PRIMARY KEY, captured_at TEXT NOT NULL, source TEXT NOT NULL,
  temperature REAL, humidity REAL, raw_status TEXT
);
CREATE INDEX IF NOT EXISTS idx_readings_time ON readings(captured_at DESC);
CREATE TABLE IF NOT EXISTS rules (
  id INTEGER PRIMARY KEY, metric TEXT NOT NULL CHECK(metric IN ('temperature','humidity')),
  operator TEXT NOT NULL CHECK(operator IN ('above','below')),
  threshold REAL NOT NULL, enabled INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE IF NOT EXISTS alarms (
  id INTEGER PRIMARY KEY, rule_id INTEGER NOT NULL REFERENCES rules(id),
  reading_id INTEGER NOT NULL REFERENCES readings(id),
  triggered_at TEXT NOT NULL, value REAL NOT NULL, acknowledged_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_alarms_time ON alarms(triggered_at DESC);
CREATE TABLE IF NOT EXISTS rule_state (
  rule_id INTEGER PRIMARY KEY REFERENCES rules(id), active INTEGER NOT NULL DEFAULT 0
);
