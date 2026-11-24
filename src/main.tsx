import { createRoot } from 'react-dom/client'
import { App } from './App'
import { exportBackup } from './device'
import { dayKey } from './domain'
import { openRepository, MigrationFailure } from './database'
import './style.css'

const root = createRoot(document.getElementById('root')!)
root.render(<main className="loading">กำลังเปิดฐานข้อมูล LazyFit…</main>)
openRepository().then(
  (repo) => root.render(<App repo={repo} />),
  (error) => root.render(<main className="loading"><h1>เปิดฐานข้อมูลไม่ได้</h1><p>เก็บข้อมูลแอปเดิมไว้ แล้วลองเปิดใหม่</p>
    {error instanceof MigrationFailure && <button onClick={()=>void error.recover().then(json=>exportBackup(json,dayKey())).catch(()=>alert('ส่งออกไม่สำเร็จ ตรวจพื้นที่ว่างแล้วลองอีกครั้ง'))}>ส่งออกสำเนาก่อนอัปเกรด</button>}
    <button onClick={() => location.reload()}>ลองอีกครั้ง</button></main>),
)

