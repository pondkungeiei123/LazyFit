import test from 'node:test'
import assert from 'node:assert/strict'
import { DatabaseSync } from 'node:sqlite'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { migrate, Repository } from '../src/repository.ts'
import { migrations } from '../src/schema.ts'
import { foodTotals, foodValue, mealNutrition } from '../src/foodCatalog.ts'
import { progress } from '../src/domain.ts'

function open(filename) {
  const sqlite = new DatabaseSync(filename)
  return {
    close: () => sqlite.close(),
    async query(sql, values = []) { return sqlite.prepare(sql).all(...values) },
    async write(commands) {
      sqlite.exec('BEGIN')
      try {
        for (const command of commands) sqlite.prepare(command.statement).run(...command.values)
        sqlite.exec('COMMIT')
      } catch (error) {
        sqlite.exec('ROLLBACK')
        throw error
      }
    },
  }
}

test('Demo: บันทึกลงไฟล์ SQLite จริง, migrations, reload, source dedup และ import rollback', async () => {
  const folder = mkdtempSync(join(tmpdir(), 'lazyfit-test-'))
  const filename = join(folder, 'test.sqlite')
  let db = open(filename)
  const day = '2025-01-02'
  try {
    await migrate(db)
    let repo = new Repository(db)
    await repo.setup({ age: 30, height: 180, sex: 'male', initial_weight: 72 }, 70, 2000)
    await repo.save('weight_logs', { day, kg: 72 })
    await repo.save('waist_logs', { day, cm: 80 })
    await repo.save('sleep_logs', { day, minutes: 400 })
    const meal = { day, name: 'Demo: ข้าว', grams: 150, base_grams: 100, kcal: 130, protein: 2.7, carbs: 28, fat: 0.3, photo: null }
    await repo.save('food_logs', meal, 'meal')
    await repo.save('food_logs', { ...meal, grams: 200 }, 'meal')
    await Promise.all([
      repo.exercise(day, 'Demo: เดิน', 120, 'retry-id'),
      repo.exercise(day, 'Demo: เดิน', 120, 'retry-id'),
      repo.exercise(day, 'Demo: ยืด', 300, 'another-activity'),
    ])
    await repo.steps(day, 1234, 'health_connect')
    await repo.steps(day, 1400, 'health_connect')
    await repo.steps(day, 2000, 'manual')
    db.close()

    db = open(filename)
    await migrate(db)
    repo = new Repository(db)
    let snapshot = await repo.snapshot()
    assert.equal(snapshot.weight_logs[0].kg, 72)
    assert.equal(snapshot.waist_logs[0].cm, 80)
    assert.equal(snapshot.sleep_logs[0].minutes, 400)
    assert.equal(snapshot.profiles[0].height, 180)
    assert.equal(snapshot.app_settings[0].calories, 2000)
    assert.equal(snapshot.food_logs.length, 1)
    assert.equal(snapshot.food_logs[0].grams, 200)
    assert.equal(snapshot.exercise_logs.length, 2)
    assert.equal(snapshot.xp_events.length, 2)
    assert.equal(snapshot.xp_events.find((row) => row.source_id === 'retry-id').points, 15)
    assert.equal(snapshot.xp_events.find((row) => row.source_id === 'another-activity').points, 20)
    assert.equal(snapshot.daily_activity.length, 2)
    assert.equal(snapshot.daily_activity.find((row) => row.source === 'health_connect').steps, 1400)
    assert.equal(snapshot.sync_metadata[0].status, 'data')
    assert.equal((await db.query('SELECT version FROM schema_migrations')).length, migrations.length)

    const json = await repo.exportJson()
    await repo.importJson(json)
    assert.deepEqual(await repo.snapshot(), snapshot)
    await repo.steps(day, null, 'health_connect')
    snapshot = await repo.snapshot()
    assert.equal(snapshot.daily_activity[0].steps, 2000)
    assert.equal(snapshot.daily_activity.length, 1)
    assert.equal(snapshot.sync_metadata[0].status, 'empty')

    const corrupt = JSON.parse(json)
    const weight = corrupt.data.weight_logs[0]
    corrupt.data.weight_logs.push({ ...weight, id: 'extra', source_id: 'extra' })
    const sleep = corrupt.data.sleep_logs[0]
    corrupt.data.sleep_logs.push({ ...sleep, id: 'bad', source_id: 'bad', minutes: -1 })
    await assert.rejects(repo.importJson(JSON.stringify(corrupt)))
    assert.deepEqual(await repo.snapshot(), snapshot)
  } finally {
    db.close()
    rmSync(folder, { recursive: true, force: true })
  }
})

