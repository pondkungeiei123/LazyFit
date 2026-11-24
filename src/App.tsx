import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { activityLevels, CALORIE_DEFAULT, dayKey, healthMetrics, missions, progress, weeklyPlan, weekEnding } from './domain'
import { connection, exportBackup, healthSteps } from './device'
import type { Connection } from './device'
import type { ExerciseAward, Repository, Snapshot } from './repository'
import type { Row } from './schema'
import { Calendar, WeekSummary } from './ActivityCalendar'
import { stepTarget } from './calendar'
import { Food } from './Food'
import { foodTotals } from './foodCatalog'

const tabs = ['วันนี้', 'อาหาร', 'ออกกำลัง', 'สุขภาพ'] as const
const icons = [
  'M3 10l9-7 9 7v10H3z M9 20v-6h6v6',
  'M4 3v6a3 3 0 0 0 6 0V3M7 3v18M18 3c-3 3-3 6-3 9h5M20 3v18',
  'M2 12h20M5 8v8M8 5v14M16 5v14M19 8v8',
  'M20.8 5.6a5.5 5.5 0 0 0-7.8 0l-1 1-1-1a5.5 5.5 0 1 0-7.8 7.8l8.8 8.5 8.8-8.5a5.5 5.5 0 0 0 0-7.8z',
]
const statuses: Record<Connection, string> = {
  web: 'กรอกก้าวเองได้บนเว็บ',
  unavailable: 'อุปกรณ์นี้ใช้ Health Connect ไม่ได้',
  update_required: 'ติดตั้งหรืออัปเดต Health Connect จาก Play Store',
  permission_required: 'ยังไม่ได้ให้สิทธิ์อ่านก้าว',
  granted: 'อนุญาตให้อ่านก้าวแล้ว',
}
const n = (value: number, digits = 0) => new Intl.NumberFormat('th-TH', { maximumFractionDigits: digits }).format(value)
const dateLabel = (day: string) => new Date(day + 'T12:00:00').toLocaleDateString('th-TH', { weekday: 'short', day: 'numeric', month: 'short' })
const val = (data: FormData, key: string) => Number(data.get(key))
const str = (data: FormData, key: string) => String(data.get(key) ?? '').trim()
const total = (rows: Row[], key: string) => rows.reduce((sum, row) => sum + Number(row[key]), 0)
type Action = (work: () => Promise<void | string>, message?: string) => Promise<boolean>
const awardMessage = ({ activity, bonus }: ExerciseAward) =>
  `บันทึกกิจกรรมแล้ว · +${activity + bonus} XP (กิจกรรม ${activity} · โบนัส ${bonus})`

const exerciseSafety = 'หากเจ็บหน้าอก หน้ามืด หายใจลำบากผิดปกติ หรือปวดรุนแรง ให้หยุดกิจกรรมและขอความช่วยเหลือทางการแพทย์ หากอาการรุนแรงหรือไม่ทุเลา ให้ติดต่อบริการฉุกเฉิน'

function Card({ title, children, className = '' }: { title: string; children: ReactNode; className?: string }) {
  return <section className={'card ' + className}><h2>{title}</h2>{children}</section>
}

function NumberField({ name, label, value, min = 0, max, step = '1' }: {
  name: string; label: string; value?: number; min?: number; max: number; step?: string
}) {
  return <label>{label}<input name={name} type="number" inputMode={step === '1' ? 'numeric' : 'decimal'}
    min={min} max={max} step={step} defaultValue={value} required /></label>
}

