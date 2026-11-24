import test from 'node:test'
import assert from 'node:assert/strict'
import {DatabaseSync} from 'node:sqlite'
import {migrate,Repository} from '../src/repository.ts'
import {LocalSync} from '../src/sync.ts'

test('Demo transport: offline replay, ownership, expired session, conflict choice, tombstone and acknowledgements',async()=>{
  const sqlite=new DatabaseSync(':memory:')
  const db={query:async(s,v=[])=>sqlite.prepare(s).all(...v),write:async commands=>{
    sqlite.exec('BEGIN')
    try{for(const c of commands)sqlite.prepare(c.statement).run(...c.values);sqlite.exec('COMMIT')}
    catch(e){sqlite.exec('ROLLBACK');throw e}
  }}
  try{
    await migrate(db)
    const repo=new Repository(db), queue=new LocalSync(db)
    await repo.save('weight_logs',{day:'2025-01-01',kg:70},'demo')
    await repo.save('weight_logs',{day:'2025-01-01',kg:71},'demo')
    let account='demo-A', mode='serverError', calls=[]
    const transport={owner:async()=>account, apply:async(owner,op)=>{
      calls.push(op)
      if(mode==='serverError')throw Error('503')
      return {kind:mode,owner,operationId:op.operationId,revision:'server-2'}
    }}
    assert.equal(await queue.sendOne(transport,true),'disabled')
    await queue.bindAfterConsent(account)
    assert.equal(await queue.sendOne(transport,false),'offline')
    account='demo-B';await assert.rejects(queue.bindAfterConsent(account))
    assert.equal(await queue.sendOne(transport,true),'disabled')
    account=null;assert.equal(await queue.sendOne(transport,true),'disabled')
    account='demo-A';await assert.rejects(queue.sendOne(transport,true),/503/)
    assert.equal((await queue.status()).last_ack,null)
    mode='conflict'
    assert.equal(await queue.sendOne(transport,true),'conflict')
    assert.deepEqual(calls[0],calls[1])
    assert.equal(await queue.sendOne(transport,true),'idle')
    await queue.keepLocal(calls[0].operationId,account)
    mode='accepted'
    assert.equal(await queue.sendOne(transport,true),'accepted')
    assert.equal(calls.at(-1).baseRevision,'server-2')
    assert.notEqual(calls.at(-1).operationId,calls[0].operationId)
    assert.equal(await queue.sendOne(transport,true),'accepted')
    await repo.remove('weight_logs','demo')
    await queue.disable();assert.equal(await queue.sendOne(transport,true),'disabled')
    await queue.bindAfterConsent(account);assert.equal(await queue.sendOne(transport,true),'accepted')
    assert.equal(calls.at(-1).record,null)
    assert.equal((await queue.status()).pending,0)
    await repo.exercise('2025-01-01','Demo',120,'demo-mission')
    await repo.exercise('2025-01-01','Demo',120,'demo-mission')
    await repo.steps('2025-01-01',5000,'health_connect')
    assert.equal((await queue.status()).pending,2)
    const [xp]=await db.query("SELECT payload FROM sync_queue WHERE entity='xp_events'")
    assert.equal(JSON.parse(xp.payload).points,15)
    await repo.saveMeal({day:'2025-01-01',name:'Demo',base_grams:100,photo:'data:image/jpeg;base64,AA=='})
    const [meal]=await db.query("SELECT payload FROM sync_queue WHERE entity='food_logs'")
    assert.equal('photo' in JSON.parse(meal.payload),false)
  }finally{sqlite.close()}
})
