import { createRoot } from 'react-dom/client'
import { App } from './App'
import { openRepository } from './database'
import './style.css'

const root = createRoot(document.getElementById('root')!)
root.render(<main className="loading">กำลังเปิดฐานข้อมูล LazyFit…</main>)
openRepository().then(
  (repo) => root.render(<App repo={repo} />),
  () => root.render(<main className="loading"><h1>เปิดฐานข้อมูลไม่ได้</h1><button onClick={() => location.reload()}>ลองอีกครั้ง</button></main>),
)

