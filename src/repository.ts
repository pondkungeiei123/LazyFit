import { activityXp, CALORIE_DEFAULT, DAILY_XP_LIMIT, FIRST_MISSION_BONUS } from './domain.ts'
import { columns, metadata, migrations, tables, v11Columns } from './schema.ts'
import type { Row, Statement, Table, Value } from './schema.ts'

export interface Database {
  query(sql: string, values?: Value[]): Promise<Row[]>
  write(statements: Statement[]): Promise<void>
}
export type Snapshot = Record<Table, Row[]>
export type ExerciseAward = { activity: number; bonus: number }

const numericFields = new Set(['age', 'height', 'initial_weight', 'kg', 'cm', 'grams', 'base_grams', 'kcal',
  'protein', 'carbs', 'fat', 'seconds', 'minutes', 'steps', 'points', 'activity_points', 'bonus_points',
  'calories', 'target_weight', 'activity_factor', 'target'])
const nullableFields = new Set(['grams', 'kcal', 'protein', 'carbs', 'fat', 'photo', 'nutrition_method',
  'ingredient_mix', 'catalog_id', 'meal', 'activity_factor', 'note', 'measured_at'])

function validField(table: Table, name: string, value: unknown) {
  if (value === null) return nullableFields.has(name) && !(table === 'user_food_favorites' && name === 'catalog_id')
  if (numericFields.has(name)) return Number.isFinite(value)
  if (typeof value !== 'string') return false
  if (name === 'day') {
    const date = new Date(value + 'T00:00:00Z')
    return /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(date.valueOf()) && date.toISOString().slice(0, 10) === value
  }
  if (name === 'photo') return value.length <= 700000 && /^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/.test(value)
  if (name === 'ingredient_mix') {
    try {
      const parts = JSON.parse(value)
      return Array.isArray(parts) && parts.length > 0 && parts.every((part) =>
        part && typeof part.id === 'string' && part.id.length > 0 && Number.isFinite(part.grams)
        && part.grams >= 0 && part.grams <= 10000)
    } catch { return false }
  }
  return true
}

const statement = (sql: string, values: Value[] = []): Statement => ({ statement: sql, values })

