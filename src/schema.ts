const legacyColumns = {
  profiles: ['age', 'height', 'sex', 'initial_weight'],
  weight_logs: ['day', 'kg'],
  waist_logs: ['day', 'cm'],
  food_logs: ['day', 'name', 'grams', 'base_grams', 'kcal', 'protein', 'carbs', 'fat', 'photo'],
  exercise_logs: ['day', 'name', 'seconds'],
  sleep_logs: ['day', 'minutes'],
  daily_activity: ['day', 'steps'],
  xp_events: ['day', 'points'],
  app_settings: ['calories', 'target_weight'],
  sync_metadata: ['status', 'last_sync'],
} as const

export const columns = {
  ...legacyColumns,
  food_logs: [...legacyColumns.food_logs, 'nutrition_method', 'ingredient_mix', 'catalog_id'],
  food_catalog: ['name'],
  user_food_favorites: ['catalog_id'],
} as const

export type Table = keyof typeof columns
export type Value = string | number | null
export type Row = Record<string, Value>
export type Statement = { statement: string; values: Value[] }

const base = `id TEXT PRIMARY KEY NOT NULL, source TEXT NOT NULL,
  source_id TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
`
const day = `day TEXT NOT NULL CHECK (length(day) = 10 AND date(day) IS NOT NULL AND date(day) = day)`
const positive = (name: string, max: number) => `${name} REAL NOT NULL CHECK (${name} > 0 AND ${name} <= ${max})`
const integer = (name: string, min: number, max: number) =>
  `${name} INTEGER NOT NULL CHECK (typeof(${name}) = 'integer' AND ${name} BETWEEN ${min} AND ${max})`
const macro = (name: string) => `${name} REAL NOT NULL CHECK (${name} BETWEEN 0 AND 12000)`
const label = `name TEXT NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 120)`

const definitions: Record<keyof typeof legacyColumns, string> = {
  profiles: `${integer('age', 18, 120)}, ${positive('height', 300)}, sex TEXT NOT NULL CHECK (sex IN ('male','female')), ${positive('initial_weight', 700)}, CHECK (id = 'profile')`,
  weight_logs: `${day}, ${positive('kg', 700)}`,
  waist_logs: `${day}, ${positive('cm', 500)}`,
  food_logs: `${day}, ${label}, ${positive('grams', 10000)}, ${positive('base_grams', 10000)},
    ${macro('kcal')}, ${macro('protein')}, ${macro('carbs')}, ${macro('fat')},
    photo TEXT CHECK (photo IS NULL OR (length(photo) <= 700000 AND photo GLOB 'data:image/jpeg;base64,*'))`,
  exercise_logs: `${day}, ${label}, ${integer('seconds', 1, 86400)}`,
  sleep_logs: `${day}, ${integer('minutes', 1, 1440)}`,
  daily_activity: `${day}, ${integer('steps', 0, 1000000)}, UNIQUE(day, source)`,
  xp_events: `${day}, ${integer('points', 1, 100)}, UNIQUE(day, source)`,
  app_settings: `${integer('calories', 500, 12000)}, ${positive('target_weight', 700)}, CHECK (id = 'settings')`,
  sync_metadata: `status TEXT NOT NULL CHECK (status IN ('data','empty')), last_sync TEXT NOT NULL`,
}

export const tables = Object.keys(columns) as Table[]
const legacyTables = Object.keys(legacyColumns) as (keyof typeof legacyColumns)[]
const create = (table: string, fields: string) =>
  `CREATE TABLE IF NOT EXISTS ${table} (${base}, ${fields}, UNIQUE(source, source_id))`
export const metadata = ['id', 'source', 'source_id', 'created_at', 'updated_at']
const oldMealFields = [...metadata, ...legacyColumns.food_logs].join(', ')
const nullableFood = definitions.food_logs.replace(/REAL NOT NULL/g, 'REAL')

export const migrations = [
  legacyTables.map((table) => create(table, definitions[table])),
  legacyTables.filter((table) => (legacyColumns[table] as readonly string[]).includes('day'))
    .map((table) => `CREATE INDEX IF NOT EXISTS ${table}_day_idx ON ${table}(day, created_at)`),
  [
    create('food_logs_v3', `${nullableFood},
      nutrition_method TEXT CHECK (nutrition_method IN ('recipe', 'ingredient', 'unknown')),
      ingredient_mix TEXT CHECK (length(ingredient_mix) <= 4000),
      catalog_id TEXT CHECK (length(catalog_id) <= 160),
      CHECK (base_grams IS NOT NULL)`),
    `INSERT INTO food_logs_v3 (${oldMealFields}) SELECT ${oldMealFields} FROM food_logs`,
    'DROP TABLE food_logs',
    'ALTER TABLE food_logs_v3 RENAME TO food_logs',
    'CREATE INDEX food_logs_day_idx ON food_logs(day, created_at)',
    create('food_catalog', label),
    create('user_food_favorites', 'catalog_id TEXT NOT NULL UNIQUE CHECK (length(catalog_id) BETWEEN 1 AND 160)'),
  ],
]


