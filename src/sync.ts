import type { Database } from './repository.ts'
import type { Row, Value } from './schema.ts'

export type Mutation = {operationId:string; entity:string; recordId:string; baseRevision:string|null; record:Row|null}
export type SyncReceipt = {kind:'accepted'|'conflict'; operationId:string; owner:string; revision:string}
// Implement only after an authenticated backend and its retention policy are configured.
// Server contract: authorize owner, deduplicate operationId, compare revision and commit atomically.
export interface SyncTransport {
  owner(): Promise<string|null>
  apply(owner:string, mutation:Mutation): Promise<SyncReceipt>
}
const sql=(statement:string,values: Value[]=[])=>({statement,values})

export class LocalSync {
  private db: Database
  constructor(db:Database){this.db=db}
  async bindAfterConsent(owner:string) {
    if (!owner.trim()) throw new Error('ต้องเข้าสู่ระบบก่อน')
    await this.db.write([sql('INSERT INTO sync_owner(singleton,owner,enabled) VALUES(1,?,1) ON CONFLICT(singleton) DO UPDATE SET enabled=1 WHERE owner=excluded.owner',[owner])])
    const [bound]=await this.db.query('SELECT owner FROM sync_owner')
    if(bound?.owner!==owner)throw new Error('ฐานข้อมูลนี้ผูกกับอีกบัญชีหนึ่ง')
  }
  async disable(){await this.db.write([sql('UPDATE sync_owner SET enabled=0')])}
  async status(){
    const [row]=await this.db.query(`SELECT COUNT(*) AS pending, COALESCE(SUM(status='conflict'),0) AS conflicts,
      (SELECT last_ack FROM sync_owner) AS last_ack FROM sync_queue`)
    return row
  }
  async sendOne(transport:SyncTransport,online:boolean) {
    if(!online)return 'offline'
    const owner=await transport.owner()
    const authorized=async()=>!!owner && !!(await this.db.query('SELECT 1 FROM sync_owner WHERE enabled=1 AND owner=?',[owner]))[0]
    if(!await authorized())return 'disabled'
    const [item]=await this.db.query(`SELECT * FROM sync_queue q WHERE status='pending' AND NOT EXISTS
      (SELECT 1 FROM sync_queue prior WHERE prior.seq<q.seq AND prior.entity=q.entity AND prior.record_id=q.record_id)
      ORDER BY seq LIMIT 1`)
    if(!item)return 'idle'
    await this.db.write([sql(`UPDATE sync_queue SET attempted=1, base_revision=(SELECT revision FROM sync_heads
      WHERE entity=sync_queue.entity AND record_id=sync_queue.record_id) WHERE seq=? AND attempted=0`,[item.seq])])
    const [op]=await this.db.query('SELECT * FROM sync_queue WHERE seq=? AND status=\'pending\'',[item.seq])
    if(!op || await transport.owner()!==owner || !await authorized())return 'disabled'
    const receipt=await transport.apply(owner!,{operationId:String(op.operation_id),entity:String(op.entity),recordId:String(op.record_id),
      baseRevision:op.base_revision as string|null,record:op.payload===null?null:JSON.parse(String(op.payload))})
    if(receipt.owner!==owner || receipt.operationId!==op.operation_id || !receipt.revision ||
      !['accepted','conflict'].includes(receipt.kind))throw new Error('เซิร์ฟเวอร์ยังไม่ยืนยันรายการ')
    if(await transport.owner()!==owner || !await authorized())return 'disabled'
    if(receipt.kind==='conflict'){
      await this.db.write([sql("UPDATE sync_queue SET status='conflict',remote_revision=? WHERE seq=?",[receipt.revision,op.seq])])
      return 'conflict'
    }
    await this.db.write([sql(`INSERT INTO sync_heads SELECT entity,record_id,? FROM sync_queue WHERE seq=?
        ON CONFLICT(entity,record_id) DO UPDATE SET revision=excluded.revision`,[receipt.revision,op.seq]),
      sql('DELETE FROM sync_queue WHERE seq=?',[op.seq]),
      sql('UPDATE sync_owner SET last_ack=? WHERE enabled=1 AND owner=?',[new Date().toISOString(),owner])])
    return 'accepted'
  }

  // Only replay this edit after showing both revisions and receiving an explicit choice.
  async keepLocal(operationId:string,owner:string) {
    await this.db.write([sql(`UPDATE sync_queue SET status='pending',base_revision=remote_revision,remote_revision=NULL,
      operation_id=lower(hex(randomblob(16))) WHERE operation_id=? AND status='conflict'
      AND EXISTS (SELECT 1 FROM sync_owner WHERE enabled=1 AND owner=?)`,[operationId,owner])])
  }
}
