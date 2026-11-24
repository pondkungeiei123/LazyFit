import { useState } from 'react'
import type { Repository, Snapshot } from './repository'
import type { Row } from './schema'
import { bangkokInput, recentMeasures, sortedMeasures, weightAverage } from './measurements'

export type TrackingProps = {data: Snapshot; day: string; repo: Repository; run: (work:()=>Promise<void|string>, message?:string)=>Promise<boolean>}

export function Observations({rows,field,unit}: {rows:Row[]; field:string; unit:string}) {
  if (!rows.length) return <p className="muted">ยังไม่มีข้อมูลในช่วงนี้</p>
  const points = rows.map(r=>({time: Date.parse(String(r.measured_at ?? (r.day+'T12:00'))+':00+07:00'), value:Number(r[field])}))
  const times = points.map(p=>p.time), values = points.map(p=>p.value)
  const first=Math.min(...times), last=Math.max(...times), low=Math.min(...values), high=Math.max(...values)
  return <figure><svg viewBox="0 0 300 90" role="img" aria-label={'กราฟค่าที่บันทึก '+low+' ถึง '+high+' '+unit}>
    <path d="M7 5V83H294" stroke="#aec6b8" fill="none"/>
    {points.map((p,i)=><circle key={i} r="3.5" fill="#176745"
      cx={last===first?150:10+(p.time-first)/(last-first)*280} cy={high===low?44:78-(p.value-low)/(high-low)*68}>
      <title>{rows[i].day} · {p.value} {unit}</title></circle>)}</svg>
    <figcaption>{new Date(first).toLocaleDateString('th-TH',{timeZone:'Asia/Bangkok'})} – {new Date(last).toLocaleDateString('th-TH',{timeZone:'Asia/Bangkok'})} · {low}–{high} {unit}</figcaption></figure>
}

export function BodyMeasurements({data,day,repo,run}: TrackingProps) {
  const [table,setTable] = useState<'weight_logs'|'waist_logs'>('weight_logs')
  const [days,setDays] = useState(7)
  const [edit,setEdit] = useState<Row>()
  const weight = table==='weight_logs', field=weight?'kg':'cm', unit=weight?'กก.':'ซม.', label=weight?'น้ำหนัก':'รอบเอว'
  const rows=sortedMeasures(data[table]), start=rows.at(-1), latest=rows[0]
  const average=weightAverage(data.weight_logs,day)
  return <section className="card"><h2>น้ำหนักและรอบเอว</h2>
    <label>ดูประวัติ<select value={table} onChange={e=>{setTable(e.target.value as typeof table);setEdit(undefined)}}>
      <option value="weight_logs">น้ำหนัก</option><option value="waist_logs">รอบเอว</option></select></label>
    {start && latest && <p>ครั้งแรก {start[field]} · ล่าสุด {latest[field]} {unit}</p>}
    {weight && <p>{average===null?'บันทึกอย่างน้อยสองวันเพื่อดูน้ำหนักเฉลี่ย 7 วัน':'เฉลี่ย 7 วันจากวันที่ชั่ง '+average.toFixed(1)+' กก.'}</p>}
    <div className="modes">{[7,30,90,0].map(d=><button key={d} aria-pressed={days===d} className="secondary" onClick={()=>setDays(d)}>{d?d+' วัน':'ทั้งหมด'}</button>)}</div>
    <Observations rows={recentMeasures(rows,day,days)} field={field} unit={unit}/>
    <form key={table+String(edit?.id)} onSubmit={e=>{
      e.preventDefault()
      const form=e.currentTarget, f=new FormData(form), value=Number(f.get('value')), time=String(f.get('time'))
      if ((weight?(value<25||value>300):(value<35||value>250)) && !confirm('ยืนยันค่าที่วัด '+value+' '+unit+'?')) return
      void run(()=>repo.save(table,{day:time.slice(0,10),measured_at:time,[field]:value,note:String(f.get('note')).trim()||null}, edit?String(edit.id):undefined),'บันทึกแล้ว')
        .then(ok=>{if(ok){form.reset();setEdit(undefined)}})
    }}><label>วันที่และเวลา (ไทย)<input name="time" type="datetime-local" required max={bangkokInput()}
      defaultValue={edit?String(edit.measured_at ?? edit.day+'T12:00'):bangkokInput()}/></label>
      {edit && !edit.measured_at && <small>รายการเดิมมีเฉพาะวันที่ โปรดระบุเวลาที่วัด</small>}
      <label>{label} ({unit})<input type="number" name="value" required step="0.1" min="0.1" max={weight?700:500} defaultValue={edit?Number(edit[field]):''}/></label>
      <label>หมายเหตุ<input name="note" maxLength={500} defaultValue={String(edit?.note??'')}/></label>
      <button>{edit?'บันทึกการแก้ไข':'เพิ่ม'+label}</button>{edit && <button className="secondary" type="button" onClick={()=>setEdit(undefined)}>ยกเลิก</button>}</form>
    <details><summary>ประวัติทั้งหมด ({rows.length})</summary>{rows.map(r=><article className="list-row" key={String(r.id)}>
      <div className="grow">{r[field]} {unit}<small>{String(r.measured_at??r.day).replace('T',' ')} {r.note}</small></div>
      {r.source==='manual' && <><button className="secondary" onClick={()=>setEdit(r)}>แก้ไข</button><button className="secondary" onClick={()=>{
        if(confirm('ลบรายการนี้?')) void run(()=>repo.remove(table,String(r.id)),'ลบแล้ว')
      }}>ลบ</button></>}</article>)}</details></section>
}
