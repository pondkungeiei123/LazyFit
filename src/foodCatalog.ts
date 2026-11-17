import type { Row } from './schema.ts'

export const nutrientKeys = ['kcal', 'protein', 'carbs', 'fat'] as const
export type Nutrient = typeof nutrientKeys[number]
export type Nutrition = Record<Nutrient, number | null>
export type Part = { id: string; grams: number }
export type Menu = {
  id: string
  name: string
  aliases: string[]
  group: 'จานเดียว' | 'ตามสั่ง' | 'เครื่องดื่ม' | 'ของหวาน' | 'ส่วนประกอบ' | 'เมนูส่วนตัว'
  parts?: Part[]
  fdc?: number
  portions?: number[]
}

type Ingredient = Menu & { fdc: number; values: Nutrition; portions: number[] }

// SR Legacy, April 2018. Nutrients 1008, 1003, 1005, 1004 per 100 g edible portion.
function ingredient(id: string, name: string, fdc: number, values: number[], serving: number, aliases: string[] = []): Ingredient {
  return { id, name, fdc, values: { kcal: values[0], protein: values[1], carbs: values[2], fat: values[3] },
    group: 'ส่วนประกอบ', aliases, portions: [serving * 0.75, serving, serving * 1.25] }
}

export const ingredients = [
  ingredient('rice', 'ข้าวสวย', 168878, [130, 2.69, 28.17, 0.28], 150, ['ข้าวขาว', 'ข้าวสุก', 'ข้าวเปล่า']),
  ingredient('egg', 'ไข่ต้ม', 173424, [155, 12.58, 1.12, 10.61], 50, ['ไข่ไก่', 'ไข่', 'ไข่ลวก']),
  ingredient('chicken', 'อกไก่สุก', 171477, [165, 31.02, 0, 3.57], 100, ['เนื้อไก่', 'ไก่ย่าง']),
  ingredient('pork', 'สันในหมูสุก', 168250, [143, 26.17, 0, 3.51], 100, ['เนื้อหมู', 'หมูย่าง']),
  ingredient('oil', 'น้ำมันถั่วเหลือง', 171411, [884, 0, 0, 100], 10, ['น้ำมันพืช']),
  ingredient('sugar', 'น้ำตาลทราย', 169655, [387, 0, 99.98, 0], 10, ['น้ำตาล']),
  ingredient('milk', 'นมสดเต็มมันเนย', 172217, [61, 3.15, 4.78, 3.27], 200, ['นมวัว', 'นมจืด']),
  ingredient('coffee', 'กาแฟดำชง', 171890, [1, 0.12, 0, 0.02], 200, ['อเมริกาโน่ไม่หวาน']),
  ingredient('tea', 'ชาดำชง', 173227, [1, 0, 0.3, 0], 200, ['ชาดำไม่หวาน']),
  ingredient('mango', 'มะม่วงสุก', 169910, [60, 0.82, 14.98, 0.38], 100, ['มะม่วง']),
  ingredient('coconut', 'กะทิกระป๋อง', 170173, [197, 2.02, 2.81, 21.33], 30, ['กะทิ']),
  ingredient('sticky', 'ข้าวเหนียวสุก', 169711, [97, 2.02, 21.09, 0.19], 100, ['ข้าวเหนียว']),
  ingredient('basil', 'ใบโหระพา (ตัวแทนใบกะเพรา)', 172232, [23, 3.15, 2.65, 0.64], 5, ['ใบกะเพรา']),
  ingredient('garlic', 'กระเทียม', 169230, [149, 6.36, 33.06, 0.5], 5),
  ingredient('soy', 'ซีอิ๊วถั่วเหลือง', 174277, [53, 8.14, 4.93, 0.57], 10, ['ซีอิ๊ว']),
  ingredient('fish', 'น้ำปลา', 174531, [35, 5.06, 3.64, 0.01], 10),
  ingredient('cucumber', 'แตงกวา', 168409, [15, 0.65, 3.63, 0.11], 50),
]
export const ingredientById = new Map(ingredients.map((item) => [item.id, item]))
const parts = (amounts: Record<string, number>): Part[] => Object.entries(amounts).map(([id, grams]) => ({ id, grams }))
function recipe(id: string, name: string, group: Menu['group'], aliases: string[], amounts: Record<string, number>): Menu {
  return { id, name, group, aliases, parts: parts(amounts) }
}