function Profile({ data, repo, run }: { data: Snapshot; repo: Repository; run: Action }) {
  const profile = data.profiles[0]
  const goal = data.app_settings[0]
  const input = useRef<HTMLInputElement>(null)
  function save(form: FormData) {
    return repo.setup({
      age: val(form, 'age'), height: val(form, 'height'), sex: str(form, 'sex'),
      initial_weight: val(form, 'initial_weight'),
    }, val(form, 'target'), val(form, 'calories'), val(form, 'activity_factor'))
  }
  return <Card title={profile ? 'โปรไฟล์และเป้าหมาย' : 'เริ่มตั้งค่าโปรไฟล์'}>
    <form onSubmit={(event) => {
      event.preventDefault()
      const form = new FormData(event.currentTarget)
      void run(() => save(form), 'บันทึกโปรไฟล์แล้ว')
    }}>
      <div className="fields">
        <label>เพศสำหรับสูตร BMR<select name="sex" defaultValue={String(profile?.sex ?? 'male')}><option value="male">ชาย</option><option value="female">หญิง</option></select></label>
        <NumberField name="age" label="อายุ (ปี)" value={profile ? Number(profile.age) : undefined} min={18} max={120} />
        <NumberField name="height" label="ส่วนสูง (ซม.)" value={profile ? Number(profile.height) : undefined} min={1} max={300} step="0.1" />
        <NumberField name="initial_weight" label="น้ำหนักตั้งต้น (กก.)" value={profile ? Number(profile.initial_weight) : undefined} min={1} max={700} step="0.1" />
        <NumberField name="target" label="เป้าหมายน้ำหนัก (กก.)" value={goal ? Number(goal.target_weight) : undefined} min={1} max={700} step="0.1" />
        <NumberField name="calories" label="เป้าพลังงาน (kcal/วัน)" value={Number(goal?.calories ?? CALORIE_DEFAULT)} min={500} max={12000} />
        <label>ระดับกิจกรรมสำหรับ TDEE<select name="activity_factor" defaultValue={Number(goal?.activity_factor ?? 1.2)}>
          {activityLevels.map(([factor, label]) => <option value={factor} key={factor}>{label}</option>)}
        </select></label>
      </div>
      <p className="muted">ตั้งเป้าน้ำหนักแบบค่อยเป็นค่อยไป และเลือกเป้าพลังงานที่ทำได้ต่อเนื่อง</p>
      <button>บันทึกโปรไฟล์</button>
    </form>
    {!profile && <>
      <button className="secondary" onClick={() => input.current?.click()}>เลือกไฟล์โปรไฟล์เริ่มต้น</button>
      <input ref={input} type="file" accept=".json,application/json" hidden onChange={(event) => {
        const file = event.currentTarget.files?.[0]
        event.currentTarget.value = ''
        if (!file) return
        void run(async () => {
          if (file.size > 10000) throw new Error('ไฟล์โปรไฟล์ใหญ่เกินกำหนด')
          const preset = JSON.parse(await file.text())
          if (preset.format !== 'lazyfit-profile-v1') throw new Error('รูปแบบไฟล์โปรไฟล์ไม่ถูกต้อง')
          await repo.setup({ age: preset.age, height: preset.height, sex: preset.sex, initial_weight: preset.initial_weight }, preset.target_weight, preset.calories)
        }, 'นำเข้าโปรไฟล์แล้ว')
      }} />
    </>}
  </Card>
}

type Timer = { name: string; day: string; seconds: number; end: number; id: string }
const timerKey = 'lazyfit-active-timer'
function readTimer(): Timer | null {
  try {
    const data = JSON.parse(localStorage.getItem(timerKey) ?? 'null')
    return data && typeof data.end === 'number' && typeof data.id === 'string' ? data : null
  } catch { return null }
}

function TimerCard({ timer, now, cancel, finish }: {
  timer: Timer; now: number; cancel: () => void; finish: () => void
}) {
  const remaining = Math.max(0, Math.ceil((timer.end - now) / 1000))
  const display = [Math.floor(remaining / 60), remaining % 60].map((x) => String(x).padStart(2, '0')).join(':')
  return <Card title={timer.name} className="mission">
    <div className="timer">{display}</div>
    <p className="muted">{exerciseSafety}</p>
    <div className="actions">
      {remaining === 0 && <button onClick={finish}>บันทึกกิจกรรมที่ทำครบ</button>}
      <button className="secondary" onClick={cancel}>ยกเลิกตัวจับเวลา</button>
    </div>
  </Card>
}

