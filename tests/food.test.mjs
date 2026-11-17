import test from 'node:test'
import assert from 'node:assert/strict'
import { catalog, estimate, portion, searchFood, unknownNutrition } from '../src/foodCatalog.ts'

test('ค้นหาชื่อไทย ชื่อเรียก คำบางส่วน และการพิมพ์คลาดเคลื่อน', () => {
  assert.equal(searchFood(catalog, ' ข้าว กะเพราไก่ ')[0].id, 'basil-chicken')
  assert.equal(searchFood(catalog, 'กระเพราไก่')[0].id, 'basil-chicken')
  assert.equal(searchFood(catalog, 'ชาไทย')[0].id, 'thai-tea')
  assert.ok(searchFood(catalog, 'มะม่วง').some((item) => item.id === 'mango-sticky'))
  assert.equal(searchFood(catalog, 'ข้าวกะเพาไก่')[0].id, 'basil-chicken')
  assert.deepEqual(searchFood(catalog, 'ไม่มีรายการนี้'), [])
})

test('ชั่งน้ำหนักและปรับส่วนผสม โดยไม่แทนค่าที่ขาดด้วยศูนย์', () => {
  const rice = catalog.find((item) => item.id === 'rice')
  const standard = portion(rice, 1)
  assert.equal(standard[0].grams, 150)
  assert.ok(portion(rice, 0)[0].grams < 150 && portion(rice, 2)[0].grams > 150)
  assert.equal(estimate(standard, 150).kcal, 195)
  assert.equal(estimate(standard, 75).kcal, 97.5)
  const withOil = estimate([...standard, { id: 'oil', grams: 10 }], 160)
  assert.ok(Math.abs(withOil.kcal - 283.4) < 1e-10)
  assert.ok(Math.abs(withOil.fat - 10.42) < 1e-10)
  assert.deepEqual(estimate([...standard, { id: 'absent', grams: 10 }], 160), unknownNutrition())
  assert.equal(estimate([...standard, { id: 'absent', grams: 0 }], 150).kcal, 195)
  assert.deepEqual(estimate(standard, null), unknownNutrition())
})