export async function migrate(db: Database) {
  await db.write([statement('CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL)')])
  const versions = await db.query('SELECT version FROM schema_migrations')
  for (const [index, changes] of migrations.entries()) {
    const version = index + 1
    if (versions.some((row) => row.version === version)) continue
    const oldTables = Object.keys(v11Columns)
    const upgrading = version === 5 && versions.some(row => row.version === 4)
    if (upgrading) {
      for (const [table, fields] of Object.entries(v11Columns)) {
        const names = (await db.query(`PRAGMA table_info(${table})`)).map(row => row.name)
        if (![...metadata, ...fields].every(name => names.includes(name))) {
          throw new Error('โครงสร้างฐานข้อมูลเดิมไม่ครบ กรุณาเก็บข้อมูลเดิมไว้')
        }
      }
      await db.write(oldTables.map(t => statement(`CREATE TABLE IF NOT EXISTS recovery_v4_${t} AS SELECT * FROM ${t}`)))
    }
    const counts = upgrading ? [
      statement('CREATE TABLE migration_check (valid INTEGER NOT NULL CHECK(valid = 1))'),
      ...oldTables.map(t => statement(`INSERT INTO migration_check SELECT
        (SELECT COUNT(*) FROM ${t}) = (SELECT COUNT(*) FROM recovery_v4_${t})`)),
      statement('DROP TABLE migration_check'),
    ] : []
    await db.write([...changes.map((sql) => statement(sql)), ...counts, statement(
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

  setup(profile: Row, target: number, calories = CALORIE_DEFAULT, activityFactor = 1.2) {
    return this.enqueue(() => this.db.write([
      insert('profiles', entry(profile, 'profile'), 'update'),
      insert('app_settings', entry({ calories, target_weight: target, activity_factor: activityFactor }, 'settings'), 'update'),
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

  repeatMeal(log: Row, day: string, meal: string) {
    const values = Object.fromEntries(columns.food_logs.map((column) => [column, log[column]]))
    return this.saveMeal({ ...values, day, meal, photo: null })
  }

  favoriteFood(catalogId: string, favorite: boolean) {
    return this.enqueue(() => this.db.write(favorite
      ? [insert('user_food_favorites', entry({ catalog_id: catalogId }))]
      : [statement('DELETE FROM user_food_favorites WHERE catalog_id = ?', [catalogId])]))
  }

  remove(table: 'weight_logs' | 'waist_logs' | 'food_logs' | 'sleep_logs' | 'exercise_logs', id: string) {
    return this.enqueue(() => this.db.write([statement(`DELETE FROM ${table} WHERE id = ? AND source = 'manual'`, [id])]))
  }

  exercise(day: string, name: string, seconds: number, id = crypto.randomUUID() as string, note: string | null = null) {
    const points = activityXp(seconds)
    return this.enqueue(async (): Promise<ExerciseAward> => {
      const eventId = 'xp:exercise:' + id
      const now = new Date().toISOString()
      await this.db.write([
        insert('exercise_logs', entry({ day, name, seconds, note }, id)),
        ...(points ? [statement(`
          WITH budget AS (
            SELECT MAX(0, ? - COALESCE(SUM(points), 0)) AS remaining,
                   CASE WHEN COUNT(*) = 0 THEN ? ELSE 0 END AS first_bonus
            FROM xp_events WHERE day = ?
          ), award AS (
            SELECT MIN(first_bonus, remaining) AS bonus,
                   MIN(?, MAX(0, remaining - first_bonus)) AS activity FROM budget
          )
          INSERT INTO xp_events (id, source, source_id, created_at, updated_at, day, points, activity_points, bonus_points)
          SELECT ?, 'exercise', ?, ?, ?, ?, activity + bonus, activity, bonus FROM award
          WHERE changes() = 1
          ON CONFLICT DO NOTHING`,
        [DAILY_XP_LIMIT, FIRST_MISSION_BONUS, day, points, eventId, id, now, now, day])] : []),
      ])
      const [event] = await this.db.query('SELECT activity_points, bonus_points FROM xp_events WHERE id = ? AND day = ?', [eventId, day])
      return { activity: Number(event?.activity_points ?? 0), bonus: Number(event?.bonus_points ?? 0) }
    })
  }

  rest(day: string, value: boolean) {
    return this.enqueue(() => this.db.write(value
      ? [insert('rest_days', entry({ day }, 'rest:' + day))]
      : [statement('DELETE FROM rest_days WHERE day = ?', [day])]))
  }

  setStepGoal(day: string, target: number) {
    return this.enqueue(() => this.db.write([insert('step_goals', entry({ day, target }, 'goal:' + day), 'update')]))
  }

  steps(day: string, steps: number | null, source: 'manual' | 'health_connect') {
    const commands = steps === null
      ? [statement('DELETE FROM daily_activity WHERE day = ? AND source = ?', [day, source])]
      : [insert('daily_activity', entry({ day, steps }, `${source}:${day}`, source, day), 'update')]
    if (source === 'health_connect') commands.push(insert('sync_metadata', entry({
      status: steps === null ? 'empty' : 'data', last_sync: new Date().toISOString(),
    }, 'health_connect', source), 'update'))
    if (source === 'health_connect' && steps !== null) {
      const now = new Date().toISOString()
      for (const [milestone, points] of [['1000', 5], ['2000', 5], ['3000', 10], ['goal', 10]] as const) {
        const threshold = milestone === 'goal'
          ? 'COALESCE((SELECT target FROM step_goals WHERE day <= ? ORDER BY day DESC LIMIT 1), 3000)' : '?'
        const id = 'steps:' + day + ':' + milestone
        commands.push(statement(`INSERT INTO step_rewards
          (id,source,source_id,created_at,updated_at,day,milestone,points)
          SELECT ?, 'health_connect', ?, ?, ?, ?, ?, ? WHERE ? >= ${threshold} ON CONFLICT DO NOTHING`,
          [id, id, now, now, day, milestone, points, steps, milestone === 'goal' ? day : Number(milestone)]))
      }
    }
    return this.enqueue(() => this.db.write(commands))
  }

  async exportJson() {
    return JSON.stringify({ format: 'lazyfit-v1', schema: migrations.length, data: await this.snapshot() })
  }

  importJson(json: string) {
    return this.enqueue(async () => {
      if (json.length > 50_000_000) throw new Error('ไฟล์สำรองใหญ่เกิน 50 MB')
      let backup
      try { backup = JSON.parse(json) } catch { throw new Error('ไฟล์สำรองไม่ใช่ JSON ที่อ่านได้') }
      if (backup?.format !== 'lazyfit-v1' || !backup.data || !(backup.schema === undefined || (Number.isInteger(backup.schema) && backup.schema >= 3 && backup.schema <= migrations.length))) {
        throw new Error('รูปแบบไฟล์สำรองไม่ถูกต้อง')
      }
      const legacy = backup.schema === undefined
      const beforeV4 = (backup.schema ?? 1) < 4
      const commands: Statement[] = []
      for (const table of tables) {
        const rows = backup.data[table]
        if ((backup.schema ?? 1) < 5 && rows === undefined && (table === 'step_goals' || table === 'step_rewards')) continue
        if (beforeV4 && rows === undefined && table === 'rest_days') continue
        if (legacy && rows === undefined && (table === 'food_catalog' || table === 'user_food_favorites')) continue
        if (!Array.isArray(rows)) throw new Error('ไฟล์สำรองมีตารางไม่ครบ')
        for (const raw of rows) {
          if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('พบข้อมูลที่อ่านไม่ได้ในไฟล์สำรอง')
          const defaults: Row = {}
          if ((backup.schema ?? 1) < 7 && (table === 'weight_logs' || table === 'waist_logs')) Object.assign(defaults,{measured_at:null,note:null})
          if ((backup.schema ?? 1) < 6 && table === 'exercise_logs') defaults.note = null
          if (beforeV4 && table === 'xp_events') Object.assign(defaults, { activity_points: raw.points, bonus_points: 0 })
          if (beforeV4 && table === 'app_settings') defaults.activity_factor = null
          if (beforeV4 && table === 'food_logs') defaults.meal = null
          if (legacy && table === 'food_logs') Object.assign(defaults, { nutrition_method: null, ingredient_mix: null, catalog_id: null })
          const row = { ...defaults, ...raw }
          const names = [...metadata, ...columns[table]]
          if (!names.every((name) => Object.hasOwn(row, name)) ||
            !metadata.every((name) => typeof row[name] === 'string' && row[name].length > 0 && row[name].length <= 160) ||
            !columns[table].every((name) => validField(table, name, row[name]))) {
            throw new Error('พบข้อมูลที่อ่านไม่ได้ในไฟล์สำรอง')
          }
          commands.push(insert(table, row))
        }
      }
      if (commands.length) await this.db.write(commands)
    })
  }
}


