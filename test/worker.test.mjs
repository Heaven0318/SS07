import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { reserve,release } from '../worker/limits.mjs';
execFileSync(process.execPath,['scripts/build-worker.mjs']);
const {default:worker}=await import('../dist/server/index.js');
class D1 {
  constructor(){this.db=new DatabaseSync(':memory:');this.db.exec(readFileSync('drizzle/0000_steady_garia.sql','utf8'));}
  prepare(sql){return {bind:(...args)=>({sql,args})};}
  async batch(statements){this.db.exec('BEGIN IMMEDIATE');try{const result=statements.map(q=>({meta:this.db.prepare(q.sql).run(...q.args)}));this.db.exec('COMMIT');return result;}catch(e){this.db.exec('ROLLBACK');throw e;}}
}
const origin='https://ss07-portfolio-assistant.cedrickyosh-pereyra.chatgpt.site';
const request=(path,body,headers={})=>new Request(origin+path,{method:body===undefined?'GET':'POST',headers:{origin,'content-type':'application/json',...headers},body:body===undefined?undefined:JSON.stringify(body)});
test('Worker serves only approved assets and rejects origin, input and request-size violations',async()=>{
  const env={};
  assert.equal((await worker.fetch(request('/'),env)).status,200);
  for(const path of ['/.env','/knowledge.json','/server/provider.mjs','/db/schema.ts']) assert.equal((await worker.fetch(request(path),env)).status,404);
  assert.equal((await worker.fetch(request('/api/chat',{messages:[]},{origin:'https://evil.example'}),env)).status,403);
  assert.equal((await worker.fetch(request('/api/chat',{messages:[]}),env)).status,400);
  assert.equal((await worker.fetch(request('/api/chat',{messages:[{role:'user',content:'x'.repeat(4001)}]}),env)).status,400);
  assert.equal((await worker.fetch(request('/api/chat',{messages:[{role:'user',content:'x'.repeat(70000)}]}),env)).status,413);
  assert.equal((await worker.fetch(request('/api/chat',{messages:[{role:'user',content:'Hi'}]}),env)).status,503);
  assert.equal((await (await worker.fetch(request('/api/status'),env)).json()).available,false);
});
test('D1 reservations are atomic across simultaneous requests; failed cap checks roll back; leases expire',async()=>{
  const db=new D1(),config={secret:'x'.repeat(32),rate:10,globalRate:10,dailyRequests:2,dailyTokens:100,concurrent:2,timeout:25000};
  const now=Date.now();
  const results=await Promise.allSettled([1,2,3,4].map(i=>reserve(db,config,'ip',40,String(i),now)));
  assert.equal(results.filter(x=>x.status==='fulfilled').length,2);
  assert.deepEqual({...db.db.prepare('SELECT requests,reserved FROM ss07_daily').get()},{requests:2,reserved:80});
  assert.equal(db.db.prepare('SELECT count FROM ss07_rate WHERE subject=?').get('global').count,2);
  const accepted=results.findIndex(x=>x.status==='fulfilled');
  await release(db,String(accepted+1),results[accepted].value,17);
  assert.equal(db.db.prepare('SELECT actual FROM ss07_daily').get().actual,17);
  const tomorrow=now+86400000;
  await reserve(db,config,'ip',40,'new',tomorrow);
  assert.equal(db.db.prepare('SELECT COUNT(*) AS n FROM ss07_leases').get().n,1);
});
test('Worker provider flow uses trusted knowledge, filters navigation, records usage and releases leases',async()=>{
  const db=new D1(),env={DB:db,IP_HASH_SECRET:'x'.repeat(32),OPENAI_API_KEY:'test-only-provider-key'};
  const original=globalThis.fetch;
  globalThis.fetch=async(url,options)=>{
    assert.equal(url,'https://api.openai.com/v1/responses');const body=JSON.parse(options.body);assert.equal(body.store,false);assert.match(body.instructions,/Cedrick/);
    return Response.json({status:'completed',output:[{content:[{type:'output_text',text:JSON.stringify({answer:'Synthetic test reply',navigationIds:['about','evil']})}]}],usage:{total_tokens:29}});
  };
  try{
    const response=await worker.fetch(request('/api/chat',{messages:[{role:'user',content:'Tell me about the developer.'}]}),env);
    assert.equal(response.status,200);assert.deepEqual((await response.json()).navigationIds,['about']);
    assert.equal(db.db.prepare('SELECT actual FROM ss07_daily').get().actual,29);
    assert.equal(db.db.prepare('SELECT COUNT(*) AS n FROM ss07_leases').get().n,0);
    globalThis.fetch=async()=>new Response('private provider error',{status:401});
    assert.equal((await worker.fetch(request('/api/chat',{messages:[{role:'user',content:'Hello'}]}),env)).status,502);
    assert.equal(db.db.prepare('SELECT COUNT(*) AS n FROM ss07_leases').get().n,0);
  }finally{globalThis.fetch=original;}
  assert.ok(!readFileSync('dist/server/index.js','utf8').includes(env.OPENAI_API_KEY));
});
