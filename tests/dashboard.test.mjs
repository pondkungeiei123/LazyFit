import test from 'node:test'
import assert from 'node:assert/strict'
import {healthSeries,goalProgress} from '../src/dashboardData.ts'
test('Dashboard uses measured days, consumed portions, preferred step source and union of sleep sessions',()=>{
  const day='2025-03-02'
  const data={
    weight_logs:[{day,measured_at:day+'T07:00',kg:66},{day,measured_at:day+'T09:00',kg:65}],
    waist_logs:[{day,cm:80}], exercise_logs:[{day,seconds:120},{day,seconds:60}],
    rest_days:[{day:'2025-03-03'}],
    food_logs:[{day,kcal:null,grams:null},{day,kcal:100,grams:150,base_grams:100},{day:'2025-03-03',kcal:null,grams:null}],
    daily_activity:[{day,source:'manual',steps:200},{day,source:'health_connect',steps:0}],
    sleep_logs:[{day,start_at:'2025-03-02T15:00:00Z',end_at:'2025-03-02T21:00:00Z'},
      {day,start_at:'2025-03-02T16:00:00Z',end_at:'2025-03-02T20:00:00Z'}],
  }
  const result=healthSeries(data,day,'2025-03-03')
  assert.deepEqual(result.weight,[{day,value:65}])
  assert.equal(result.waist[0].value,80)
  assert.deepEqual(result.calories,[{day,value:150,note:'เฉพาะรายการที่ทราบ'}])
  assert.equal(result.steps[0].value,0)
  assert.equal(result.sleep[0].value,6)
  assert.deepEqual(result.exercise.map(r=>r.value),[3,0])
  for(const s of Object.values(healthSeries(data,'2025-04-01','2025-04-01')))assert.equal(s.length,0)
})
test('Weight goal progress respects gain, loss and maintenance targets',()=>{
  assert.equal(goalProgress(90,85,80),50)
  assert.equal(goalProgress(80,85,90),50)
  assert.equal(goalProgress(80,80,80),100)
  assert.equal(goalProgress(80,85,80),0)
  assert.equal(goalProgress(90,95,80),0)
  assert.equal(goalProgress(90,75,80),100)
})
