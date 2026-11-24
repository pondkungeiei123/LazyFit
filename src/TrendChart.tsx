import { useEffect, useRef } from 'react'
import { Chart, LineController, LineElement, PointElement, LinearScale, Tooltip } from 'chart.js'
import type { Reading } from './dashboardData'
import { DashIcon } from './DashboardIcons'
import type { IconName } from './DashboardIcons'

Chart.register(LineController, LineElement, PointElement, LinearScale, Tooltip)
const days = (day:string) => Date.parse(day+'T00:00:00Z') / 86400000
const label = new Intl.DateTimeFormat('th-TH',{day:'numeric',month:'short',timeZone:'UTC'})
const fmt = new Intl.NumberFormat('th-TH',{maximumFractionDigits:1})
export function TrendChart({title,unit,icon,readings,from,to,color}: {
  title:string; unit:string; icon:IconName; readings:Reading[]; from:string; to:string; color:string
}) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(()=>{
    if (!ref.current || !readings.length) return
    const chart = new Chart(ref.current,{
      type:'line',
      data:{datasets:[{label:title,data:readings.map(r=>({x:days(r.day),y:r.value})),
        borderColor:color,pointBackgroundColor:color,pointBorderColor:'#fff',pointBorderWidth:1,
        pointRadius:readings.length>45?2:4,pointHitRadius:8,borderWidth:2,
        segment:{borderColor:ctx=>Number(ctx.p1.parsed.x)-Number(ctx.p0.parsed.x)>1?'transparent':color}}]},
      options:{responsive:true,maintainAspectRatio:false,animation:false,locale:'th-TH',
        interaction:{mode:'nearest',intersect:false},
        scales:{x:{type:'linear',min:days(from)-(from===to?1:0),max:days(to)+(from===to?1:0),
          grid:{display:false},border:{display:false},ticks:{maxTicksLimit:3,precision:0,maxRotation:0,callback:v=>label.format(Number(v)*86400000)}},
          y:{grid:{color:'#e5ece7'},border:{display:false},ticks:{maxTicksLimit:3}}},
        plugins:{tooltip:{displayColors:false,callbacks:{title:items=>readings[items[0].dataIndex].day,
          label:item=>fmt.format(readings[item.dataIndex].value)+' '+unit,
          afterLabel:item=>readings[item.dataIndex].note??''}}}},
    })
    return ()=>chart.destroy()
  },[title,unit,readings,from,to,color])
  return <article className="trend-tile"><div className="trend-title"><span style={{color}}><DashIcon name={icon}/></span><h3>{title}</h3><small>{unit}</small></div>
    {readings.length ? <><div className="trend-canvas"><canvas ref={ref} role="img" aria-label={title+' '+from+' ถึง '+to}/></div>
      <details className="point-list"><summary>ดูค่าที่บันทึก ({readings.length})</summary>{readings.map(r=><p key={r.day}>{r.day} · {fmt.format(r.value)} {unit} {r.note}</p>)}</details></> :
      <div className="empty-plot"><span>ยังไม่มีข้อมูลในช่วงนี้</span></div>}
  </article>
}