function TrendBars({ series, unit }: { series: { date: string; value: number | null; note?: string }[]; unit: string }) {
  const values = series.flatMap(({ value }) => value === null ? [] : [value])
  if (!values.length) return <p className="muted">ยังไม่มีข้อมูลที่แสดงได้ในช่วงนี้</p>
  const max = Math.max(1, ...values)
  return <div className="trend-scroll">
    <div className={'chart trend-chart' + (series.length > 7 ? ' trend-long' : '')}
      style={{ gridTemplateColumns: `repeat(${series.length}, minmax(0, 1fr))` }}>
      {series.map(({ date, value, note }) => <div key={date}
        aria-label={`${dateLabel(date)} · ${value === null ? 'ไม่มีข้อมูล' : n(value, 1) + ' ' + unit}${note ? ' · ' + note : ''}`}>
        <span>{value === null ? '—' : n(value, 1)}{note && value !== null && '*'}</span>
        <div className="bar-space">{value !== null && <i aria-hidden="true" style={{ height: Math.max(3, value / max * 100) + '%' }} />}</div>
        <small>{date.slice(-2)}</small>
      </div>)}
    </div>
  </div>
}

function DashboardTrends({ data, day }: { data: Snapshot; day: string }) {
  const [range, setRange] = useState(7)
  const today = new Date(day + 'T12:00:00')
  const dates = weekEnding(today)
  const weight = weekEnding(today, range).map((date) => {
    const row = data.weight_logs.find((item) => item.day === date)
    return { date, value: row ? Number(row.kg) : null }
  })
  const calories = dates.map((date) => {
    const total = foodTotals(data.food_logs.filter((item) => item.day === date), 'kcal')
    return { date, value: total.known ? total.sum : null, note: total.missing ? 'มีรายการไม่ทราบพลังงาน' : undefined }
  })
  const activity = dates.map((date) => {
    const rows = data.exercise_logs.filter((item) => item.day === date)
    const rest = data.rest_days.some((item) => item.day === date)
    return { date, value: rows.length ? total(rows, 'seconds') / 60 : rest ? 0 : null, note: rest ? 'วันพัก' : undefined }
  })
  return <>
    <Card title={`น้ำหนักย้อนหลัง ${range} วัน (กก.)`}>
      <div className="modes">{[7, 30].map((value) => <button type="button" className="secondary" key={value}
        aria-pressed={range === value} onClick={() => setRange(value)}>{value} วัน</button>)}</div>
      <TrendBars series={weight} unit="กก." />
    </Card>
    <Card title="พลังงานจากอาหาร 7 วัน (kcal)">
      <TrendBars series={calories} unit="kcal" />
      {calories.some(({ note }) => note) && <p className="muted">วันที่มีรายการไม่ทราบ แสดงเฉพาะยอดที่ทราบ</p>}
    </Card>
    <Card title="ออกกำลังกาย 7 วัน (นาที)">
      <TrendBars series={activity} unit="นาที" />
      <p>{activity.filter(({ value }) => value !== null && value > 0).length} วันที่มีกิจกรรม</p>
    </Card>
  </>
}

const measurements = [
  { table: 'weight_logs', key: 'kg', label: 'น้ำหนัก (กก.)', max: 700, step: '0.1' },
  { table: 'waist_logs', key: 'cm', label: 'รอบเอว (ซม.)', max: 500, step: '0.1' },
  { table: 'sleep_logs', key: 'minutes', label: 'เวลานอน (นาที)', max: 1440, step: '1' },
] as const

function WeeklyChart({ data, track, day }: { data: Snapshot; track: typeof measurements[number]; day: string }) {
  const days = weekEnding(new Date(day + 'T12:00:00'))
  const points = days.map((date) => data[track.table].find((row) => row.day === date))
  const values = points.flatMap((point) => point ? [Number(point[track.key])] : [])
  if (!values.length) return <p className="muted">ยังไม่มีบันทึกใน 7 วันที่ผ่านมา</p>
  const max = Math.max(...values)
  return <div className="chart" aria-label={track.label}>
    {days.map((date, index) => {
      const value = points[index]?.[track.key]
      return <div key={date}><span>{value === undefined ? '—' : n(Number(value), 1)}</span>
        <div className="bar-space">{value !== undefined && <i style={{ height: (Number(value) / max) * 100 + '%' }} />}</div>
        <small>{date.slice(-2)}</small></div>
    })}
  </div>
}

