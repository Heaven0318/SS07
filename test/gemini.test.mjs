import test from 'node:test';
import assert from 'node:assert/strict';
import { callProvider } from '../server/provider.mjs';
import { settings,loadKnowledge } from '../server/config.mjs';
test('Gemini adapter confines secrets to headers, keeps trusted knowledge separate and filters output',async()=>{
  const config=settings({GEMINI_API_KEY:'test-only-gemini-secret'});
  assert.equal(config.provider,'gemini');
  assert.equal(settings({OPENAI_API_KEY:'old-paid-key'}).key,'');
  const reply=await callProvider(config,loadKnowledge(),[{role:'user',content:'Tell me about projects'},{role:'assistant',content:'Previous answer'},{role:'user',content:'Which one?'}],async(url,options)=>{
    assert.ok(!url.includes(config.key));assert.equal(options.headers['x-goog-api-key'],config.key);
    const body=JSON.parse(options.body);assert.ok(!options.body.includes(config.key));assert.match(body.systemInstruction.parts[0].text,/trusted backend knowledge/);assert.equal(body.contents[1].role,'model');assert.equal(body.generationConfig.thinkingConfig.thinkingBudget,0);
    return Response.json({candidates:[{finishReason:'STOP',content:{parts:[{text:JSON.stringify({answer:'Synthetic test answer',navigationIds:['projects','unapproved']})}]}}],usageMetadata:{totalTokenCount:33}});
  });
  assert.equal(reply.tokens,33);assert.deepEqual(reply.navigationIds,['projects']);
  await assert.rejects(()=>callProvider(config,loadKnowledge(),[{role:'user',content:'hi'}],async()=>new Response('{}',{status:429})),e=>e.code==='provider_limit');
  await assert.rejects(()=>callProvider(config,loadKnowledge(),[{role:'user',content:'hi'}],async()=>Response.json({candidates:[{finishReason:'MAX_TOKENS'}]})),e=>e.code==='incomplete_response');
});
