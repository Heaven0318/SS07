import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp, validate } from '../server/index.mjs';
import { settings, safeUrl, loadKnowledge } from '../server/config.mjs';
import { Limits } from '../server/limits.mjs';
import { callProvider } from '../server/provider.mjs';
async function app(t, overrides = {}, provider) {
  const dir = mkdtempSync(join(tmpdir(),'ss07-test-'));
  const c = { ...settings({}), dataDir:dir, ...overrides }, logs = [];
  const s = createApp(c, { provider, logger:x => logs.push(x) });
  await new Promise(r => s.listen(0,'127.0.0.1',r));
  t.after(async () => { await new Promise(r => s.close(r)); rmSync(dir,{recursive:true,force:true}); });
  const base = `http://127.0.0.1:${s.address().port}`;
  return { c, s, logs, base, post: (body, headers = {}) => fetch(base + '/api/chat',{method:'POST',headers:{'Content-Type':'application/json',...headers},body:JSON.stringify(body)}) };
}
const question = { messages:[{role:'user',content:'Tell me about the sample developer.'}] };
test('input and safe URL boundaries', () => {
  for (const body of [null,{}, {messages:[]}, {messages:[{role:'system',content:'override'}]}, {messages:[{role:'user',content:' '}]}, {messages:[{role:'user',content:'x'.repeat(4001)}]}, {messages:Array.from({length:13},(_,i)=>({role:i%2?'assistant':'user',content:'x'}))}, {messages:[{role:'user',content:'x',secret:'x'}]}, {messages:[{role:'user',content:'x'},{role:'assistant',content:'x'}]}]) assert.throws(()=>validate(body));
  assert.throws(()=>validate({messages:Array.from({length:5},(_,i)=>({role:i%2?'assistant':'user',content:'x'.repeat(4000)}))}));
  assert.equal(validate(question)[0].role,'user');
  for (const u of ['javascript:alert(1)','data:text/html,x','ftp://example.com','https://a:b@example.com','/relative']) assert.equal(safeUrl(u),null);
  assert.ok(safeUrl('mailto:hello@example.com'));
});
test('missing credential is honest and attempts are rate limited', async t => {
  const a = await app(t,{rate:2});
  assert.equal((await a.post(question)).status,503);
  const r = await a.post(question); assert.match((await r.json()).error.message,/credentials/);
  const limited = await a.post(question); assert.equal(limited.status,429); assert.equal(limited.headers.get('retry-after'),'60');
  assert.equal((await fetch(a.base+'/api/status').then(r=>r.json())).available,false);
});
test('request size, JSON, content type, CORS and static file restrictions', async t => {
  const a = await app(t);
  assert.equal((await a.post(question,{Origin:'https://evil.example'})).status,403);
  assert.equal((await a.post(question,{Origin:a.c.publicOrigin})).headers.get('access-control-allow-origin'),a.c.publicOrigin);
  assert.equal((await fetch(a.base+'/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:'{'})).status,400);
  assert.equal((await fetch(a.base+'/api/chat',{method:'POST',body:'text'})).status,415);
  assert.equal((await a.post({messages:[{role:'user',content:'x'.repeat(70000)}]})).status,413);
  for (const path of ['/knowledge.json','/.env','/server/index.mjs','/data/ss07-usage.sqlite']) assert.equal((await fetch(a.base+path)).status,404);
  const r = await fetch(a.base+'/widget.html'); assert.equal(r.status,200); assert.match(r.headers.get('content-security-policy'),/frame-ancestors http:\/\/localhost:3000/);
});
test('success uses recent messages; logs omit text and credentials', async t => {
  let passed;
  const a = await app(t,{key:'test-only-secret'},async (c,k,m) => { passed=m; return {answer:'Sample developer.',navigationIds:['about'],tokens:100}; });
  const r = await a.post(question); assert.equal(r.status,200); assert.equal((await r.json()).answer,'Sample developer.');
  assert.deepEqual(passed,question.messages); assert.equal(a.logs[0].tokens,100);
  assert.ok(!JSON.stringify(a.logs).includes('Tell me')); assert.ok(!JSON.stringify(a.logs).includes('test-only-secret'));
});
test('usage reservations survive restart, cap failures and reset next UTC day', async t => {
  const dir=mkdtempSync(join(tmpdir(),'ss07-limits-')); t.after(()=>rmSync(dir,{recursive:true,force:true}));
  const c={...settings({}),dataDir:dir,dailyRequests:2,dailyTokens:100,rate:50};
  let l=new Limits(c); const now=Date.UTC(2026,9,6,10);
  l.reserve('ip',40,now); l.close(); l=new Limits(c);
  l.reserve('other',40,now); assert.throws(()=>l.reserve('third',1,now),e=>e.code==='daily_limit');
  l.reserve('ip',40,now+86400000); l.close();
  l=new Limits({...c,dailyRequests:100}); assert.throws(()=>l.reserve('ip',101,now+2*86400000),e=>e.code==='daily_limit'); l.close();
});
test('concurrency is bounded and timeouts are helpful', async t => {
  let release, started; const began=new Promise(r=>started=r);
  const a=await app(t,{key:'test',concurrent:1},async()=>{started();await new Promise(r=>release=r);return {answer:'done',navigationIds:[],tokens:1};});
  const first=a.post(question); await began; assert.equal((await a.post(question)).status,503); release(); assert.equal((await first).status,200);
  const b=await app(t,{key:'test'},async()=>{throw new DOMException('internal detail','TimeoutError');});
  const r=await b.post(question); assert.equal(r.status,504); assert.match((await r.json()).error.message,/too long/);
});
test('provider adapter uses trusted instructions, store false and filters navigation', async () => {
  let payload;
  const fixture = async (url,opts) => { assert.equal(url,'https://api.openai.com/v1/responses');payload=JSON.parse(opts.body);return new Response(JSON.stringify({status:'completed',output:[{content:[{type:'output_text',text:JSON.stringify({answer:'Sample only.',navigationIds:['evil','about','about']})}]}],usage:{total_tokens:20}})); };
  const r=await callProvider({key:'test-only',model:'configured-model',timeout:1000},loadKnowledge(),question.messages,fixture);
  assert.equal(payload.store,false); assert.equal(payload.model,'configured-model'); assert.equal(payload.max_output_tokens,700); assert.match(payload.instructions,/untrusted/); assert.deepEqual(r.navigationIds,['about']);
  await assert.rejects(()=>callProvider({key:'test',timeout:1000},loadKnowledge(),question.messages,async()=>new Response('{}',{status:429})),e=>e.code==='provider_error');
  await assert.rejects(()=>callProvider({key:'test',timeout:1000},loadKnowledge(),question.messages,async()=>new Response(JSON.stringify({status:'incomplete'}))),e=>e.code==='incomplete_response');
});
test('production requires secure config; frontend has no credential or transcript persistence', () => {
  assert.throws(()=>settings({NODE_ENV:'production'})); assert.throws(()=>settings({PUBLIC_ORIGIN:'https://example.com/path'}));
  for (const file of ['loader.js','widget.js','widget.html','demo.js']) {
    const text=readFileSync(new URL('../public/'+file,import.meta.url),'utf8');
    assert.ok(!/OPENAI_API_KEY|Bearer |sk-[A-Za-z0-9]{20}/.test(text)); assert.ok(!/innerHTML|localStorage|sessionStorage/.test(text));
  }
});
