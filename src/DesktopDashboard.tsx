import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { Calendar } from './ActivityCalendar'
import { DashIcon } from './DashboardIcons'
import type { IconName } from './DashboardIcons'
import { goalProgress, healthSeries } from './dashboardData'
import type { SeriesKey } from './dashboardData'
import { foodTotals, foodValue, meals } from './foodCatalog'
import { shiftDate, streaks } from './calendar'
import type { Repository, Snapshot } from './repository'
import type { Row } from './schema'
import './desktop.css'

const TrendChart = lazy(()=>import('./TrendChart').then(module=>({default:module.TrendChart})))
export const wideTabs = ['ภาพรวมสุขภาพ','บันทึกอาหาร','ออกกำลังกาย','ประวัติสุขภาพ','ตั้งค่าและซิงก์ข้อมูล']
const tabIcons:IconName[] = ['overview','food','exercise','health','settings']
const number = (value:number) => value.toLocaleString('th-TH',{maximumFractionDigits:1})
const shortDate = (day:string) => new Date(day+'T12:00:00Z').toLocaleDateString('th-TH',{day:'numeric',month:'short',timeZone:'UTC'})
export function DashboardNav({tab,onTab,repo,data}: {tab:number;onTab:(index:number)=>void;repo:Repository;data?:Snapshot}) {
  const [sync,setSync] = useState<Row>()
  const [failed,setFailed] = useState(false)
  useEffect(()=>{
    let current=true
    void repo.syncStatus().then(row=>{if(current){setSync(row);setFailed(false)}},()=>{if(current)setFailed(true)})
    return ()=>{current=false}
  },[repo,data])
  return <aside className="dash-sidebar">
    <div className="dash-brand"><span><DashIcon name="leaf"/></span>LazyFit</div>
    <nav aria-label="เมนูแดชบอร์ด">{wideTabs.map((name,i)=><button key={name} aria-current={i===tab?'page':undefined} onClick={()=>onTab(i)}><DashIcon name={tabIcons[i]}/><span>{name}</span></button>)}</nav>
    <div className="dash-storage"><DashIcon name="screen"/><div><b>ข้อมูลในเครื่องนี้เท่านั้น</b><small>ซิงก์ข้ามเครื่องปิดอยู่</small>
      <small>{failed?'ตรวจเวลาซิงก์ไม่ได้':!sync?'กำลังอ่านสถานะ…':sync.last_ack?'ซิงก์ล่าสุด '+new Date(String(sync.last_ack)).toLocaleString('th-TH'):'ยังไม่เคยซิงก์'}</small></div></div>
  </aside>
}
const charts: {key:SeriesKey;title:string;unit:string;icon:IconName;color:string}[] = [
  {key:'weight',title:'น้ำหนัก',unit:'กก.',icon:'weight',color:'#247052'},
  {key:'waist',title:'รอบเอว',unit:'ซม.',icon:'waist',color:'#527c58'},
  {key:'calories',title:'พลังงานจากอาหาร',unit:'กิโลแคลอรี',icon:'flame',color:'#b36d39'},
  {key:'steps',title:'จำนวนก้าว',unit:'ก้าว',icon:'steps',color:'#368582'},
  {key:'sleep',title:'การนอนหลับ',unit:'ชม.',icon:'sleep',color:'#726897'},
  {key:'exercise',title:'เวลาออกกำลังกาย',unit:'นาที',icon:'exercise',color:'#7b8142'},
]
function Trends({data,day}: {data:Snapshot;day:string}) {
  const [period,setPeriod]=useState(7)
  const [start,setStart]=useState(shiftDate(day,-6)), [end,setEnd]=useState(day)
  const from=period?shiftDate(day,1-period):start, to=period?day:end
  const valid=!!from && !!to && from<=to && to<=day
  const series=useMemo(()=>valid?healthSeries(data,from,to):null,[data,from,to,valid])
  return <section className="trend-section"><div className="dash-section-head"><div><h2>แนวโน้มสุขภาพ</h2>
    {valid && <small>{shortDate(from)} – {shortDate(to)} {new Date(to+'T12:00:00Z').toLocaleDateString('th-TH',{year:'numeric',timeZone:'UTC'})}</small>}</div>
    <div className="range-options" aria-label="ช่วงเวลาของกราฟ">{[7,30,90,0].map(d=><button key={d} aria-pressed={period===d} onClick={()=>setPeriod(d)}>{d?d+' วัน':'กำหนดเอง'}</button>)}</div></div>
    {!period && <div className="custom-range"><label>ตั้งแต่วันที่<input type="date" max={day} value={start} onChange={e=>setStart(e.target.value)}/></label>
      <label>ถึงวันที่<input type="date" max={day} min={start} value={end} onChange={e=>setEnd(e.target.value)}/></label></div>}
    {series ? <div className="trend-grid"><Suspense fallback={<p>กำลังเปิดกราฟ…</p>}>{charts.map(({key,...chart})=><TrendChart key={key} {...chart} readings={series[key]} from={from} to={to}/>)}</Suspense></div> :
      <p role="alert">เลือกวันเริ่มต้นถึงวันสิ้นสุดตามลำดับ ภายในวันนี้</p>}
  </section>
}
function Metric({icon,title,value,unit,detail,accent='',children}: {icon:IconName;title:string;value:string;unit?:string;detail:string;accent?:string;children?:ReactNode}) {
  return <article className={'metric-card '+accent}><div className="metric-name"><span><DashIcon name={icon}/></span><h3>{title}</h3></div>
    <p className="metric-value">{value} <small>{unit}</small></p><div className="metric-detail">{detail}</div>{children}</article>
}
function FoodSummary({data,day,onFood}: {data:Snapshot;day:string;onFood:()=>void}) {
  const today=data.food_logs.filter(r=>r.day===day)
  const energy=foodTotals(today,'kcal')
  const recent=data.food_logs.filter(r=>String(r.day)<=day).sort((a,b)=>String(b.day).localeCompare(String(a.day))||String(b.created_at).localeCompare(String(a.created_at))).slice(0,5)
  const mealLine=(r:Row)=>{
    const value=foodValue(r,'kcal')
    return <li key={String(r.id)}><span>{r.name}</span><b>{value===null?'ไม่ทราบ':number(value)+' กิโลแคลอรี'}</b></li>
  }
  return <section className="detail-panel food-panel"><div className="dash-section-head"><h2>อาหารวันนี้</h2><button className="dash-link" onClick={onFood}>บันทึกอาหาร <DashIcon name="arrow"/></button></div>
    {today.length ? <><p>พลังงานที่ทราบรวม {energy.known?number(energy.sum)+' กิโลแคลอรี':'ยังไม่ทราบ'}{energy.missing?' · ไม่ทราบ '+energy.missing+' รายการ':''}</p>
      {[...meals,['','ไม่ระบุมื้อ']].map(([id,title])=>{const rows=today.filter(r=>(r.meal??'')===id)
        return rows.length>0 && <div key={id}><h3>{title}</h3><ul>{rows.map(mealLine)}</ul></div>})}</> : <p className="muted">ยังไม่มีอาหารที่บันทึกวันนี้</p>}
    <h3>ประวัติอาหารล่าสุด</h3>{recent.length ? <ul>{recent.map(r=><li key={String(r.id)}><span>{r.name}</span><small>{shortDate(String(r.day))}</small></li>)}</ul>:<p className="muted">ยังไม่มีประวัติอาหาร</p>}
  </section>
}

