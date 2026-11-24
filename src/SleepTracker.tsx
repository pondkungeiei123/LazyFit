import {useEffect,useState} from 'react'
import {connection,healthSleep} from './device'
import type {Connection} from './device'
import {bangkokInput,recentMeasures} from './measurements'
import {sleepNights} from './sleep'
import type {Row} from './schema'
import {Observations} from './BodyMeasurements'
import type {TrackingProps} from './BodyMeasurements'

const labels:Record<string,string>={light:'หลับตื้น',deep:'หลับลึก',rem:'REM',awake:'ตื่น'}
const format=(v:unknown)=>new Date(String(v)).toLocaleString('th-TH',{timeZone:'Asia/Bangkok',dateStyle:'short',timeStyle:'short'})
export function SleepTracker({data,day,repo,run}:TrackingProps) {
  const [days,range]=useState(7),[edit,setEdit]=useState<Row>(),[state,status]=useState<Connection>()
  useEffect(()=>{const refresh=()=>{void connection(false,'sleep').then(status,()=>status(undefined))};refresh()
    window.addEventListener('focus',refresh);return ()=>window.removeEventListener('focus',refresh)},[])
  const sync=data.sync_metadata.find(r=>r.id==='health_sleep')
  const nights=sleepNights(data.sleep_logs)
  return <section className="card"><h2>การนอนหลับ</h2>
    <p>รวมช่วงเข้านอนถึงตื่นที่บันทึกไว้ นับช่วงทับกันครั้งเดียว แบ่งคืนตามเวลาเที่ยงวันของไทย</p>
    <div className="modes">{[7,30].map(d=><button key={d} className="secondary" aria-pressed={days===d} onClick={()=>range(d)}>{d} วัน</button>)}</div>
    <Observations rows={recentMeasures(nights,day,days)} field="minutes" unit="นาที"/>
    <h3>Health Connect</h3>
    <p>{state==='granted'?'อนุญาตให้อ่านการนอนแล้ว':state==='permission_required'?'ยังไม่ได้อนุญาตให้อ่านการนอน':state==='web'?'บนเว็บบันทึกการนอนด้วยตนเองได้':state==='update_required'?'ติดตั้งหรืออัปเดต Health Connect':'ยังอ่าน Health Connect ไม่ได้'}</p>
    {sync && <small>ตรวจล่าสุด {format(sync.last_sync)} · {sync.status==='empty'?'ไม่พบช่วงการนอนใน 30 วัน':'พบช่วงการนอน'}</small>}
    {state==='permission_required' && <button className="secondary" onClick={()=>void run(async()=>{status(await connection(true,'sleep'))})}>อนุญาตให้อ่านการนอน</button>}
    {state==='granted' && <button className="secondary" onClick={()=>void run(async()=>{
      const permission=await connection(false,'sleep');status(permission)
      if(permission!=='granted')throw new Error('กรุณาตรวจสิทธิ์อ่านการนอนอีกครั้ง')
      const {records}=await healthSleep()
      await repo.importSleep(records)
      return records.length?'บันทึกช่วงการนอนจาก Health Connect แล้ว':'ไม่พบข้อมูลการนอนจาก Health Connect'
    })}>อ่านการนอน 30 วัน</button>}
    <form key={String(edit?.id)} onSubmit={e=>{e.preventDefault();const form=e.currentTarget,f=new FormData(form)
      void run(()=>repo.saveSleep(f.get('start')+':00+07:00',f.get('end')+':00+07:00',String(f.get('note')),edit?String(edit.id):undefined),'บันทึกการนอนแล้ว')
        .then(ok=>{if(ok){form.reset();setEdit(undefined)}})
    }}>
      <label>เข้านอน (เวลาไทย)<input name="start" type="datetime-local" required max={bangkokInput()} defaultValue={edit?.start_at?bangkokInput(new Date(String(edit.start_at))):''}/></label>
      <label>ตื่น (เวลาไทย)<input name="end" type="datetime-local" required max={bangkokInput()} defaultValue={edit?.end_at?bangkokInput(new Date(String(edit.end_at))):''}/></label>
      <label>หมายเหตุ<input name="note" maxLength={500} defaultValue={String(edit?.note??'')}/></label>
      <button>{edit?'บันทึกการแก้ไข':'บันทึกการนอน'}</button>{edit && <button type="button" className="secondary" onClick={()=>setEdit(undefined)}>ยกเลิก</button>}
    </form><details><summary>ประวัติการนอน ({data.sleep_logs.length})</summary>
    {data.sleep_logs.map(r=><article className="card" key={String(r.id)}><b>คืนวันที่ {r.day} · {r.minutes} นาที</b>
      {r.start_at && <p>{format(r.start_at)} – {format(r.end_at)}</p>}<p>{r.source==='manual'?'กรอกเอง':'Health Connect · '+r.origin} {r.note}</p>
      {Object.entries(JSON.parse(String(r.stages??'{}')) as Record<string,number>).map(([k,v])=><small key={k}>{labels[k]} {Math.round(v)} นาที </small>)}
      {r.source==='manual' && <div className="actions"><button className="secondary" onClick={()=>setEdit(r)}>แก้ไข</button><button className="secondary" onClick={()=>{
        if(confirm('ลบรายการนอนนี้?'))void run(()=>repo.remove('sleep_logs',String(r.id)),'ลบแล้ว')
      }}>ลบ</button></div>}</article>)}</details></section>
}
