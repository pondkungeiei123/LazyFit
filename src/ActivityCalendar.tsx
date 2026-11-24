import { useState } from 'react'
import { daySummary, mondayWeek, monthDays, shiftDate, streaks } from './calendar'
import type { Snapshot } from './repository'

export function WeekSummary({data,day}: {data: Snapshot; day: string}) {
  const week = mondayWeek(day).map(d => daySummary(data,d))
  const readings = week.flatMap(d => d.steps ? [Number(d.steps.steps)] : [])
  return <section className="card"><h2>สัปดาห์นี้</h2><p>จันทร์ {mondayWeek(day)[0]} ถึงอาทิตย์ {mondayWeek(day)[6]}</p>
    <p>ทำภารกิจ {week.filter(d=>d.activities.length).length} วัน · รวม {Math.round(week.reduce((v,d)=>v+d.seconds,0)/60)} นาที</p>
    <p>ถึงเป้าก้าว {week.filter(d=>d.reached).length} วัน · {week.reduce((v,d)=>v+d.xp,0)} XP</p>
    <p>ก้าวเฉลี่ย {readings.length ? Math.round(readings.reduce((a,b)=>a+b,0)/readings.length).toLocaleString('th-TH')+' ก้าว จาก '+readings.length+' วันที่มีข้อมูล' : 'ยังไม่มีข้อมูล'}</p></section>
}

export function Calendar({data,day}: {data: Snapshot; day: string}) {
  const [selected, select] = useState(day)
  const month = selected.slice(0,7)
  const dates = monthDays(month)
  const first = mondayWeek(dates[0]).indexOf(dates[0])
  const detail = daySummary(data,selected)
  const streak = streaks(data,day)
  return <section className="card"><h2>ปฏิทินกิจกรรม</h2>
    <p>ต่อเนื่อง {streak.current} วัน · ยาวที่สุด {streak.longest} วัน</p>
    <small>วันพักคั่นได้โดยไม่นับเพิ่ม วันที่ขาดจะเริ่มนับใหม่ คะแนนสะสมยังอยู่</small>
    <div className="split"><button className="secondary" aria-label="เดือนก่อน" onClick={()=>select(shiftDate(dates[0],-1))}>‹</button>
      <b>{new Date(selected+'T12:00:00Z').toLocaleDateString('th-TH',{month:'long',year:'numeric',timeZone:'Asia/Bangkok'})}</b>
      <button className="secondary" aria-label="เดือนถัดไป" onClick={()=>select(shiftDate(dates.at(-1)!,1))}>›</button></div>
    <div className="calendar">{['จ','อ','พ','พฤ','ศ','ส','อา'].map(v=><b key={v}>{v}</b>)}
      {Array.from({length:first},(_,i)=><span key={'blank'+i}/>)}
      {dates.map(date=>{const d=daySummary(data,date)
        return <button className="secondary" aria-pressed={date===selected} key={date} onClick={()=>select(date)}>
          {Number(date.slice(-2))}<small>{[d.activities.length?'✓':'',d.reached?'★':'',d.rest?'☾':''].join('') || (d.steps?'•':'–')}</small></button>})}</div>
    <small>✓ ภารกิจ · ★ ถึงเป้าก้าว · ☾ พัก · • มีก้าว · – ว่าง</small>
    <h3>{selected}</h3><p>{detail.steps ? Number(detail.steps.steps).toLocaleString('th-TH')+' ก้าว' : 'ยังไม่มีข้อมูลก้าว'} · เป้า {detail.goal} · {detail.reached?'ถึงเป้าแล้ว':'ยังไม่มีบันทึกถึงเป้า'} · {detail.xp} XP</p>
    {detail.activities.map(r=><p key={String(r.id)}>{r.name} · {Number(r.seconds)/60} นาที {r.note && '· '+r.note}</p>)}
    {detail.rest && <p>วันพัก</p>}
    <details><summary>ประวัติ XP ของวันที่เลือก ({detail.events.length})</summary>
      {detail.events.map(r=><p key={String(r.id)}>{r.milestone ? 'เดิน '+(r.milestone==='goal'?'ถึงเป้า':r.milestone+' ก้าว') : 'ภารกิจ'} · +{r.points} XP</p>)}</details></section>
}