test('Demo: migrate legacy database and backup, keep unknown nutrients, favorites and personal meals across reopen', async () => {
  const folder = mkdtempSync(join(tmpdir(), 'lazyfit-food-'))
  const filename = join(folder, 'food.sqlite')
  let db = open(filename)
  const day = '2025-05-01'
  const timestamp = day + 'T12:00:00.000Z'
  const legacyValues = ['old-meal', 'manual', 'old-meal', timestamp, timestamp, day,
    'Demo: ข้าวเดิม', 150, 100, 130, 2.7, 28, 0.3, 'data:image/jpeg;base64,AA==']
  try {
    await db.write([
      { statement: 'CREATE TABLE schema_migrations (version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL)', values: [] },
      ...migrations.slice(0, 2).flatMap((changes, index) => [
        ...changes.map((statement) => ({ statement, values: [] })),
        { statement: 'INSERT INTO schema_migrations VALUES (?, ?)', values: [index + 1, timestamp] },
      ]),
      { statement: 'INSERT INTO food_logs VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', values: legacyValues },
      { statement: 'INSERT INTO xp_events VALUES (?, ?, ?, ?, ?, ?, ?)', values: ['old-xp', 'activity', day, timestamp, timestamp, day, 10] },
    ])
    const original = (await db.query('SELECT * FROM food_logs'))[0]
    await migrate(db)
    let repo = new Repository(db)
    const migrated = (await repo.snapshot()).food_logs[0]
    for (const key of Object.keys(original)) assert.equal(migrated[key], original[key])
    assert.equal(migrated.nutrition_method, null)
    assert.deepEqual((await repo.snapshot()).xp_events.map(({activity_points, bonus_points}) => [activity_points, bonus_points]), [[10, 0]])
    await repo.saveMeal({
      day, name: 'Demo: เมนูใหม่', grams: null, base_grams: 100,
      kcal: null, protein: null, carbs: null, fat: null,
      photo: null, nutrition_method: 'unknown', catalog_id: 'personal:demo',
    }, undefined, { id: 'personal:demo', name: 'Demo: เมนูใหม่' })
    await Promise.all([repo.favoriteFood('basil-chicken', true), repo.favoriteFood('basil-chicken', true)])
    db.close()

    db = open(filename)
    await migrate(db)
    repo = new Repository(db)
    const saved = await repo.snapshot()
    assert.deepEqual(foodTotals(saved.food_logs, 'kcal'), { sum: 195, known: 1, missing: 1 })
    assert.equal(saved.food_catalog[0].name, 'Demo: เมนูใหม่')
    assert.equal(saved.user_food_favorites.length, 1)
    assert.equal(saved.user_food_favorites[0].catalog_id, 'basil-chicken')
    const fresh = open(':memory:')
    try {
      await migrate(fresh)
      const restored = new Repository(fresh)
      const backup = JSON.parse(await repo.exportJson())
      delete backup.schema
      delete backup.data.food_catalog
      delete backup.data.user_food_favorites
      backup.data.food_logs = [original]
      await restored.importJson(JSON.stringify(backup))
      assert.equal((await restored.snapshot()).food_logs[0].photo, original.photo)
      const exported = await repo.exportJson()
      await restored.importJson(exported)
      await restored.importJson(exported)
      assert.deepEqual(await restored.snapshot(), saved)
    } finally { fresh.close() }
  } finally {
    db.close()
    rmSync(folder, { recursive: true, force: true })
  }
})


test('Demo: step rewards are immutable per Bangkok day and independent of mission XP', async () => {
  const db = open(':memory:')
  try {
    await migrate(db)
    const repo = new Repository(db)
    const day = '2026-01-01'
    await repo.steps(day, 8000, 'manual')
    await repo.steps(day, null, 'health_connect')
    assert.equal((await repo.snapshot()).step_rewards.length, 0)
    await repo.setStepGoal(day, 5000)
    await repo.steps(day, 3000, 'health_connect')
    assert.equal((await repo.snapshot()).step_rewards.length, 3)
    await repo.steps(day, 5000, 'health_connect')
    await repo.setStepGoal(day, 1000)
    await repo.steps(day, 1800, 'health_connect')
    await repo.exercise(day, 'Demo', 120, 'mission')
    await repo.steps('2026-01-02', 1000, 'health_connect')
    const data = await repo.snapshot()
    assert.deepEqual(data.step_rewards.filter(r => r.day === day).map(r => r.points).sort((a,b)=>a-b), [5,5,10,10])
    assert.equal(data.step_rewards.filter(r => r.day !== day).length, 2)
    assert.equal(data.xp_events[0].points, 15)
  } finally { db.close() }
})