type OverviewProps = { data:Snapshot; day:string; known:number; missing:number; calories:number; goal:number; stepGoal:number; steps?:Row; weight?:number; measured:boolean; waist?:Row; xp:number; level:number; sleepMinutes?:number; onTab:(index:number)=>void }
export function DesktopDashboard({data,day,known,missing,calories,goal,stepGoal,steps,weight,measured,waist,xp,level,sleepMinutes,onTab}:OverviewProps) {
  const start=data.profiles[0]?.initial_weight, target=data.app_settings[0]?.target_weight
  const currentStreak=useMemo(()=>streaks(data,day).current,[data,day])
  const percent = start && target && weight ? goalProgress(Number(start),weight,Number(target)):null
  const remaining = known && !missing ? Math.max(0,goal-calories):null
  return <div className="overview-grid">
    <section className="metric-grid-wide" aria-label="สรุปสุขภาพวันนี้">
      <Metric icon="flame" title="พลังงานที่กินวันนี้" value={known?number(calories):'—'} unit="กิโลแคลอรี" accent="primary-metric"
        detail={missing?'ไม่ทราบพลังงาน '+missing+' รายการ':'เป้าหมาย '+number(goal)+' กิโลแคลอรี'}><progress aria-label="พลังงานที่บันทึกเทียบเป้าหมาย" max={goal} value={Math.min(calories,goal)}/></Metric>
      <Metric icon="target" title="พลังงานที่เหลือ" value={remaining===null?'—':number(remaining)} unit="กิโลแคลอรี"
        detail={missing?'ข้อมูลพลังงานยังไม่ครบ':!known?'ยังไม่มีบันทึกอาหาร':calories>goal?'เกินเป้า '+number(calories-goal)+' กิโลแคลอรี':'จากเป้าหมายประจำวัน'}/>
      <Metric icon="steps" title="ก้าวเดินวันนี้" value={steps?number(Number(steps.steps)):'—'} unit="ก้าว" detail={'เป้าหมาย '+number(stepGoal)+' ก้าว'} accent="mint-metric"/>
      <Metric icon="weight" title="น้ำหนักล่าสุด" value={weight===undefined?'—':number(weight)} unit="กก." detail={measured?'จากการชั่งครั้งล่าสุด':weight?'น้ำหนักตั้งต้นในโปรไฟล์':'ยังไม่มีบันทึกน้ำหนัก'}/>
      <Metric icon="waist" title="รอบเอวล่าสุด" value={waist?number(Number(waist.cm)):'—'} unit="ซม." detail={waist?'วัดเมื่อ '+shortDate(String(waist.day)):'ยังไม่มีบันทึกรอบเอว'}/>
      <Metric icon="level" title="เลเวลและคะแนน" value={String(level)} unit="เลเวล" detail={number(xp)+' XP สะสม'}/>
      <Metric icon="sleep" title="การนอนเมื่อคืน" value={sleepMinutes===undefined?'—':number(sleepMinutes/60)} unit="ชม." detail={sleepMinutes===undefined?'ยังไม่มีบันทึกเมื่อคืน':'รวมช่วงนอนที่บันทึก'}/>
      <Metric icon="streak" title="กิจกรรมต่อเนื่อง" value={number(currentStreak)} unit="วัน" detail="ภารกิจหรือถึงเป้าก้าว"/>
    </section>
    <Trends {...{data,day}}/>
    <div className="calendar-panel"><Calendar {...{data,day}}/></div>
    <div className="detail-stack"><section className="detail-panel"><div className="dash-section-head"><h2>เป้าหมายน้ำหนัก</h2><button className="dash-link" onClick={()=>onTab(4)}>แก้ไขเป้าหมาย <DashIcon name="arrow"/></button></div>
      <div className="goal-grid">{[['เริ่มต้น',start],['ปัจจุบัน',weight],['เป้าหมาย',target]].map(([label,v])=><div key={label}><small>{label}</small><b>{v?number(Number(v)):'—'} <small>กก.</small></b></div>)}</div>
      {percent!==null ? <><progress value={percent} max={100} aria-label="ความคืบหน้าสู่เป้าหมายน้ำหนัก"/><p>{Number(start)>=weight!?'ลดลง ':'เพิ่มขึ้น '}{number(Math.abs(Number(start)-weight!))} กก. · ความคืบหน้า {number(percent)}%</p></> : <p className="muted">ตั้งค่าโปรไฟล์และน้ำหนักเป้าหมายเพื่อดูความคืบหน้า</p>}
    </section><FoodSummary {...{data,day}} onFood={()=>onTab(1)}/></div>
  </div>
}
