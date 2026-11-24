import type { Row } from './schema.ts'
import {shiftDate} from './calendar.ts'

// The entered wall time is always Bangkok time, including on a PC in another zone.
export function bangkokInput(date = new Date()) {
  return new Date(date.getTime()+7*3600000).toISOString().slice(0,16)
}
export function sortedMeasures(rows: Row[]) {
  const stamp = (r: Row) => String(r.measured_at ?? r.day)
  return [...rows].sort((a,b) => stamp(b).localeCompare(stamp(a)) || String(b.created_at).localeCompare(String(a.created_at)))
}
export function recentMeasures(rows: Row[], today: string, days: number) {
  return sortedMeasures(rows.filter(r => String(r.day) <= today && (!days || String(r.day) >= shiftDate(today,1-days))))
}
export function weightAverage(rows: Row[], day: string) {
  const daily = new Map<string,number>()
  for (const r of recentMeasures(rows,day,7)) if (!daily.has(String(r.day))) daily.set(String(r.day),Number(r.kg))
  return daily.size < 2 ? null : [...daily.values()].reduce((a,b)=>a+b,0)/daily.size
}