test('Demo: overnight sleep, overlapping sources, repeated import and empty read', async () => {
  const {sleepNights}=await import('../src/sleep.ts')
  const db=open(':memory:')
  try {
    await migrate(db)
    const repo=new Repository(db), start='2026-01-01T23:00:00+07:00',end='2026-01-02T06:00:00+07:00'
    await repo.saveSleep(start,end,'Demo','manual-sleep')
    const record={id:'sleep',origin:'demo.test',start,end,stages:{}}
    await repo.importSleep([record]);await repo.importSleep([record]);await repo.importSleep([])
    let data=await repo.snapshot()
    assert.equal(data.sleep_logs.length,2)
    assert.deepEqual(sleepNights(data.sleep_logs),[{day:'2026-01-01',minutes:420}])
    assert.equal(data.sync_metadata[0].status,'empty')
    assert.equal(data.xp_events.length,0)
    assert.throws(()=>repo.saveSleep(end,start,'Demo'))
    await repo.remove('sleep_logs','manual-sleep')
    data=await repo.snapshot();assert.equal(data.sleep_logs.length,1)
  } finally {db.close()}
})

test('XP cap, daily bonus, duplicate IDs, rest days and level up', async () => {
  const db = open(':memory:')
  try {
    await migrate(db)
    const repo = new Repository(db)
    const day = '2025-06-01'
    assert.deepEqual(await repo.exercise(day, 'Demo: ขยับ', 60, 'one'), { activity: 3, bonus: 5 })
    assert.deepEqual(await repo.exercise(day, 'Demo: ขยับ', 60, 'one'), { activity: 3, bonus: 5 })
    assert.deepEqual(await repo.exercise(day, 'Demo: เดิน', 900, 'two'), { activity: 40, bonus: 0 })
    assert.deepEqual(await repo.exercise(day, 'Demo: เดิน', 900, 'three'), { activity: 40, bonus: 0 })
    assert.deepEqual(await repo.exercise(day, 'Demo: เดิน', 300, 'four'), { activity: 12, bonus: 0 })
    assert.deepEqual(await repo.exercise(day, 'Demo: ยืด', 600, 'five'), { activity: 0, bonus: 0 })
    await repo.rest('2025-06-02', true)
    const snapshot = await repo.snapshot()
    assert.equal(snapshot.exercise_logs.length, 5)
    assert.equal(snapshot.xp_events.length, 5)
    assert.equal(snapshot.rest_days.length, 1)
    assert.deepEqual(progress(snapshot.xp_events.reduce((sum, row) => sum + row.points, 0)), { level: 2, remaining: 0 })
    const collision = JSON.parse(await repo.exportJson())
    const first = collision.data.xp_events.find((row) => row.bonus_points)
    collision.data.xp_events.push({ ...first, id: 'collision', source_id: 'collision' })
    await assert.rejects(repo.importJson(JSON.stringify(collision)), /XP/)
    assert.deepEqual(await repo.snapshot(), snapshot)
    assert.deepEqual(await repo.exercise('2025-06-03', 'Demo: เดิน', 120, 'next'), { activity: 10, bonus: 5 })
  } finally { db.close() }
})

test('repeat and edit a meal preserve consumed totals and legacy basis, reject malformed restore', async () => {
  const db = open(':memory:')
  try {
    await migrate(db)
    const repo = new Repository(db)
    const day = '2025-06-01'
    await repo.saveMeal({ day, name: 'Demo: ข้าว', grams: 150, base_grams: 100, kcal: 130, meal: 'breakfast' }, 'original')
    let [row] = (await repo.snapshot()).food_logs
    assert.equal(foodValue(row, 'kcal'), 195)
    await repo.repeatMeal(row, day, 'lunch')
    const [copy] = (await repo.snapshot()).food_logs.filter((item) => item.meal === 'lunch')
    assert.equal(foodValue(copy, 'kcal'), 195)
    await repo.saveMeal({ ...row, ...mealNutrition([], 75, row), grams: 75, base_grams: 75 }, 'original')
    row = (await repo.snapshot()).food_logs.find((item) => item.id === 'original')
    assert.equal(foodValue(row, 'kcal'), 97.5)
    assert.equal(foodTotals((await repo.snapshot()).food_logs, 'kcal').sum, 292.5)
    const broken = JSON.parse(await repo.exportJson())
    broken.data.food_logs[0].day = '2025-02-30'
    await assert.rejects(repo.importJson(JSON.stringify(broken)))
    broken.data.food_logs[0].day = day
    broken.data.food_logs[0].kcal = '200'
    await assert.rejects(repo.importJson(JSON.stringify(broken)))
    await assert.rejects(repo.importJson('{'))
    assert.equal((await repo.snapshot()).food_logs.length, 2)
  } finally { db.close() }
})

