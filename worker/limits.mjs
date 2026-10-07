export async function reserve(db, config, ip, tokens, id, now = Date.now()) {
  const day = new Date(now).toISOString().slice(0, 10), bucket = Math.floor(now / 60000);
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(config.secret), {name:'HMAC',hash:'SHA-256'}, false, ['sign']);
  const subject = Array.from(new Uint8Array(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(day+':'+ip))), x=>x.toString(16).padStart(2,'0')).join('');
  const q = (sql,...args) => db.prepare(sql).bind(...args);
  // D1 batch is a transaction. A CHECK failure rolls back every reservation.
  try {
    await db.batch([
      q('DELETE FROM ss07_rate WHERE bucket < ?',bucket-2),
      q('DELETE FROM ss07_daily WHERE day < ?',new Date(now-31*86400000).toISOString().slice(0,10)),
      q('DELETE FROM ss07_leases WHERE expires <= ?',now),
      ...[subject,'global'].map(who=>q('INSERT INTO ss07_rate(bucket,subject,count) VALUES(?,?,1) ON CONFLICT(bucket,subject) DO UPDATE SET count=count+1',bucket,who)),
      q('INSERT INTO ss07_daily(day,requests,reserved,actual) VALUES(?,1,?,0) ON CONFLICT(day) DO UPDATE SET requests=requests+1,reserved=reserved+excluded.reserved',day,tokens),
      q(`INSERT INTO ss07_guard(ok) SELECT 0 WHERE
        (SELECT count FROM ss07_rate WHERE bucket=? AND subject=?) > ? OR
        (SELECT count FROM ss07_rate WHERE bucket=? AND subject='global') > ? OR
        (SELECT requests FROM ss07_daily WHERE day=?) > ? OR
        (SELECT reserved FROM ss07_daily WHERE day=?) > ? OR
        (SELECT COUNT(*) FROM ss07_leases) >= ?`,bucket,subject,config.rate,bucket,config.globalRate,day,config.dailyRequests,day,config.dailyTokens,config.concurrent),
      q('INSERT INTO ss07_leases(id,expires) VALUES(?,?)',id,now+config.timeout+10000)
    ]);
  } catch (error) {
    if (!String(error.message).includes('CHECK constraint failed')) throw error;
    throw Object.assign(Error('SS07 is busy or has reached a usage limit. Please wait and retry, or use the contact section.'),{status:429,code:'usage_limit',retry:60});
  }
  return day;
}
export async function release(db,id,day,tokens=0) {
  await db.batch([db.prepare('DELETE FROM ss07_leases WHERE id=?').bind(id),db.prepare('UPDATE ss07_daily SET actual=actual+? WHERE day=?').bind(tokens,day)]);
}
