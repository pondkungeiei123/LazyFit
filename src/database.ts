import { Capacitor } from '@capacitor/core'
import { CapacitorSQLite, SQLiteConnection } from '@capacitor-community/sqlite'
import initSqlJs from 'sql.js'
import wasm from 'sql.js/dist/sql-wasm.wasm?url'
import { migrate, Repository } from './repository'
import type { Database } from './repository'
import type { Row } from './schema'

function openStorage(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('lazyfit-sqlite', 1)
    request.onupgradeneeded = () => request.result.createObjectStore('snapshots')
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

async function browserDb(): Promise<Database> {
  const storage = await openStorage()
  const SQL = await initSqlJs({ locateFile: () => wasm })
  const read = () => new Promise<Uint8Array | undefined>((resolve, reject) => {
    const request = storage.transaction('snapshots').objectStore('snapshots').get('main')
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
  return {
    async query(sql, values = []) {
      const db = new SQL.Database(await read())
      try {
        const stmt = db.prepare(sql, values)
        const rows = []
        while (stmt.step()) rows.push(stmt.getAsObject() as Row)
        stmt.free()
        return rows
      } finally { db.close() }
    },
    async write(commands) {
      await new Promise<void>((resolve, reject) => {
        const tx = storage.transaction('snapshots', 'readwrite')
        const store = tx.objectStore('snapshots')
        const request = store.get('main')
        let failure: unknown
        tx.oncomplete = () => resolve()
        tx.onabort = () => reject(failure ?? tx.error)
        request.onsuccess = () => {
          const db = new SQL.Database(request.result)
          try {
            for (const command of commands) db.run(command.statement, command.values)
            store.put(db.export(), 'main')
          } catch (error) {
            failure = error
            tx.abort()
          } finally { db.close() }
        }
      })
    },
  }
}

async function androidDb(): Promise<Database> {
  const sqlite = new SQLiteConnection(CapacitorSQLite)
  const db = await sqlite.createConnection('lazyfit', false, 'no-encryption', 1, false)
  await db.open()
  return {
    async query(sql, values) { return (await db.query(sql, values)).values ?? [] },
    async write(commands) { await db.executeSet(commands, true) },
  }
}

export async function openRepository() {
  const android = Capacitor.getPlatform() === 'android'
  const db = android ? await androidDb() : await browserDb()
  if (!android && navigator.locks) await navigator.locks.request('lazyfit-schema', () => migrate(db))
  else await migrate(db)
  return new Repository(db)
}


