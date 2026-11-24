import type { Snapshot } from './repository.ts'

export function shiftDate(day: string, days: number) {
  const date = new Date(day + 'T12:00:00Z')
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

export function mondayWeek(day: string) {
  const offset = (new Date(day + 'T12:00:00Z').getUTCDay() + 6) % 7
  return Array.from({length: 7}, (_, i) => shiftDate(day, i - offset))
}

export function monthDays(month: string) {
  const start = month + '-01'
  const count = new Date(Date.UTC(Number(month.slice(0,4)), Number(month.slice(5)), 0)).getUTCDate()
  return Array.from({length: count}, (_, i) => shiftDate(start, i))
}

export function stepTarget(data: Snapshot, day: string) {
  const goal = data.step_goals.filter(row => String(row.day) <= day)
    .sort((a,b) => String(b.day).localeCompare(String(a.day)))[0]
  return Number(goal?.target ?? 3000)
}

export function daySummary(data: Snapshot, day: string) {
  const activities = data.exercise_logs.filter(r => r.day === day)
  const records = data.daily_activity.filter(r => r.day === day)
  const steps = records.find(r => r.source === 'health_connect') ?? records[0]
  const rewards = data.step_rewards.filter(r => r.day === day)
  const goal = stepTarget(data, day)
  const reached = rewards.some(r => r.milestone === 'goal') || (!!steps && Number(steps.steps) >= goal)
  const rest = data.rest_days.some(r => r.day === day)
  const events = [...data.xp_events.filter(r => r.day === day), ...rewards]
  return { activities, steps, goal, reached, rest, events,
    active: activities.length > 0 || reached,
    xp: events.reduce((sum,r) => sum + Number(r.points),0),
    seconds: activities.reduce((sum,r) => sum + Number(r.seconds),0) }
}

export function streaks(data: Snapshot, today: string) {
  const dates = new Set([...data.daily_activity,...data.step_rewards,...data.exercise_logs,...data.rest_days]
    .map(r => String(r.day)).filter(d => d <= today))
  let last = '', current = 0, longest = 0
  for (const date of [...dates].sort()) {
    if (last && shiftDate(last,1) !== date) current = 0
    const summary = daySummary(data,date)
    if (summary.active) current++
    else if (!summary.rest) current = 0
    longest = Math.max(longest,current)
    last = date
  }
  return {current: last >= shiftDate(today,-1) ? current : 0, longest}
}