function Health({ data, day, repo, run, weight }: { data: Snapshot; day: string; repo: Repository; run: Action; weight?: number }) {
  const [index, setIndex] = useState(0)
  const upload = useRef<HTMLInputElement>(null)
  const profile = data.profiles[0]
  const track = measurements[index]
  const factor = Number(data.app_settings[0]?.activity_factor ?? 1.2)
  const stats = profile && weight ? healthMetrics(weight, Number(profile.height), Number(profile.age), profile.sex as 'male' | 'female', factor) : null
  const weights = weekEnding(new Date(day + 'T12:00:00')).flatMap((date) => {
    const row = data.weight_logs.find((item) => item.day === date)
    return row ? [Number(row.kg)] : []
  })
  const average = weights.reduce((sum, value) => sum + value, 0) / weights.length
  return <>
    <Card title="ตัวชี้วัดสุขภาพ">
      {stats ? <>
        <div className="metric-grid">
          <div><small>BMI</small><strong>{n(stats.bmi, 1)}</strong></div>
          <div><small>BMR (kcal)</small><strong>{n(stats.bmr)}</strong></div>
          <div><small>TDEE (kcal)</small><strong>{n(stats.tdee)}</strong></div>
        </div>
        <p className="muted">ประมาณการจาก Mifflin–St Jeor และตัวคูณกิจกรรม {factor}</p>
        <p>น้ำหนัก {n(weight!, 1)} กก. · เป้าหมาย {data.app_settings[0] ? n(Number(data.app_settings[0].target_weight), 1) + ' กก.' : 'ยังไม่ได้ตั้ง'}</p>
      </> : <p className="muted">ตั้งค่าโปรไฟล์เพื่อคำนวณ BMI, BMR และ TDEE</p>}
    </Card>
    <Card title="แนวโน้ม 7 วัน">
      {index === 0 && <p className="muted">{weights.length > 1
        ? `น้ำหนักเฉลี่ย ${n(average, 1)} กก. จาก ${weights.length} วันที่บันทึก`
        : 'บันทึกน้ำหนักอย่างน้อยสองวันเพื่อดูค่าเฉลี่ย'}</p>}
      <label>ตัวชี้วัด<select value={index} onChange={(event) => setIndex(Number(event.target.value))}>
        {measurements.map((item, i) => <option key={item.key} value={i}>{item.label}</option>)}
      </select></label>
      <WeeklyChart data={data} track={track} day={day} />
      <form key={track.key} onSubmit={(event) => {
        event.preventDefault()
        const form = event.currentTarget
        const fields = new FormData(form)
        void run(() => repo.save(track.table, { day: str(fields, 'day'), [track.key]: val(fields, track.key) }), 'บันทึกสุขภาพแล้ว')
          .then((ok) => { if (ok) form.reset() })
      }}>
        <div className="fields">
          <label>วันที่<input name="day" type="date" defaultValue={day} max={day} required /></label>
          <NumberField name={track.key} label={track.label} min={track.step === '1' ? 1 : 0.1} max={track.max} step={track.step} />
        </div>
        <button>บันทึกค่า</button>
      </form>
      {data[track.table].slice(0, 7).map((row) => <article key={String(row.id)} className="list-row">
        <div className="grow">{dateLabel(String(row.day))} · <b>{n(Number(row[track.key]), 1)}</b></div>
        <button className="secondary" onClick={() => {
          if (confirm('ลบบันทึกนี้?')) void run(() => repo.remove(track.table, String(row.id)), 'ลบบันทึกแล้ว')
        }}>ลบ</button>
      </article>)}
    </Card>
    <Profile key={profile ? String(profile.updated_at) : 'setup'} {...{ data, repo, run }} />
    <Card title="สำรองข้อมูล">
      <p className="muted">ไฟล์ JSON มีข้อมูลสุขภาพและรูปอาหาร เก็บไว้ในที่ส่วนตัว การนำเข้าจะรวมรายการใหม่และเก็บรายการที่มีอยู่แล้ว</p>
      <div className="actions">
        <button className="secondary" onClick={() => void run(async () => exportBackup(await repo.exportJson(), day))}>ส่งออก JSON</button>
        <button className="secondary" onClick={() => upload.current?.click()}>นำเข้า JSON</button>
      </div>
      <input ref={upload} hidden type="file" accept=".json,application/json" onChange={(event) => {
        const file = event.currentTarget.files?.[0]
        event.currentTarget.value = ''
        if (file) void run(async () => {
          if (file.size > 50_000_000) throw new Error('ไฟล์สำรองใหญ่เกิน 50 MB')
          await repo.importJson(await file.text())
        }, 'นำเข้าข้อมูลแล้ว')
      }} />
    </Card>
  </>
}

