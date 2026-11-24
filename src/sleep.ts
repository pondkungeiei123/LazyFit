import { dayKey } from './domain.ts'
import type {Row} from './schema.ts'

export type SleepRecord = {id:string; origin:string; start:string; end:string; stages: Record<string,number>}
export function sleepInterval(start:string, end:string) {
  const from = Date.parse(start), to = Date.parse(end)
  const duration = to-from
  if (!Number.isFinite(duration) || duration < 60000 || duration > 86400000 || to > Date.now()) throw new Error('ตรวจวันที่เข้านอนและตื่น ระยะเวลาต้องอยู่ระหว่าง 1 นาทีถึง 24 ชั่วโมง')
  // Group a night by the Bangkok date at the start of its noon-to-noon window.
  return {start_at:new Date(from).toISOString(),end_at:new Date(to).toISOString(),
    day:dayKey(new Date(from-12*3600000)),minutes:Math.round(duration/60000)}
}

// Union intervals globally before grouping. Records without times are shown in
// history, and only used as a daily estimate when no timed interval is available.
export function sleepNights(rows:Row[]) {
  const totals = new Map<string,number>()
  let covered = -Infinity
  for (const r of rows.filter(r=>r.start_at && r.end_at).sort((a,b)=>String(a.start_at).localeCompare(String(b.start_at)))) {
    const from=Date.parse(String(r.start_at)), to=Date.parse(String(r.end_at))
    const millis=Math.max(0,to-Math.max(from,covered))
    if (millis) totals.set(String(r.day),(totals.get(String(r.day))??0)+millis/60000)
    covered=Math.max(covered,to)
  }
  for (const r of rows) if (!r.start_at && !totals.has(String(r.day))) totals.set(String(r.day),Number(r.minutes))
  return [...totals].map(([day,minutes])=>({day,minutes:Math.round(minutes)})).sort((a,b)=>b.day.localeCompare(a.day))
}