export const catalog: Menu[] = [
  recipe('basil-chicken', 'ข้าวกะเพราไก่', 'ตามสั่ง', ['กระเพราไก่', 'ข้าวผัดกะเพราไก่', 'ข้าวกะเพราไก่ไข่ดาว'],
    { rice: 160, chicken: 85, egg: 0, oil: 10, basil: 5, garlic: 4, soy: 10, sugar: 4 }),
  recipe('basil-pork', 'ข้าวกะเพราหมู', 'ตามสั่ง', ['กระเพราหมู', 'กะเพราหมูสับ'],
    { rice: 160, pork: 85, egg: 0, oil: 10, basil: 5, garlic: 4, soy: 10, sugar: 4 }),
  recipe('fried-rice', 'ข้าวผัดหมู', 'จานเดียว', ['ข้าวผัด', 'ข้าวผัดใส่ไข่'],
    { rice: 175, pork: 65, egg: 50, oil: 10, soy: 8, sugar: 3, cucumber: 20 }),
  recipe('garlic-chicken', 'ข้าวไก่กระเทียม', 'ตามสั่ง', ['ไก่ทอดกระเทียม', 'ข้าวไก่กระเทียมพริกไทย'],
    { rice: 160, chicken: 90, egg: 0, oil: 10, garlic: 12, soy: 10, sugar: 4 }),
  recipe('egg-rice', 'ข้าวไข่เจียว', 'จานเดียว', ['ไข่เจียวราดข้าว', 'ไข่เจียว'],
    { rice: 160, egg: 100, oil: 15, fish: 6 }),
  recipe('sticky-chicken', 'ข้าวเหนียวไก่ย่าง', 'จานเดียว', ['ไก่ย่างข้าวเหนียว', 'ข้าวเหนียวอกไก่'],
    { sticky: 100, chicken: 100, soy: 8, sugar: 5, oil: 0 }),
  recipe('thai-tea', 'ชานมเย็น', 'เครื่องดื่ม', ['ชาไทย', 'ชาเย็น', 'ชาแดงใส่นม'],
    { tea: 170, milk: 75, sugar: 25 }),
  recipe('iced-coffee', 'กาแฟนมเย็น', 'เครื่องดื่ม', ['กาแฟเย็น', 'กาแฟใส่นม'],
    { coffee: 160, milk: 85, sugar: 20 }),
  recipe('mango-sticky', 'ข้าวเหนียวมะม่วง', 'ของหวาน', ['ข้าวเหนียวมูนมะม่วง', 'มะม่วงข้าวเหนียว'],
    { sticky: 100, mango: 100, coconut: 35, sugar: 18 }),
  recipe('sweet-mango-milk', 'มะม่วงนมสดปั่น', 'เครื่องดื่ม', ['มะม่วงปั่น', 'สมูทตีมะม่วง'],
    { mango: 130, milk: 120, sugar: 12 }),
  ...ingredients,
]

const normalize = (text: string) => text.normalize('NFKC').toLowerCase().replace(/[\s\p{P}\p{S}]/gu, '')
function distance(left: string, right: string) {
  let previous = Array.from({ length: right.length + 1 }, (_, i) => i)
  for (let i = 1; i <= left.length; i++) {
    const row = [i]
    for (let j = 1; j <= right.length; j++) {
      row.push(Math.min(row[j - 1] + 1, previous[j] + 1, previous[j - 1] + Number(left[i - 1] !== right[j - 1])))
    }
    previous = row
  }
  return previous[right.length]
}

export function searchFood(items: Menu[], query: string) {
  const key = normalize(query)
  if (!key) return items
  return items.map((item) => ({
    item,
    rank: Math.min(...[item.name, ...item.aliases].map((label) => {
      const name = normalize(label)
      if (name === key) return 0
      if (name.startsWith(key)) return 1
      if (name.includes(key)) return 2
      if (key.length >= 4 && Math.abs(key.length - name.length) <= 2 && distance(key, name) <= (key.length >= 8 ? 2 : 1)) return 3
      return Infinity
    })),
  })).filter(({ rank }) => Number.isFinite(rank)).sort((a, b) => a.rank - b.rank).map(({ item }) => item)
}

export function portion(menu: Menu, size: number): Part[] {
  if (menu.parts) return menu.parts.map((part) => ({ ...part, grams: Math.round(part.grams * [0.75, 1, 1.25][size]) }))
  return menu.portions ? [{ id: menu.id, grams: menu.portions[size] }] : []
}

export const unknownNutrition = (): Nutrition => ({ kcal: null, protein: null, carbs: null, fat: null })
export function estimate(parts: Part[], eatenGrams: number | null) {
  const positive = parts.filter(({ grams }) => grams > 0)
  const totalGrams = positive.reduce((sum, part) => sum + part.grams, 0)
  if (!totalGrams || eatenGrams === null || eatenGrams <= 0) return unknownNutrition()
  const scale = eatenGrams / totalGrams / 100
  const result = unknownNutrition()
  for (const key of nutrientKeys) {
    const values = positive.map(({ id }) => ingredientById.get(id)?.values[key])
    if (values.every((value) => value != null)) {
      result[key] = positive.reduce((sum, part, i) => sum + part.grams * values[i]!, 0) * scale
    }
  }
  return result
}

export function foodValue(row: Row, key: Nutrient) {
  return row[key] == null || row.grams == null ? null : Number(row[key]) * Number(row.grams) / Number(row.base_grams)
}

export function foodTotals(rows: Row[], key: Nutrient) {
  const known = rows.map((row) => foodValue(row, key)).filter((value): value is number => value !== null)
  return { sum: known.reduce((sum, value) => sum + value, 0), known: known.length, missing: rows.length - known.length }
}

export const fdcDatasetUrl = 'https://fdc.nal.usda.gov/download-datasets/'