function Exercise({ data, day, repo, run, start, active }: {
  data: Snapshot; day: string; repo: Repository; run: Action; start: (name: string, minutes: number) => void; active: boolean
}) {
  const [timedActivity, setTimedActivity] = useState(weeklyPlan[0])
  const [timedMinutes, setTimedMinutes] = useState(2)
  const tracked = new Set(data.exercise_logs.map((row) => String(row.day)))
  const rested = data.rest_days.some((row) => row.day === day)
  const activeDays = weekEnding(new Date(day + 'T12:00:00')).filter((date) => tracked.has(date)).length
  const xpToday = total(data.xp_events.filter((row) => row.day === day), 'points')
  const scheduleEnd = new Date(day + 'T12:00:00')
  scheduleEnd.setDate(scheduleEnd.getDate() + (7 - scheduleEnd.getDay()) % 7)
  return <>
    <Card title="ภารกิจวันนี้" className="mission">
      <p>วันนี้ {xpToday} / 100 XP · 7 วันที่ผ่านมา ขยับ {activeDays} วัน</p>
      <div className="mission-options">{missions.map((mission) => <button className="secondary" key={mission.minutes}
        disabled={active} onClick={() => start(mission.name, mission.minutes)}>
        <b>{mission.minutes} นาที · {mission.name}</b><small>{mission.xp} XP</small>
      </button>)}</div>
      <p className="muted">ภารกิจแรกเพิ่ม 5 XP คะแนนใช้สำหรับเลเวลในแอป</p>
      <p className="muted">{exerciseSafety}</p>
    </Card>
    <Card title="วันพัก">
      <p>{rested ? 'บันทึกวันนี้เป็นวันพักแล้ว' : 'พักได้ตามที่ต้องการ XP ที่สะสมไว้ยังอยู่'}</p>
      <div className="actions">
        <button className="secondary" onClick={() => void run(() => repo.rest(day, !rested), rested ? 'ยกเลิกวันพักแล้ว' : 'บันทึกวันพักแล้ว')}>
          {rested ? 'ยกเลิกวันพัก' : 'บันทึกวันพัก'}</button>
        <button className="secondary" disabled={active} onClick={() => start('เดินช้า ๆ', 2)}>เริ่มเดินช้า 2 นาที</button>
      </div>
    </Card>
    <Calendar {...{data, day}} /><WeekSummary {...{data, day}} />
    <Card title="แผนขยับ 7 วัน">
      <ol className="plan">{weekEnding(scheduleEnd).map((date, i) => <li key={date}
        aria-current={day === date ? 'date' : undefined}><span>{dateLabel(date)}</span>{weeklyPlan[i]}</li>)}</ol>
      <details className="food-details">
        <summary>จับเวลาตามกิจกรรมในแผน</summary>
        <div className="fields">
          <label>กิจกรรม<select value={timedActivity} onChange={(event) => setTimedActivity(event.target.value)}>
            {[...new Set(weeklyPlan)].map((name) => <option key={name}>{name}</option>)}
          </select></label>
          <label>เวลา<select value={timedMinutes} onChange={(event) => setTimedMinutes(Number(event.target.value))}>
            {missions.map(({ minutes }) => <option value={minutes} key={minutes}>{minutes} นาที</option>)}
          </select></label>
        </div>
        <button disabled={active} onClick={() => start(timedActivity, timedMinutes)}>เริ่มจับเวลา</button>
      </details>
    </Card>
    <Card title="บันทึกกิจกรรมที่ทำแล้ว">
      <form onSubmit={(event) => {
        event.preventDefault()
        const form = event.currentTarget
        const fields = new FormData(form)
        void run(async () => awardMessage(await repo.exercise(day, str(fields, 'name'), val(fields, 'minutes') * 60, undefined, str(fields,'note') || null)))
          .then((ok) => { if (ok) form.reset() })
      }}>
        <div className="fields">
          <label>หมายเหตุ<input name="note" maxLength={500} /></label>
          <label>กิจกรรม<input name="name" maxLength={120} required /></label>
          <NumberField name="minutes" label="ระยะเวลา (นาที)" min={1} max={1440} />
        </div><button>บันทึกกิจกรรม</button>
      </form>
      <h3>ประวัติกิจกรรม</h3>
      {data.exercise_logs.length === 0 && <p className="muted">ยังไม่มีบันทึกกิจกรรม</p>}
      {data.exercise_logs.slice(0, 12).map((row) => <article className="list-row" key={String(row.id)}>
        <div className="grow"><b>{row.name}</b><p>{dateLabel(String(row.day))} · {n(Number(row.seconds) / 60, 1)} นาที</p></div>
        <button className="secondary" onClick={() => {
          if (confirm('ลบกิจกรรมนี้? XP ที่ได้รับจะยังอยู่')) void run(() => repo.remove('exercise_logs', String(row.id)), 'ลบกิจกรรมแล้ว')
        }}>ลบ</button>
      </article>)}
    </Card>
  </>
}

