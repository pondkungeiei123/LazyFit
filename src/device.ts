import { Capacitor, registerPlugin } from '@capacitor/core'
import { Directory, Encoding, Filesystem } from '@capacitor/filesystem'
import type { SleepRecord } from './sleep'
import { Share } from '@capacitor/share'

export type Connection = 'web' | 'unavailable' | 'update_required' | 'permission_required' | 'granted'
const health = registerPlugin<{
  sleep(): Promise<{records:SleepRecord[]}>
  status(options:{kind:string}): Promise<{ state: Connection }>
  request(options:{kind:string}): Promise<{ state: Connection }>
  today(options: { day: string }): Promise<{ steps: number | null }>
}>('LazyHealth')

export async function connection(request = false, kind: 'steps'|'sleep' = 'steps'): Promise<Connection> {
  if (Capacitor.getPlatform() !== 'android') return 'web'
  return (await (request ? health.request({kind}) : health.status({kind}))).state
}

export const healthSleep = () => health.sleep()
export const healthSteps = (day: string) => health.today({ day })

export async function compressPhoto(file: File) {
  if (file.size > 30_000_000) throw new Error('เลือกรูปขนาดไม่เกิน 30 MB')
  const image = await createImageBitmap(file)
  try {
    const canvas = document.createElement('canvas')
    const scale = Math.min(1, 900 / Math.max(image.width, image.height))
    canvas.width = Math.max(1, Math.round(image.width * scale))
    canvas.height = Math.max(1, Math.round(image.height * scale))
    const context = canvas.getContext('2d')
    if (!context) throw new Error('เปิดรูปไม่สำเร็จ')
    context.fillStyle = '#fff'
    context.fillRect(0, 0, canvas.width, canvas.height)
    context.drawImage(image, 0, 0, canvas.width, canvas.height)
    const jpeg = canvas.toDataURL('image/jpeg', 0.72)
    if (jpeg.length > 700_000) throw new Error('บีบอัดรูปไม่สำเร็จ')
    return jpeg
  } finally { image.close() }
}

export async function exportBackup(content: string, day: string) {
  const name = `${day}.lazyfit-backup.json`
  if (Capacitor.getPlatform() === 'android') {
    const { uri } = await Filesystem.writeFile({ path: name, data: content, directory: Directory.Cache, encoding: Encoding.UTF8 })
    await Share.share({ title: 'สำรองข้อมูล LazyFit', files: [uri] })
    return
  }
  const url = URL.createObjectURL(new Blob([content], { type: 'application/json' }))
  const link = document.createElement('a')
  link.href = url
  link.download = name
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

