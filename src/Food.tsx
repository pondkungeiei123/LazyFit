import { useEffect, useRef, useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import { compressPhoto } from './device'
import { catalog, fdcDatasetUrl, foodTotals, foodValue, ingredientById, mealNutrition, nutrientKeys, portion, searchFood } from './foodCatalog'
import type { Menu, Nutrient, Part } from './foodCatalog'
import { foodRecognition } from './foodRecognition'
import type { Repository, Snapshot } from './repository'
import type { Row } from './schema'

type Action = (work: () => Promise<void>, message?: string) => Promise<boolean>
const labels = { kcal: 'พลังงาน', protein: 'โปรตีน', carbs: 'คาร์โบไฮเดรต', fat: 'ไขมัน' }
const groups = ['ทั้งหมด', 'จานเดียว', 'ตามสั่ง', 'เครื่องดื่ม', 'ของหวาน', 'ส่วนประกอบ', 'เมนูส่วนตัว']
const sizes = ['เล็ก', 'ปกติ', 'ใหญ่']
const meals = [['breakfast', 'มื้อเช้า'], ['lunch', 'มื้อกลางวัน'], ['dinner', 'มื้อเย็น'], ['snack', 'ของว่าง']] as const
const servings = [[0.5, 'ครึ่งจาน'], [1, 'หนึ่งจาน'], [1.5, 'หนึ่งจานครึ่ง']] as const
const format = (value: number, digits = 0) => value.toLocaleString('th-TH', { maximumFractionDigits: digits })
const show = (value: number | null, key: Nutrient) => value === null
  ? 'ไม่ทราบ' : format(value, key === 'kcal' ? 0 : 1) + (key === 'kcal' ? ' kcal' : ' ก.')

type Draft = {
  menu?: Menu
  log?: Row
  name: string
  grams: string
  size: number | null
  parts: Part[]
  remember: boolean
  meal: string
}

function readParts(raw: Row[string] | undefined): Part[] {
  if (typeof raw !== 'string') return []
  try {
    const values: unknown = JSON.parse(raw)
    if (Array.isArray(values) && values.every((part) => part && typeof part.id === 'string'
      && typeof part.grams === 'number' && Number.isFinite(part.grams) && part.grams >= 0 && part.grams <= 10000)) return values
  } catch { return [] }
  return []
}

function methodLabel(method: Row[string] | undefined) {
  if (method === 'recipe') return 'ความไม่แน่นอนสูง · สูตรประมาณ ปริมาณน้ำมัน ซอส และเนื้อสัตว์แต่ละร้านต่างกัน'
  if (method === 'ingredient') return 'ความไม่แน่นอนปานกลาง · วัตถุดิบอ้างอิง USDA ปริมาณและการปรุงจริงอาจต่างกัน'
  if (method === 'unknown') return 'ไม่ทราบโภชนาการ · ข้อมูลส่วนผสมยังไม่พอ'
  return 'ค่าจากบันทึกเดิม · ไม่มีแหล่งอ้างอิงที่ระบุไว้'
}

export function Food({ data, day, repo, run }: { data: Snapshot; day: string; repo: Repository; run: Action }) {
  const [query, setQuery] = useState('')
  const [group, setGroup] = useState('ทั้งหมด')
  const [onlyFavorites, setOnlyFavorites] = useState(false)
  const [meal, setMeal] = useState(() => {
    const hour = new Date().getHours()
    return hour < 11 ? 'breakfast' : hour < 16 ? 'lunch' : 'dinner'
  })
  const [draft, setDraft] = useState<Draft>()
  const [photo, setPhoto] = useState<string | null>(null)
  const [photoBusy, setPhotoBusy] = useState(false)
  const [photoError, setPhotoError] = useState('')
  const revision = useRef(0)
  const review = useRef<HTMLElement>(null)
  const editing = !!draft
  useEffect(() => { if (editing) review.current?.focus() }, [editing])

  const today = data.food_logs.filter((row) => row.day === day)
  const recent = [...new Map(data.food_logs
    .slice().reverse().map((row) => [String(row.catalog_id ?? row.name), row])).values()]
    .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at))).slice(0, 5)
  const energy = foodTotals(today, 'kcal')
  const favorites = new Set(data.user_food_favorites.map((row) => String(row.catalog_id)))
  const personal: Menu[] = data.food_catalog.map((row) => ({
    id: String(row.id), name: String(row.name), group: 'เมนูส่วนตัว', aliases: [],
  }))
  const menus = [...personal, ...catalog]
  const results = searchFood(menus.filter((menu) =>
    (group === 'ทั้งหมด' || menu.group === group) && (!onlyFavorites || favorites.has(menu.id))), query)

  function start(menu?: Menu, log?: Row) {
    revision.current += 1
    if (log) setPhoto(typeof log.photo === 'string' ? log.photo : null)
    setPhotoBusy(false); setPhotoError('')
    setDraft({
      menu, log, name: String(log?.name ?? menu?.name ?? query.trim()), remember: false,
      grams: log?.grams != null ? String(log.grams) : '',
      parts: log ? readParts(log.ingredient_mix) : menu ? portion(menu, 1) : [],
      size: menu && !log ? 1 : null,
      meal: log ? String(log.meal ?? '') : meal,
    })
  }

  function change(values: Partial<Draft>) {
    setDraft((old) => old ? { ...old, ...values } : old)
  }

  async function attach(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0]
    event.currentTarget.value = ''
    if (!file) return
    const request = ++revision.current
    setPhotoBusy(true); setPhotoError('')
    try {
      const image = await compressPhoto(file)
      if (revision.current === request) setPhoto(image)
    } catch {
      if (revision.current === request) setPhotoError('เปิดหรือบีบอัดรูปไม่สำเร็จ ลองเลือกภาพอื่น')
    } finally {
      if (revision.current === request) setPhotoBusy(false)
    }
  }

  const recipeGrams = draft?.parts.reduce((sum, part) => sum + part.grams, 0) ?? 0
  const parsedGrams = draft?.grams ? Number(draft.grams) : recipeGrams || null
  const grams = parsedGrams !== null && Number.isFinite(parsedGrams) && parsedGrams > 0 && parsedGrams <= 10000 ? parsedGrams : null
  const log = draft?.log
  const method = log ? log.nutrition_method : draft?.menu?.fdc ? 'ingredient' : draft?.menu?.parts ? 'recipe' : 'unknown'
  const nutrition = mealNutrition(draft?.parts ?? [], grams, log)
  const references = [...new Set(draft?.parts.filter((part) => part.grams > 0).map((part) => part.id) ?? [])]
    .flatMap((id) => ingredientById.get(id) ?? [])

  async function save(event: FormEvent) {
    event.preventDefault()
    if (!draft || photoBusy || !draft.name.trim()) return
    const name = draft.name.trim()
    const existing = draft.remember ? personal.find((item) => item.name === name) : undefined
    const newPersonal = draft.remember && !existing ? { id: 'personal:' + crypto.randomUUID(), name } : undefined
    const ok = await run(async () => {
      if (draft.parts.length && grams === null && recipeGrams > 0) throw new Error('น้ำหนักที่กินได้สูงสุด 10,000 กรัม')
      if (nutrientKeys.some((key) => (nutrition[key] ?? 0) > 12000)) throw new Error('ลดปริมาณอาหารต่อรายการก่อนบันทึก')
      await repo.saveMeal({
        day: String(draft.log?.day ?? day), name, meal: draft.meal || null, grams, base_grams: grams ?? 100,
        kcal: nutrition.kcal, protein: nutrition.protein, carbs: nutrition.carbs, fat: nutrition.fat, photo,
        nutrition_method: method ?? null,
        ingredient_mix: draft.parts.length ? JSON.stringify(draft.parts) : null,
        catalog_id: newPersonal?.id ?? existing?.id ?? draft.menu?.id ?? log?.catalog_id ?? null,
      }, log ? String(log.id) : undefined, newPersonal)
    }, 'บันทึกอาหารแล้ว')
    if (ok) { revision.current += 1; setDraft(undefined); setPhoto(null) }
  }

  return <>
    <section className="card energy">
      <h2>{energy.missing ? 'ยอดวันนี้จากรายการที่ทราบ' : 'รวมวันนี้'}</h2>
      <strong className="big">{today.length ? show(energy.known ? energy.sum : null, 'kcal') : 'ยังไม่มีบันทึก'}</strong>
      {today.length > 0 && <div className="macros">{nutrientKeys.slice(1).map((key) => {
        const result = foodTotals(today, key)
        return <span key={key}>{labels[key]} <b>{show(result.missing && !result.known ? null : result.sum, key)}</b></span>
      })}</div>}
      {energy.missing > 0 && <p>{energy.missing} รายการยังไม่ทราบพลังงาน</p>}
    </section>
    {draft ? <section className="card" ref={review} tabIndex={-1}>
      <div className="split">
        <h2>ตรวจปริมาณก่อนบันทึก</h2>
        <button className="secondary" type="button" onClick={() => {
          revision.current += 1; setDraft(undefined); setPhoto(null)
        }}>กลับไปค้นหา</button>
      </div>
      <form onSubmit={(event) => void save(event)}>
        <label>ชื่ออาหาร<input value={draft.name} maxLength={120} required onChange={(event) => change({ name: event.target.value })} /></label>
        <label>มื้ออาหาร<select value={draft.meal} onChange={(event) => change({ meal: event.target.value })}>
          {!draft.meal && <option value="">ไม่ระบุ</option>}
          {meals.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
        </select></label>
        {draft.menu && (draft.menu.parts || draft.menu.portions) && <div className="modes" aria-label="ขนาดเสิร์ฟ">
          {sizes.map((size, i) => <button type="button" key={size} className="secondary" aria-pressed={draft.size === i}
            onClick={() => change({ size: i, parts: portion(draft.menu!, i), grams: '' })}>{size}</button>)}
        </div>}
        {draft.parts.length > 0 && <details className="food-details">
          <summary>ส่วนผสมต่อเสิร์ฟ ({format(recipeGrams, 1)} ก.)</summary>
          <div className="fields">{draft.parts.map((part, index) => <label key={part.id}>
            {ingredientById.get(part.id)?.name ?? 'ส่วนผสมจากบันทึกเดิม'} (ก.)
            <input type="number" min="0" max="10000" step="any" inputMode="decimal" required value={part.grams}
              onChange={(event) => {
                const grams = Number(event.target.value)
                change({ size: null, parts: draft.parts.map((old, i) => i === index ? { ...old, grams } : old) })
              }} />
          </label>)}</div>
        </details>}
        {(recipeGrams > 0 || log?.grams != null) && <div className="modes" aria-label="สัดส่วนที่กิน">
          {servings.map(([factor, label]) => <button type="button" className="secondary" key={factor}
            onClick={() => change({ grams: String(Math.round((recipeGrams || Number(log?.grams)) * factor * 100) / 100) })}>{label}</button>)}
        </div>}
        <label>น้ำหนักที่กินจริง (กรัม)
          <input type="number" min="0.1" max="10000" step="any" inputMode="decimal" value={draft.grams}
            placeholder={recipeGrams ? format(recipeGrams, 1) : 'เว้นว่างได้'} onChange={(event) => change({ grams: event.target.value })} />
        </label>
        {draft.parts.length > 0 && <p className="muted">เว้นว่างเพื่อใช้ทั้งเสิร์ฟ หากกินบางส่วน ใส่น้ำหนักที่กินจริง ระบบจะลดทุกส่วนผสมตามสัดส่วน</p>}
        <div className="nutrition-review" aria-live="polite">{nutrientKeys.map((key) =>
          <div key={key}><small>{labels[key]}</small><strong>{show(nutrition[key], key)}</strong></div>)}</div>
        <p className="muted">{methodLabel(method)}</p>
        {method === 'recipe' && <p className="muted">กรัมต่อเสิร์ฟเป็นสมมติฐานของ LazyFit รวมเฉพาะส่วนผสมด้านบน ไข่ใช้ค่าไข่ต้มเป็นตัวแทนและแยกน้ำมันต่างหาก</p>}
        {references.length > 0 && <details className="food-details">
          <summary>แหล่งข้อมูล USDA FoodData Central · SR Legacy</summary>
          <ul>{references.map((item) => <li key={item.id}>{item.name} · FDC {item.fdc}</li>)}</ul>
          <a href={fdcDatasetUrl} target="_blank" rel="noreferrer">ชุดข้อมูล USDA SR Legacy</a>
        </details>}
        {photo && <div className="photo-preview"><img src={photo} alt="รูปอาหารที่แนบ" />
          <button type="button" className="secondary" onClick={() => { revision.current += 1; setPhoto(null); setPhotoBusy(false) }}>เอารูปออก</button></div>}
        <div className="actions">
          <label className="file-button">ถ่ายภาพ<input type="file" accept="image/*" capture="environment" onChange={(event) => void attach(event)} /></label>
          <label className="file-button">เลือกรูป<input type="file" accept="image/*" onChange={(event) => void attach(event)} /></label>
        </div>
        {!foodRecognition.available && <p className="muted">แนบรูปประกอบได้ ระบบวิเคราะห์ภาพยังไม่พร้อมใช้งาน</p>}
        {photoBusy && <p role="status">กำลังบีบอัดรูป…</p>}
        {photoError && <p className="error" role="alert">{photoError}</p>}
        {!draft.menu && !draft.log && <label className="food-checkbox">
          <input type="checkbox" checked={draft.remember} onChange={(event) => change({ remember: event.target.checked })} />เก็บเป็นเมนูส่วนตัว
        </label>}
        <button disabled={photoBusy || !draft.name.trim()}>บันทึกอาหาร</button>
      </form>
    </section> : <section className="card">
      <h2>ค้นหาอาหาร</h2>
      <div className="actions">
        <label className="file-button">ถ่ายรูปอาหาร<input type="file" accept="image/*" capture="environment" onChange={(event) => void attach(event)} /></label>
        <label className="file-button">เลือกรูป<input type="file" accept="image/*" onChange={(event) => void attach(event)} /></label>
      </div>
      {photoBusy && <p role="status">กำลังบีบอัดรูป…</p>}
      {photoError && <p className="error" role="alert">{photoError}</p>}
      {photo && <div className="photo-preview"><img src={photo} alt="รูปอาหารที่แนบ" />
        <p>แนบรูปแล้ว เลือกจากเมนูแนะนำด้านล่างหรือค้นหาชื่ออาหาร</p>
        <button type="button" className="secondary" onClick={() => setPhoto(null)}>เอารูปออก</button></div>}
      <label>ชื่ออาหาร<input type="search" placeholder="เช่น กะเพราไก่ ชาไทย ไข่ต้ม" value={query} maxLength={120}
        onChange={(event) => setQuery(event.target.value)} /></label>
      <div className="food-filter">
        <label>หมวดอาหาร<select value={group} onChange={(event) => setGroup(event.target.value)}>
          {groups.map((value) => <option key={value}>{value}</option>)}
        </select></label>
        <button className="secondary" type="button" aria-pressed={onlyFavorites} onClick={() => setOnlyFavorites(!onlyFavorites)}>★ เมนูโปรด</button>
      </div>
      {results.length === 0 && <p className="muted">ไม่พบเมนูที่ตรงกับการค้นหา</p>}
      <ul className="food-results">{results.map((menu) => <li className="list-row" key={menu.id}>
        <button type="button" className="food-select" disabled={photoBusy} onClick={() => start(menu)}>
          <b>{menu.name}</b><small>{menu.group}{menu.group === 'เมนูส่วนตัว' ? ' · ไม่ทราบโภชนาการ' : ''}</small>
        </button>
        <button type="button" className="secondary favorite-button" aria-label={'เมนูโปรด ' + menu.name}
          aria-pressed={favorites.has(menu.id)} onClick={() => void run(() => repo.favoriteFood(menu.id, !favorites.has(menu.id)))}>
          <span aria-hidden="true">{favorites.has(menu.id) ? '★' : '☆'}</span>
        </button>
      </li>)}</ul>
      <button type="button" className="secondary" disabled={photoBusy} onClick={() => start()}>+ เพิ่มอาหารเอง</button>
    </section>}
    {!draft && recent.length > 0 && <section className="card">
      <h2>กินล่าสุด</h2>
      <label>บันทึกซ้ำในมื้อ<select value={meal} onChange={(event) => setMeal(event.target.value)}>
        {meals.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
      </select></label>
      {recent.map((row) => <article className="list-row" key={String(row.id)}>
        <div className="grow"><b>{row.name}</b><p>{show(foodValue(row, 'kcal'), 'kcal')}</p></div>
        <button className="secondary" disabled={!!photo || photoBusy}
          onClick={() => void run(() => repo.repeatMeal(row, day, meal), 'บันทึกอาหารซ้ำแล้ว')}>บันทึกซ้ำ</button>
      </article>)}
    </section>}
    <section className="card">
      <h2>รายการที่บันทึกวันนี้</h2>
      {today.length === 0 && <p className="muted">ยังไม่มีรายการอาหาร</p>}
      {[...meals, ['', 'ไม่ระบุมื้อ']].map(([id, label]) => {
        const rows = today.filter((row) => (row.meal ?? '') === id)
        return rows.length > 0 && <section className="meal-group" key={id}>
          <h3>{label}</h3>
          {rows.map((row) => <article className="list-row" key={String(row.id)}>
            {row.photo && <img className="thumb" src={String(row.photo)} alt="" />}
            <div className="grow"><b>{row.name}</b><p>{row.grams == null ? 'ไม่ทราบปริมาณ' : format(Number(row.grams), 1) + ' ก.'} · {show(foodValue(row, 'kcal'), 'kcal')}</p></div>
            <div className="actions">
              <button className="secondary" onClick={() => start(menus.find((menu) => menu.id === row.catalog_id), row)}>แก้ไข</button>
              <button className="secondary" onClick={() => {
                if (confirm('ลบรายการอาหารนี้?')) void run(async () => {
                  await repo.remove('food_logs', String(row.id))
                  if (log?.id === row.id) { revision.current += 1; setDraft(undefined); setPhoto(null) }
                }, 'ลบรายการแล้ว')
              }}>ลบ</button>
            </div>
          </article>)}
        </section>
      })}
    </section>
  </>
}

