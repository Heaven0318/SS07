import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { createHmac } from 'node:crypto';
export class Limits {
  constructor(config) {
    this.config = config;
    mkdirSync(config.dataDir, { recursive: true });
    this.db = new DatabaseSync(join(config.dataDir, 'ss07-usage.sqlite'));
    this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
      CREATE TABLE IF NOT EXISTS daily(day TEXT PRIMARY KEY, requests INTEGER, reserved INTEGER, actual INTEGER);
      CREATE TABLE IF NOT EXISTS rate(bucket TEXT, subject TEXT, count INTEGER, PRIMARY KEY(bucket,subject));`);
  }
  reserve(ip, tokens, now = Date.now()) {
    const day = new Date(now).toISOString().slice(0, 10), bucket = String(Math.floor(now / 60000));
    const subject = createHmac('sha256', this.config.secret).update(day + ':' + ip).digest('hex');
    this.db.exec('BEGIN IMMEDIATE');
    try {
      this.db.prepare('DELETE FROM rate WHERE bucket < ?').run(String(Number(bucket) - 2));
      this.db.prepare('DELETE FROM daily WHERE day < ?').run(new Date(now - 31 * 86400000).toISOString().slice(0, 10));
      for (const [who, cap] of [[subject, this.config.rate], ['global', this.config.globalRate]]) {
        const count = this.db.prepare('SELECT count FROM rate WHERE bucket=? AND subject=?').get(bucket, who)?.count || 0;
        if (count >= cap) throw Object.assign(Error('Too many requests. Please wait a minute and retry.'), { status: 429, code: 'rate_limit', retry: 60 });
      }
      // Count every validated attempt, including attempts while unavailable or over budget.
      for (const who of [subject, 'global']) this.db.prepare('INSERT INTO rate VALUES(?,?,1) ON CONFLICT(bucket,subject) DO UPDATE SET count=count+1').run(bucket, who);
      const usage = this.db.prepare('SELECT * FROM daily WHERE day=?').get(day);
      if ((usage?.requests || 0) >= this.config.dailyRequests || (usage?.reserved || 0) + tokens > this.config.dailyTokens) {
        this.db.exec('COMMIT');
        throw Object.assign(Error('SS07 has reached its daily usage limit. Please use the contact section or try tomorrow.'), { status: 429, code: 'daily_limit' });
      }
      this.db.prepare('INSERT INTO daily VALUES(?,1,?,0) ON CONFLICT(day) DO UPDATE SET requests=requests+1,reserved=reserved+excluded.reserved').run(day, tokens);
      this.db.exec('COMMIT');
      return day;
    } catch (e) { if (this.db.isTransaction) this.db.exec('ROLLBACK'); throw e; }
  }
  record(day, tokens) { this.db.prepare('UPDATE daily SET actual=actual+? WHERE day=?').run(tokens, day); }
  close() { this.db.close(); }
}
