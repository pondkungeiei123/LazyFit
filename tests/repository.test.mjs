import test from 'node:test'
import assert from 'node:assert/strict'
import { DatabaseSync } from 'node:sqlite'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { migrate, Repository } from '../src/repository.ts'
import { migrations } from '../src/schema.ts'
import { foodTotals } from '../src/foodCatalog.ts'

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
    assert.equal(snapshot.xp_events.length, 1)
    assert.equal(snapshot.xp_events[0].points, 10)
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
    ])
    const original = (await db.query('SELECT * FROM food_logs'))[0]
    await migrate(db)
    let repo = new Repository(db)
    const migrated = (await repo.snapshot()).food_logs[0]
    for (const key of Object.keys(original)) assert.equal(migrated[key], original[key])
    assert.equal(migrated.nutrition_method, null)
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