export function App({ repo }: { repo: Repository }) {
  const [tab, setTab] = useState(0)
  const [data, setData] = useState<Snapshot>()
  const [notice, setNotice] = useState('')
  const [failure, setFailure] = useState('')
  const [busy, setBusy] = useState(false)
  const inFlight = useRef(false)
  const [now, setNow] = useState(Date.now)
  const [timer, setTimer] = useState(readTimer)
  const [status, setStatus] = useState<Connection>()
  const day = dayKey(new Date(now))

  useEffect(() => {
    void repo.snapshot().then(setData, () => setFailure('อ่านข้อมูลไม่สำเร็จ'))
    function refresh() {
      setNow(Date.now())
      void connection().then(setStatus, () => setStatus(undefined))
    }
    refresh()
    window.addEventListener('focus', refresh)
    document.addEventListener('visibilitychange', refresh)
    const interval = window.setInterval(() => setNow(Date.now()), 1000)
    return () => {
      window.clearInterval(interval)
      window.removeEventListener('focus', refresh)
      document.removeEventListener('visibilitychange', refresh)
    }
  }, [repo])

  const run: Action = async (work, message) => {
    if (inFlight.current) return false
    inFlight.current = true
    setBusy(true); setNotice(''); setFailure('')
    try {
      const result = await work()
      setData(await repo.snapshot())
      if (message || result) setNotice(message ?? result ?? '')
      return true
    } catch (error) {
      setFailure(error instanceof Error && /[\u0e00-\u0e7f]/.test(error.message)
        ? error.message : 'ทำรายการไม่สำเร็จ ตรวจข้อมูลแล้วลองอีกครั้ง')
      return false
    } finally {
      inFlight.current = false
      setBusy(false)
    }
  }

  function updateTimer(next: Timer | null) {
    if (next) localStorage.setItem(timerKey, JSON.stringify(next))
    else localStorage.removeItem(timerKey)
    setTimer(next)
  }
  function start(name: string, minutes: number) {
    try {
      const startTime = Date.now()
      setNow(startTime)
      updateTimer({ name, day: dayKey(new Date(startTime)), seconds: minutes * 60, end: startTime + minutes * 60000, id: crypto.randomUUID() })
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch { setFailure('เริ่มตัวจับเวลาไม่สำเร็จ') }
  }

  const latest = data?.weight_logs.filter((row) => String(row.day) <= day)
    .sort((left, right) => String(right.day).localeCompare(String(left.day)))[0]
  const weight = latest ? Number(latest.kg) : data?.profiles[0] ? Number(data.profiles[0].initial_weight) : undefined
  const { sum: calories, known, missing } = foodTotals(data?.food_logs.filter((row) => row.day === day) ?? [], 'kcal')
  const goal = Number(data?.app_settings[0]?.calories ?? CALORIE_DEFAULT)
  const xp = total(data?.xp_events ?? [], 'points') + total(data?.step_rewards ?? [], 'points')
  const level = progress(xp)
  const steps = data?.daily_activity.find((row) => row.day === day && row.source === 'health_connect')
    ?? data?.daily_activity.find((row) => row.day === day && row.source === 'manual')
  const stepGoal = data ? stepTarget(data,day) : 3000
  const fraction = Number(steps?.steps ?? 0) / stepGoal
  const sync = data?.sync_metadata.find((row) => row.id === 'health_connect')

  return <div className="shell">
    <header><div className="brand"><span className="mark" aria-hidden="true">✦</span> LazyFit</div><span className="offline">ออฟไลน์ได้</span></header>
    <main>
      <div className="heading"><p>{dateLabel(day)}</p><h1>{tabs[tab]}</h1></div>
      <div className="feedback" aria-live="polite">{busy ? 'กำลังทำรายการ…' : notice}</div>
      {failure && <p className="error" role="alert">{failure}</p>}
      {timer && <TimerCard {...{ timer, now }} cancel={() => updateTimer(null)} finish={() => {
        void run(async () => {
          const award = await repo.exercise(timer.day, timer.name, timer.seconds, timer.id)
          updateTimer(null)
          return awardMessage(award)
        })
      }} />}
      {data && tab === 0 && <>
        <Card title={missing ? "พลังงานวันนี้จากรายการที่ทราบ" : "พลังงานวันนี้"} className="energy">
          <strong className="big">{known ? <>{n(calories)} <small>kcal</small></> : missing ? 'ไม่ทราบ' : 'ยังไม่มีบันทึก'}</strong>
          {known > 0 && <progress value={Math.min(calories, goal)} max={goal} aria-label="พลังงานที่ทราบเทียบเป้าหมาย" />}{missing > 0 && <p>{missing} รายการยังไม่ทราบพลังงาน</p>}
          <div className="split"><span>เป้าหมาย {n(goal)} kcal</span><button className="text-button" onClick={() => setTab(1)}>บันทึกอาหาร →</button></div>
        </Card>
        <div className="summary">
          <Card title={latest ? 'น้ำหนักล่าสุด' : 'น้ำหนักตั้งต้น'}><strong>{weight ? n(weight, 1) + ' กก.' : 'ยังไม่มีข้อมูล'}</strong>
            <p className="muted">{data.app_settings[0] ? `เป้าหมาย ${n(Number(data.app_settings[0].target_weight), 1)} กก.` : 'ยังไม่ได้ตั้งเป้า'}</p></Card>
          <Card title={'เลเวล ' + level.level}><strong>{n(xp)} XP</strong><progress value={level.remaining} max={100} aria-label="ความคืบหน้าไปยังเลเวลถัดไป" />
            <small>อีก {100 - level.remaining} XP ถึงเลเวลถัดไป</small></Card>
        </div>
        {!timer && <Card title="ภารกิจวันนี้" className="mission">
          <div className="actions">
            <button onClick={() => start(missions[0].name, 1)}>เริ่มขยับ 1 นาที</button>
            <button className="secondary" onClick={() => start(missions[1].name, 2)}>เริ่มเดิน 2 นาที</button>
          </div>
        </Card>}
        <Card title="ก้าววันนี้">
          <div className="split"><strong className="big">{steps ? n(Number(steps.steps)) : '—'}</strong>
            <span>{steps?.source === 'manual' ? 'กรอกเอง' : steps ? 'Health Connect · ค่าที่บันทึกไว้' : 'ยังไม่มีข้อมูลก้าว'}</span></div>
          <div className="actions"><span className="step-ring" style={{ background: `conic-gradient(#207953 ${Math.min(1,fraction)*360}deg, #e1ebe3 0deg)` }} aria-hidden="true"><i>ก้าว</i></span>
            <div>เป้าหมาย {n(stepGoal)} ก้าว{steps && <p>{n(fraction * 100, 1)}% · เหลือ {n(Math.max(0,stepGoal - Number(steps.steps)))} ก้าว</p>}</div></div>
          <details><summary>แก้ไขเป้าหมายก้าว</summary><form key={stepGoal} onSubmit={e => {
            e.preventDefault()
            const target = Number(new FormData(e.currentTarget).get('target'))
            void run(() => repo.setStepGoal(day,target),'บันทึกเป้าหมายแล้ว')
          }}><label>เป้าหมายต่อวัน<input type="number" name="target" list="targets" defaultValue={stepGoal} required min="1" max="1000000" /></label>
            <datalist id="targets">{[3000,5000,7000].map(v => <option key={v} value={v}/>)}</datalist><button>บันทึกเป้าหมาย</button></form></details>
          <p className="muted">ก้าวจาก Health Connect รับได้สูงสุด 30 XP/วัน · ก้าวที่กรอกเองใช้ติดตามเท่านั้น</p>
          <p className="muted">{status ? statuses[status] : 'ยังตรวจสอบสถานะ Health Connect ไม่ได้'}</p>
          {sync && <p className="muted">{sync.status === 'empty' ? 'รอบล่าสุดไม่พบข้อมูล' : 'อ่านข้อมูลครั้งล่าสุด'} · {new Date(String(sync.last_sync)).toLocaleString('th-TH')}</p>}
          <div className="actions">
            {status === 'permission_required' && <button className="secondary" onClick={() => void run(async () => {
              setStatus(await connection(true))
            })}>อนุญาตให้อ่านก้าว</button>}
            {status && status !== 'web' && <button className="secondary" onClick={() => void run(async () => {
              const state = await connection()
              setStatus(state)
              if (state !== 'granted') return
              let result
              try { result = await healthSteps(day) } catch (error) {
                if ((error as { code?: string })?.code !== 'PERMISSION_REQUIRED') throw error
                setStatus('permission_required')
                setNotice('สิทธิ์อ่านก้าวเปลี่ยนแล้ว ใช้ช่องกรอกเองหรืออนุญาตอีกครั้งได้')
                return
              }
              await repo.steps(day, result.steps, 'health_connect')
              setNotice(result.steps === null ? 'Health Connect ยังไม่มีข้อมูลก้าววันนี้' : 'อ่านข้อมูลก้าวแล้ว')
            })}>ตรวจและอ่านก้าว</button>}
          </div>
          <form key={day} onSubmit={(event) => {
            event.preventDefault()
            const value = val(new FormData(event.currentTarget), 'steps')
            void run(() => repo.steps(day, value, 'manual'), 'บันทึกก้าวแล้ว')
          }}>
            <NumberField name="steps" label="กรอกก้าวเอง" max={1_000_000} />
            <div className="actions"><button>บันทึกก้าว</button>
              {data.daily_activity.some(row => row.day === day && row.source === 'manual') && <button className="secondary" type="button" onClick={() => void run(() => repo.steps(day, null, 'manual'), 'ลบก้าวที่กรอกเองแล้ว')}>ลบค่าที่กรอกเอง</button>}
            </div>
          </form>
        </Card>
        {!data.profiles[0] && <Profile {...{ data, repo, run }} />}
        <WeekSummary {...{data,day}} />
        <DashboardTrends data={data} day={day} />
      </>}
      {data && tab === 1 && <Food key={day} {...{ data, day, repo, run }} />}
      {data && tab === 2 && <Exercise {...{ data, day, repo, run, start }} active={!!timer} />}
      {data && tab === 3 && <Health {...{ data, day, repo, run, weight }} />}
    </main>
    <nav aria-label="เมนูหลัก">{tabs.map((title, index) => <button key={title} aria-current={tab === index ? 'page' : undefined}
      onClick={() => { setTab(index); setNotice(''); setFailure(''); window.scrollTo(0, 0) }}>
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d={icons[index]} /></svg>{title}
    </button>)}</nav>
  </div>
}



