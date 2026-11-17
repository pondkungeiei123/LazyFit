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
  ingredient('lime', 'น้ำมะนาว', 168156, [25, 0.42, 8.42, 0.07], 15),
  ingredient('noodles', 'เส้นก๋วยเตี๋ยวสุก', 168914, [108, 1.79, 24.01, 0.2], 150),
  ingredient('pineapple', 'สับปะรด', 169124, [50, 0.54, 13.12, 0.12], 100),
  ingredient('pumpkin', 'ฟักทองสุก (บัตเตอร์นัต)', 169296, [40, 0.9, 10.49, 0.09], 100),
  ingredient('papaya', 'มะละกอสุก', 169926, [43, 0.47, 10.82, 0.26], 100),
  ingredient('broccoli', 'บรอกโคลีสุก', 169967, [35, 2.38, 7.18, 0.41], 100),
  ingredient('cabbage', 'กะหล่ำปลีสุก', 169976, [23, 1.27, 5.51, 0.06], 100),
  ingredient('tomato', 'มะเขือเทศ', 170457, [18, 0.88, 3.89, 0.2], 50),
  ingredient('tofu', 'เต้าหู้แข็ง', 172475, [144, 17.27, 2.78, 8.72], 100),
  ingredient('stock', 'น้ำซุปไก่', 172884, [36, 2.52, 3.53, 1.2], 150),
  ingredient('water', 'น้ำดื่ม', 173647, [0, 0, 0, 0], 200),
  ingredient('peanuts', 'ถั่วลิสงคั่ว', 173806, [587, 24.35, 21.26, 49.66], 15),
  ingredient('banana', 'กล้วยสุก', 173944, [89, 1.09, 22.84, 0.33], 100),
  ingredient('mung', 'ถั่วเขียวต้ม', 174257, [105, 7.02, 19.15, 0.38], 100),
  ingredient('tilapia', 'ปลานิลสุก', 175177, [128, 26.15, 0, 2.65], 100),
  ingredient('shrimp', 'กุ้งสุก', 175180, [99, 23.98, 0.2, 0.28], 100),
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
  recipe('fried-rice-chicken', 'ข้าวผัดไก่', 'จานเดียว', [],
    { rice: 170, chicken: 70, egg: 50, oil: 10, soy: 8, garlic: 4 }),
  recipe('fried-rice-shrimp', 'ข้าวผัดกุ้ง', 'จานเดียว', [],
    { rice: 170, shrimp: 65, egg: 50, oil: 10, soy: 8, garlic: 4 }),
  recipe('fried-rice-egg', 'ข้าวผัดไข่', 'จานเดียว', [],
    { rice: 175, egg: 75, oil: 10, soy: 8, cucumber: 25 }),
  recipe('pineapple-rice', 'ข้าวผัดสับปะรด', 'จานเดียว', [],
    { rice: 150, pineapple: 65, shrimp: 50, egg: 40, oil: 10, soy: 7, sugar: 3 }),
  recipe('basil-shrimp', 'ข้าวกะเพรากุ้ง', 'ตามสั่ง', ['กระเพรากุ้ง'],
    { rice: 160, shrimp: 85, egg: 0, oil: 10, basil: 5, garlic: 5, soy: 10, sugar: 4 }),
  recipe('basil-tofu', 'ข้าวกะเพราเต้าหู้', 'ตามสั่ง', ['กระเพราเต้าหู้'],
    { rice: 155, tofu: 90, oil: 10, basil: 5, garlic: 5, soy: 9, sugar: 4 }),
  recipe('garlic-pork', 'ข้าวหมูกระเทียม', 'ตามสั่ง', [],
    { rice: 160, pork: 90, oil: 10, garlic: 10, soy: 10, sugar: 4 }),
  recipe('garlic-shrimp', 'ข้าวกุ้งกระเทียม', 'ตามสั่ง', [],
    { rice: 160, shrimp: 90, oil: 10, garlic: 10, fish: 7, sugar: 4 }),
  recipe('chicken-rice', 'ข้าวมันไก่', 'จานเดียว', [],
    { rice: 170, chicken: 90, oil: 12, garlic: 5, stock: 20, cucumber: 30, soy: 9, sugar: 4 }),
  recipe('pork-omelette', 'ข้าวไข่เจียวหมูสับ', 'จานเดียว', [],
    { rice: 155, egg: 100, pork: 40, oil: 15, fish: 6 }),
  recipe('boiled-rice-pork', 'ข้าวต้มหมู', 'จานเดียว', [],
    { rice: 110, pork: 60, stock: 220, garlic: 4, soy: 6 }),
  recipe('boiled-rice-shrimp', 'ข้าวต้มกุ้ง', 'จานเดียว', [],
    { rice: 110, shrimp: 65, stock: 220, garlic: 4, soy: 6 }),
  recipe('ginger-rice-chicken', 'ข้าวต้มไก่', 'จานเดียว', [],
    { rice: 110, chicken: 65, stock: 220, soy: 7, garlic: 4 }),
  recipe('noodle-soup-pork', 'ก๋วยเตี๋ยวน้ำหมู', 'จานเดียว', ['ก๋วยเตี๋ยวหมูน้ำใส'],
    { noodles: 145, pork: 65, stock: 180, cabbage: 35, soy: 7, garlic: 5 }),
  recipe('noodle-soup-chicken', 'ก๋วยเตี๋ยวน้ำไก่', 'จานเดียว', ['ก๋วยเตี๋ยวไก่น้ำใส'],
    { noodles: 145, chicken: 70, stock: 180, cabbage: 35, soy: 7, garlic: 5 }),
  recipe('soy-noodles-pork', 'ผัดซีอิ๊วหมู', 'จานเดียว', ['เส้นใหญ่ผัดซีอิ๊วหมู'],
    { noodles: 170, pork: 65, egg: 50, oil: 12, broccoli: 50, soy: 12, sugar: 6 }),
  recipe('soy-noodles-chicken', 'ผัดซีอิ๊วไก่', 'จานเดียว', [],
    { noodles: 170, chicken: 65, egg: 50, oil: 12, broccoli: 50, soy: 12, sugar: 6 }),
  recipe('pad-thai-shrimp', 'ผัดไทยกุ้งสด', 'จานเดียว', ['ผัดไทกุ้ง'],
    { noodles: 165, shrimp: 65, egg: 50, tofu: 30, oil: 12, peanuts: 12, fish: 8, sugar: 12, lime: 12 }),
  recipe('pad-thai-tofu', 'ผัดไทยเต้าหู้', 'จานเดียว', [],
    { noodles: 165, tofu: 75, egg: 50, oil: 12, peanuts: 12, soy: 8, sugar: 12, lime: 12 }),
  recipe('mixed-vegetables', 'ผัดผักรวม', 'ตามสั่ง', [],
    { broccoli: 75, cabbage: 60, tomato: 40, oil: 10, soy: 8, garlic: 5 }),
  recipe('cabbage-fish-sauce', 'กะหล่ำปลีผัดน้ำปลา', 'ตามสั่ง', [],
    { cabbage: 150, oil: 12, fish: 8, garlic: 5, sugar: 3 }),
  recipe('clear-tofu-soup', 'ต้มจืดเต้าหู้หมูสับ', 'ตามสั่ง', ['แกงจืดเต้าหู้'],
    { stock: 220, tofu: 60, pork: 50, cabbage: 60, soy: 6 }),
  recipe('tom-yum-shrimp', 'ต้มยำกุ้งน้ำใส', 'ตามสั่ง', ['ต้มยำกุ้ง'],
    { stock: 200, shrimp: 85, tomato: 45, lime: 20, fish: 12, sugar: 3 }),
  recipe('grilled-fish', 'ปลานิลย่าง', 'ตามสั่ง', ['ปลานิลเผา'],
    { tilapia: 150, lime: 12, fish: 6 }),
  recipe('spicy-pork-lime', 'หมูมะนาว', 'ตามสั่ง', [],
    { pork: 110, lime: 24, fish: 10, sugar: 6, garlic: 8, cabbage: 50 }),
  recipe('banana-coconut', 'กล้วยบวชชี', 'ของหวาน', [],
    { banana: 100, coconut: 65, water: 60, sugar: 20 }),
  recipe('pumpkin-coconut', 'ฟักทองแกงบวด', 'ของหวาน', ['แกงบวดฟักทอง'],
    { pumpkin: 120, coconut: 60, water: 60, sugar: 20 }),
  recipe('sweet-mung', 'ถั่วเขียวต้มน้ำตาล', 'ของหวาน', [],
    { mung: 110, water: 120, sugar: 20 }),
  recipe('lime-drink', 'น้ำมะนาว', 'เครื่องดื่ม', ['มะนาวเย็น'],
    { lime: 35, water: 200, sugar: 22 }),
  recipe('lime-tea', 'ชามะนาว', 'เครื่องดื่ม', [],
    { tea: 190, lime: 25, sugar: 20 }),
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
  // Stored values describe base_grams. New logs store the consumed totals with base_grams = grams.
  return row[key] == null || row.grams == null ? null : Number(row[key]) * (Number(row.grams) / Number(row.base_grams))
}

export function mealNutrition(parts: Part[], grams: number | null, previous?: Row): Nutrition {
  if (previous && (previous.grams !== null || !parts.length) &&
    (previous.ingredient_mix ?? null) === (parts.length ? JSON.stringify(parts) : null)) {
    const scaled = { ...previous, grams }
    return {
      kcal: foodValue(scaled, 'kcal'), protein: foodValue(scaled, 'protein'),
      carbs: foodValue(scaled, 'carbs'), fat: foodValue(scaled, 'fat'),
    }
  }
  return estimate(parts, grams)
}

export function foodTotals(rows: Row[], key: Nutrient) {
  const known = rows.map((row) => foodValue(row, key)).filter((value): value is number => value !== null)
  return { sum: known.reduce((sum, value) => sum + value, 0), known: known.length, missing: rows.length - known.length }
}

export const fdcDatasetUrl = 'https://fdc.nal.usda.gov/download-datasets/'

