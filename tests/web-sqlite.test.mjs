import test from 'node:test'
import assert from 'node:assert/strict'
import initSqlJs from 'sql.js'
import {migrate,Repository} from '../src/repository.ts'

test('Demo: offline browser SQLite/WASM save, reopen, edit and delete', async()=>{
  const SQL=await initSqlJs()
  let sqlite=new SQL.Database()
  const db={query:async(sql,values=[])=>{
    const stmt=sqlite.prepare(sql,values), rows=[]
    try{while(stmt.step())rows.push(stmt.getAsObject());return rows}finally{stmt.free()}
  }, write:async commands=>{
    sqlite.run('BEGIN')
    try{for(const cmd of commands)sqlite.run(cmd.statement,cmd.values);sqlite.run('COMMIT')}
    catch(e){sqlite.run('ROLLBACK');throw e}
  }}
  try{
    await migrate(db);const repo=new Repository(db)
    await repo.save('weight_logs',{day:'2026-01-01',kg:70},'demo')
    const bytes=sqlite.export();sqlite.close();sqlite=new SQL.Database(bytes)
    await migrate(db)
    assert.equal((await repo.snapshot()).weight_logs[0].kg,70)
    await repo.save('weight_logs',{day:'2026-01-01',kg:71},'demo')
    await repo.remove('weight_logs','demo')
    assert.equal((await repo.snapshot()).weight_logs.length,0)
    assert.equal((await repo.syncStatus()).pending,3)
  }finally{sqlite.close()}
})
