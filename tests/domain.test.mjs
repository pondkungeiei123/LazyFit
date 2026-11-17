import test from 'node:test'
import assert from 'node:assert/strict'
import { activityXp, dayKey, healthMetrics, progress, weekEnding } from '../src/domain.ts'

test('Demo: สูตร BMI, BMR และ TDEE', () => {
  const male = healthMetrics(72, 180, 30, 'male')
  assert.ok(Math.abs(male.bmi - 22.22222) < 0.00001)
  assert.equal(male.bmr, 1700)
  assert.equal(male.tdee, 2040)
  assert.equal(healthMetrics(72, 180, 30, 'female').bmr, 1534)
})

test('XP เริ่มที่เลเวล 1 และเพิ่มทุก 100 คะแนน', () => {
  assert.equal(activityXp(119), 0)
  assert.equal(activityXp(120), 10)
  assert.deepEqual(progress(0), { level: 1, remaining: 0 })
  assert.deepEqual(progress(99), { level: 1, remaining: 99 })
  assert.deepEqual(progress(100), { level: 2, remaining: 0 })
})

test('สัปดาห์ใช้วันท้องถิ่นและข้ามปีได้', () => {
  const day = new Date(2025, 0, 2, 0, 15)
  assert.equal(dayKey(day), '2025-01-02')
  assert.equal(weekEnding(day)[0], '2024-12-27')
  assert.equal(weekEnding(day).at(-1), '2025-01-02')
})

