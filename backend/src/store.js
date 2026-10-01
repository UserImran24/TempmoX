import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export class Store {
  constructor(dataDir) {
    mkdirSync(dataDir, { recursive: true });
    this.db = new DatabaseSync(join(dataDir, 'tempmox.sqlite'));
    this.db.exec('PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;');
    const version = this.db.prepare('PRAGMA user_version').get().user_version;
    if (version > 1) throw new Error(`Database version ${version} is newer than this application`);
    if (version === 0) {
      const sql = readFileSync(new URL('../../database/migrations/001_initial.sql', import.meta.url), 'utf8');
      this.db.exec(`BEGIN; ${sql} PRAGMA user_version=1; COMMIT;`);
    }
  }

  addReading({ capturedAt, source, temperature, humidity, rawStatus = null }) {
    const previousSource = this.db.prepare('SELECT source FROM readings ORDER BY id DESC LIMIT 1').get()?.source;
    if (previousSource && previousSource !== source) this.db.exec('DELETE FROM rule_state');
    const result = this.db.prepare('INSERT INTO readings(captured_at,source,temperature,humidity,raw_status) VALUES(?,?,?,?,?)')
      .run(capturedAt, source, temperature, humidity, rawStatus ? JSON.stringify(rawStatus) : null);
    const readingId = Number(result.lastInsertRowid);
    for (const rule of this.db.prepare('SELECT * FROM rules WHERE enabled=1').all()) {
      const value = rule.metric === 'temperature' ? temperature : humidity;
      if (value === null || value === undefined) continue;
      const active = rule.operator === 'above' ? value > rule.threshold : value < rule.threshold;
      const previous = this.db.prepare('SELECT active FROM rule_state WHERE rule_id=?').get(rule.id)?.active === 1;
      if (active && !previous) {
        this.db.prepare('INSERT INTO alarms(rule_id,reading_id,triggered_at,value) VALUES(?,?,?,?)').run(rule.id, readingId, capturedAt, value);
      }
      this.db.prepare('INSERT INTO rule_state(rule_id,active) VALUES(?,?) ON CONFLICT(rule_id) DO UPDATE SET active=excluded.active').run(rule.id, Number(active));
    }
    return readingId;
  }

  latest(source) { return this.db.prepare('SELECT id,captured_at AS capturedAt,source,temperature,humidity FROM readings WHERE source=? ORDER BY id DESC LIMIT 1').get(source) || null; }
  history(from, to, limit = 500, source) {
    return this.db.prepare('SELECT captured_at AS capturedAt,source,temperature,humidity FROM readings WHERE source=? AND captured_at>=? AND captured_at<=? ORDER BY captured_at DESC LIMIT ?').all(source, from, to, limit);
  }
  *exportRows(from, to, source) {
    yield* this.db.prepare('SELECT captured_at AS capturedAt,source,temperature,humidity FROM readings WHERE source=? AND captured_at>=? AND captured_at<=? ORDER BY captured_at ASC').iterate(source, from, to);
  }
  rules() { return this.db.prepare('SELECT id,metric,operator,threshold,enabled FROM rules ORDER BY id').all().map(r => ({ ...r, enabled: Boolean(r.enabled) })); }
  addRule(metric, operator, threshold) {
    const result = this.db.prepare('INSERT INTO rules(metric,operator,threshold) VALUES(?,?,?)').run(metric, operator, threshold);
    return Number(result.lastInsertRowid);
  }
  deleteRule(id) {
    this.db.prepare('DELETE FROM rule_state WHERE rule_id=?').run(id);
    this.db.prepare('UPDATE rules SET enabled=0 WHERE id=?').run(id);
  }
  alarms(source) {
    return this.db.prepare(`SELECT a.id,a.triggered_at AS triggeredAt,a.value,a.acknowledged_at AS acknowledgedAt,
      r.metric,r.operator,r.threshold FROM alarms a JOIN rules r ON r.id=a.rule_id JOIN readings x ON x.id=a.reading_id WHERE x.source=? ORDER BY a.id DESC LIMIT 100`).all(source);
  }
  acknowledge(id) { return this.db.prepare('UPDATE alarms SET acknowledged_at=? WHERE id=? AND acknowledged_at IS NULL').run(new Date().toISOString(), id).changes; }
  close() { this.db.close(); }
}
