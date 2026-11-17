export const CALORIE_DEFAULT = 2050
export const XP_PER_LEVEL = 100
export const DAILY_XP_LIMIT = 100
export const FIRST_MISSION_BONUS = 5
export const activityLevels = [
  [1.2, 'เคลื่อนไหวน้อย'], [1.375, 'กิจกรรมเบา'], [1.55, 'กิจกรรมปานกลาง'],
  [1.725, 'กิจกรรมมาก'], [1.9, 'กิจกรรมมากเป็นพิเศษ'],
] as const
export const missions = [
  { minutes: 1, xp: 3, name: 'ลุกเดินหรือขยับตัว' },
  { minutes: 2, xp: 10, name: 'เดินเบา ๆ' },
  { minutes: 5, xp: 20, name: 'เดินหรือยืดเหยียด' },
  { minutes: 10, xp: 30, name: 'เดินต่อเนื่อง' },
  { minutes: 15, xp: 40, name: 'เดินเร็วตามที่สบาย' },
]

export function healthMetrics(weight: number, height: number, age: number, sex: 'male' | 'female', factor = 1.2) {
  const bmr = 10 * weight + 6.25 * height - 5 * age + (sex === 'male' ? 5 : -161)
  return { bmi: weight / (height / 100) ** 2, bmr, tdee: bmr * factor }
}

export function progress(xp: number) {
  return { level: Math.floor(xp / XP_PER_LEVEL) + 1, remaining: xp % XP_PER_LEVEL }
}

export function activityXp(seconds: number) {
  return missions.reduce((xp, mission) => seconds >= mission.minutes * 60 ? mission.xp : xp, 0)
}

export function dayKey(date = new Date()) {
  return [date.getFullYear(), date.getMonth() + 1, date.getDate()]
    .map((part) => String(part).padStart(2, '0')).join('-')
}

export function weekEnding(date = new Date(), count = 7) {
  return Array.from({ length: count }, (_, index) => {
    const day = new Date(date)
    day.setDate(day.getDate() - count + 1 + index)
    return dayKey(day)
  })
}

export function activityStreak(days: Set<string>, today: string) {
  const date = new Date(today + 'T12:00:00')
  if (!days.has(today)) date.setDate(date.getDate() - 1)
  let count = 0
  while (days.has(dayKey(date))) {
    count++
    date.setDate(date.getDate() - 1)
  }
  return count
}

export const weeklyPlan = [
  'เดินสบาย ๆ', 'ยืดไหล่และข้อเท้า', 'เดินสบาย ๆ',
  'พักหรือขยับเบา ๆ', 'เดินสบาย ๆ', 'ฝึกหมุนเชือกโดยไม่กระโดด', 'พักหรือเดินช้า ๆ',
]
