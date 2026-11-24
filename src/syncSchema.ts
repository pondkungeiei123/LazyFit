// Each committed local mutation has its own immutable idempotency key.
// Keep the outbox device-local: backups restore domain rows, never sessions or acknowledgements.
export function syncSchema(domains: Record<string, readonly string[]>) {
  const sql = [
    `CREATE TABLE sync_owner (singleton INTEGER PRIMARY KEY CHECK(singleton=1), owner TEXT NOT NULL, enabled INTEGER NOT NULL CHECK(enabled IN(0,1)), last_ack TEXT)`,
    `CREATE TABLE sync_heads (entity TEXT NOT NULL, record_id TEXT NOT NULL, revision TEXT NOT NULL, PRIMARY KEY(entity,record_id))`,
    `CREATE TABLE sync_queue (seq INTEGER PRIMARY KEY AUTOINCREMENT, operation_id TEXT NOT NULL UNIQUE,
       entity TEXT NOT NULL, record_id TEXT NOT NULL, payload TEXT, created_at TEXT NOT NULL,
       base_revision TEXT, attempted INTEGER NOT NULL DEFAULT 0, status TEXT NOT NULL DEFAULT 'pending'
       CHECK(status IN ('pending','conflict')), remote_revision TEXT)`,
    'CREATE INDEX sync_record_order ON sync_queue(entity,record_id,seq)',
  ]
  for (const [table,fields] of Object.entries(domains)) {
    const json = (prefix:string) => 'json_object('+fields.filter(f=>f!=='photo').map(f=>"'"+f+"',"+prefix+f).join(',')+')'
    const allowed = table==='xp_events' ? "('exercise','activity')" : "('manual')"
    const insert = 'INSERT INTO sync_queue(operation_id,entity,record_id,payload,created_at)'
    const key = 'lower(hex(randomblob(16)))'
    const now = "strftime('%Y-%m-%dT%H:%M:%fZ','now')"
    sql.push(`${insert} SELECT ${key},'${table}',id,${json('')},${now} FROM ${table} WHERE source IN ${allowed}`)
    for (const event of ['INSERT','UPDATE','DELETE']) {
      const record = event==='DELETE'?'OLD':'NEW'
      sql.push(`CREATE TRIGGER queue_${table}_${event} AFTER ${event} ON ${table}
        WHEN ${record}.source IN ${allowed} BEGIN ${insert} VALUES
        (${key},'${table}',${record}.id,${event==='DELETE'?'NULL':json('NEW.')},${now}); END`)
    }
  }
  return sql
}
