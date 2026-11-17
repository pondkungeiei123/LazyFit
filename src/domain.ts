export const CALORIE_DEFAULT = 2050
export const XP_PER_LEVEL = 100

export function healthMetrics(weight: number, height: number, age: number, sex: 'male' | 'female', factor = 1.2) {
  const bmr = 10 * weight + 6.25 * height - 5 * age + (sex === 'male' ? 5 : -161)
  return { bmi: weight / (height / 100) ** 2, bmr, tdee: bmr * factor }
}

export function progress(xp: number) {
  return { level: Math.floor(xp / XP_PER_LEVEL) + 1, remaining: xp % XP_PER_LEVEL }
}

export function activityXp(seconds: number) {
  return seconds >= 120 ? 10 : 0
}

export function dayKey(date = new Date()) {
  return [date.getFullYear(), date.getMonth() + 1, date.getDate()]
    .map((part) => String(part).padStart(2, '0')).join('-')
}

export function weekEnding(date = new Date()) {
  return Array.from({ length: 7 }, (_, index) => {
    const day = new Date(date)
    day.setDate(day.getDate() - 6 + index)
    return dayKey(day)
  })
}

export const weeklyPlan = [
  'เดินสบาย ๆ', 'ยืดไหล่และข้อเท้า', 'เดินสบาย ๆ',
  'พักหรือขยับเบา ๆ', 'เดินสบาย ๆ', 'ฝึกหมุนเชือกโดยไม่กระโดด', 'พักหรือเดินช้า ๆ',
]
