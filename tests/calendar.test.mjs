import test from 'node:test'
import assert from 'node:assert/strict'
import {dayKey} from '../src/domain.ts'
import {daySummary, mondayWeek, monthDays, streaks} from '../src/calendar.ts'

test('Bangkok midnight, leap month and Monday across year boundary', () => {
  assert.equal(dayKey(new Date('2025-12-31T17:00:00Z')),'2026-01-01')
  assert.equal(monthDays('2024-02').length,29)
  assert.equal(mondayWeek('2026-01-01')[0],'2025-12-29')
})
test('Demo: rest bridges active days, a missed day resets current and preserves longest', () => {
  const data = {exercise_logs:[{day:'2026-01-01',seconds:60}],step_rewards:[],xp_events:[],
    daily_activity:[{day:'2026-01-03',source:'manual',steps:4500},{day:'2026-01-03',source:'health_connect',steps:3200}],
    step_goals:[],rest_days:[{day:'2026-01-02'}]}
  assert.equal(daySummary(data,'2026-01-03').steps.steps,3200)
  assert.deepEqual(streaks(data,'2026-01-04'),{current:2,longest:2})
  assert.deepEqual(streaks(data,'2026-01-05'),{current:0,longest:2})
})
