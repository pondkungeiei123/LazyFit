import type { Snapshot } from './repository.ts'
import type { Row } from './schema.ts'
import { foodTotals } from './foodCatalog.ts'
import { sortedMeasures } from './measurements.ts'
import { sleepNights } from './sleep.ts'

export type Reading = { day: string; value: number; note?: string }
export type SeriesKey = 'weight' | 'waist' | 'calories' | 'steps' | 'sleep' | 'exercise'

export function healthSeries(data: Snapshot, from: string, to: string): Record<SeriesKey, Reading[]> {
  const inRange = (day: string) => from <= day && day <= to
  function byDay(rows: Row[], summarize: (group: Row[]) => Omit<Reading,'day'> | null) {
    const groups = new Map<string, Row[]>()
    for (const row of rows) {
      const day = String(row.day)
      if (!inRange(day)) continue
      if (!groups.has(day)) groups.set(day, [])
      groups.get(day)!.push(row)
    }
    return [...groups.keys()].sort().flatMap(day => {
      const reading = summarize(groups.get(day)!)
      return reading ? [{ day, ...reading }] : []
    })
  }
  const exercise = byDay(data.exercise_logs, rows => ({value: rows.reduce((s,r)=>s+Number(r.seconds),0)/60}))
  const recorded = new Set(exercise.map(r=>r.day))
  for (const row of data.rest_days) {
    const day = String(row.day)
    if (inRange(day) && !recorded.has(day)) exercise.push({ day, value: 0, note:'วันพัก' })
  }
  return {
    weight: byDay(data.weight_logs, rows => ({value: Number(sortedMeasures(rows)[0].kg)})),
    waist: byDay(data.waist_logs, rows => ({value: Number(sortedMeasures(rows)[0].cm)})),
    calories: byDay(data.food_logs, rows => {
      const energy = foodTotals(rows,'kcal')
      return energy.known ? {value:energy.sum, note:energy.missing ? 'เฉพาะรายการที่ทราบ' : undefined} : null
    }),
    steps: byDay(data.daily_activity, rows => {
      const best = rows.find(r=>r.source==='health_connect') ?? rows[0]
      return {value:Number(best.steps),note:best.source==='health_connect'?'Health Connect':'กรอกเอง'}
    }),
    sleep: sleepNights(data.sleep_logs).filter(r=>inRange(r.day)).map(r=>({day:r.day,value:r.minutes/60})).reverse(),
    exercise: exercise.sort((a,b)=>a.day.localeCompare(b.day)),
  }
}

export function goalProgress(start: number, current: number, target: number) {
  if (start === target) return current === target ? 100 : 0
  return Math.max(0, Math.min(100, (current-start)/(target-start)*100))
}
