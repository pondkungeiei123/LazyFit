import { activityXp, CALORIE_DEFAULT } from './domain.ts'
import { columns, metadata, migrations, tables } from './schema.ts'
import type { Row, Statement, Table, Value } from './schema.ts'

export interface Database {
  query(sql: string, values?: Value[]): Promise<Row[]>
  write(statements: Statement[]): Promise<void>
}
export type Snapshot = Record<Table, Row[]>

const statement = (sql: string, values: Value[] = []): Statement => ({ statement: sql, values })

export async function migrate(db: Database) {
  await db.write([statement('CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL)')])
  const versions = await db.query('SELECT version FROM schema_migrations')
  for (const [index, changes] of migrations.entries()) {
    const version = index + 1
    if (versions.some((row) => row.version === version)) continue
    await db.write([...changes.map((sql) => statement(sql)), statement(
      'INSERT OR IGNORE INTO schema_migrations VALUES (?, ?)', [version, new Date().toISOString()],
    )])
  }
}

function insert(table: Table, row: Row, mode: 'merge' | 'update' = 'merge') {
  const names = [...metadata, ...columns[table]]
  const update = ['updated_at', ...columns[table]].map((key) => `${key}=excluded.${key}`).join(', ')
  return statement(
    `INSERT INTO ${table} (${names.join(', ')}) VALUES (${names.map(() => '?').join(', ')})
     ON CONFLICT ${mode === 'update' ? `(id) DO UPDATE SET ${update}` : 'DO NOTHING'}`,
    names.map((key) => row[key] ?? null),
  )
}

function entry(data: Row, id = crypto.randomUUID() as string, source = 'manual', sourceId = id): Row {
  const now = new Date().toISOString()
  return { ...data, id, source, source_id: sourceId, created_at: now, updated_at: now }
}

export class Repository {
  private pending: Promise<unknown> = Promise.resolve()
  private readonly db: Database
  constructor(db: Database) { this.db = db }

  private enqueue<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.pending.then(operation)
    this.pending = result.catch(() => undefined)
    return result
  }

  snapshot(): Promise<Snapshot> {
    return this.enqueue(async () => {
      const entries = await Promise.all(tables.map(async (table) => [
        table, await this.db.query(`SELECT * FROM ${table} ORDER BY created_at DESC, id DESC`),
      ]))
      return Object.fromEntries(entries) as Snapshot
    })
  }

  setup(profile: Row, target: number, calories = CALORIE_DEFAULT) {
    return this.enqueue(() => this.db.write([
      insert('profiles', entry(profile, 'profile'), 'update'),
      insert('app_settings', entry({ calories, target_weight: target }, 'settings'), 'update'),
    ]))
  }

  save(table: 'weight_logs' | 'waist_logs' | 'food_logs' | 'sleep_logs', data: Row, id?: string) {
    return this.enqueue(() => this.db.write([insert(table, entry(data, id), id ? 'update' : 'merge')]))
  }

  saveMeal(data: Row, id?: string, personal?: { id: string; name: string }) {
    return this.enqueue(() => this.db.write([
      ...(personal ? [insert('food_catalog', entry({ name: personal.name }, personal.id))] : []),
      insert('food_logs', entry(data, id), id ? 'update' : 'merge'),
    ]))
  }

  favoriteFood(catalogId: string, favorite: boolean) {
    return this.enqueue(() => this.db.write(favorite
      ? [insert('user_food_favorites', entry({ catalog_id: catalogId }))]
      : [statement('DELETE FROM user_food_favorites WHERE catalog_id = ?', [catalogId])]))
  }

  remove(table: 'weight_logs' | 'waist_logs' | 'food_logs' | 'sleep_logs' | 'exercise_logs', id: string) {
    return this.enqueue(() => this.db.write([statement(`DELETE FROM ${table} WHERE id = ? AND source = 'manual'`, [id])]))
  }

  exercise(day: string, name: string, seconds: number, id = crypto.randomUUID() as string) {
    const points = activityXp(seconds)
    return this.enqueue(() => this.db.write([
      insert('exercise_logs', entry({ day, name, seconds }, id)),
      ...(points ? [insert('xp_events', entry({ day, points }, `xp:${day}`, 'activity', day))] : []),
    ]))
  }

  steps(day: string, steps: number | null, source: 'manual' | 'health_connect') {
    const commands = steps === null
      ? [statement('DELETE FROM daily_activity WHERE day = ? AND source = ?', [day, source])]
      : [insert('daily_activity', entry({ day, steps }, `${source}:${day}`, source, day), 'update')]
    if (source === 'health_connect') commands.push(insert('sync_metadata', entry({
      status: steps === null ? 'empty' : 'data', last_sync: new Date().toISOString(),
    }, 'health_connect', source), 'update'))
    return this.enqueue(() => this.db.write(commands))
  }

  async exportJson() {
    return JSON.stringify({ format: 'lazyfit-v1', schema: 3, data: await this.snapshot() })
  }

  importJson(json: string) {
    return this.enqueue(async () => {
      if (json.length > 50_000_000) throw new Error('ไฟล์สำรองใหญ่เกิน 50 MB')
      const backup = JSON.parse(json)
      if (backup?.format !== 'lazyfit-v1' || !backup.data || ![undefined, 3].includes(backup.schema)) {
        throw new Error('รูปแบบไฟล์สำรองไม่ถูกต้อง')
      }
      const legacy = backup.schema === undefined
      const commands: Statement[] = []
      for (const table of tables) {
        const rows = backup.data[table]
        if (legacy && rows === undefined && (table === 'food_catalog' || table === 'user_food_favorites')) continue
        if (!Array.isArray(rows)) throw new Error('ไฟล์สำรองมีตารางไม่ครบ')
        for (const raw of rows) {
          const row = legacy && table === 'food_logs' && raw && typeof raw === 'object'
            ? { nutrition_method: null, ingredient_mix: null, catalog_id: null, ...raw }
            : raw
          const names = [...metadata, ...columns[table]]
          if (!row || typeof row !== 'object' || !names.every((name) => Object.hasOwn(row, name)) ||
            !metadata.every((name) => typeof row[name] === 'string' && row[name].length > 0 && row[name].length <= 160) ||
            !names.every((name) => row[name] === null || typeof row[name] === 'string' || Number.isFinite(row[name]))) {
            throw new Error('พบข้อมูลที่อ่านไม่ได้ในไฟล์สำรอง')
          }
          commands.push(insert(table, row))
        }
      }
      if (commands.length) await this.db.write(commands)
    })
  }
}


