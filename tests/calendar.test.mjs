import test from 'node:test'
import assert from 'node:assert/strict'
import {weightAverage, recentMeasures} from '../src/measurements.ts'
import {dayKey} from '../src/domain.ts'
import {daySummary, mondayWeek, monthDays, streaks} from '../src/calendar.ts'

test('Demo: weight trend uses last measurement per observed day and skips missing days', ()=>{
  const rows = [{day:'2026-01-01',kg:65},{day:'2026-01-03',measured_at:'2026-01-03T08:00',kg:67},
    {day:'2026-01-03',measured_at:'2026-01-03T18:00',kg:66},{day:'2025-12-01',kg:63}]
  assert.equal(weightAverage(rows,'2026-01-07'),65.5)
  assert.equal(weightAverage(rows,'2026-01-09'),null)
  assert.equal(recentMeasures(rows,'2026-01-07',7).length,3)
})

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
