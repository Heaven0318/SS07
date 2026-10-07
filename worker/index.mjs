import { callProvider, instructions, MAX_OUTPUT_TOKENS } from '../server/provider.mjs';
import { validate } from '../server/validation.mjs';
import { reserve, release } from './limits.mjs';
// The build inserts approved assets and trusted knowledge here, never secrets.
const assets = __SS07_ASSETS__;
const knowledge = __SS07_KNOWLEDGE__;
const origin = __SS07_ORIGIN__;
const fail = (status,code,message) => Object.assign(Error(message),{status,code});
export function configFrom(env) {
  const num = (key,fallback,max) => { const n=Number(env[key]||fallback); if(!Number.isInteger(n)||n<1||n>max) throw Error('Invalid configuration'); return n; };
  const hosts=(env.HOST_ORIGINS||origin).split(',').map(x=>x.trim());
  if(hosts.some(x=>{try {return new URL(x).origin!==x||!x.startsWith('https://');}catch{return true;}})) throw Error('Invalid host origins');
  const provider=env.AI_PROVIDER||'gemini';if(!['gemini','openai'].includes(provider))throw Error('Invalid provider');
  return {hosts,provider,key:(provider==='gemini'?env.GEMINI_API_KEY:env.OPENAI_API_KEY)||'',secret:env.IP_HASH_SECRET||'',model:provider==='gemini'?env.GEMINI_MODEL||'gemini-2.5-flash-lite':env.OPENAI_MODEL||'gpt-4.1-mini',rate:num('RATE_PER_MINUTE',6,1000),globalRate:num('GLOBAL_PER_MINUTE',30,10000),dailyRequests:num('DAILY_REQUEST_CAP',100,100000),dailyTokens:num('DAILY_TOKEN_BUDGET',200000,100000000),concurrent:num('MAX_CONCURRENT',3,100),timeout:num('PROVIDER_TIMEOUT_MS',25000,60000)};
}
export async function readBody(request) {
  if(!/^application\/json(?:;|$)/i.test(request.headers.get('content-type')||'')) throw fail(415,'content_type','Use application/json.');
  if(Number(request.headers.get('content-length'))>65536) throw fail(413,'request_size','Request is too large.');
  const reader=request.body?.getReader(); if(!reader) throw fail(400,'invalid_json','Send a JSON request.');
  let size=0;const chunks=[];
  try { while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>65536){await reader.cancel();throw fail(413,'request_size','Request is too large.');}chunks.push(value);} }
  finally { reader.releaseLock(); }
  const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
  try {return JSON.parse(new TextDecoder().decode(bytes));}catch {throw fail(400,'invalid_json','Request must be valid JSON.');}
}
export default {
  async fetch(request,env) {
    const id=crypto.randomUUID(),started=Date.now();let config;
    const headers=new Headers({'X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','Permissions-Policy':'camera=(), microphone=(), geolocation=()','Cache-Control':'no-store'});
    const json=(status,value)=>new Response(JSON.stringify(value),{status,headers:new Headers([...headers,['Content-Type','application/json; charset=utf-8']])});
    try {
      config=configFrom(env);
      headers.set('Content-Security-Policy',`default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self' data:; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors ${config.hosts.join(' ')}; frame-src 'self'`);
      const path=new URL(request.url).pathname,reqOrigin=request.headers.get('origin');
      if(reqOrigin===origin){headers.set('Access-Control-Allow-Origin',origin);headers.set('Vary','Origin');}
      if(path.startsWith('/api/')) {
        if(reqOrigin&&reqOrigin!==origin) throw fail(403,'origin_denied','Origin is not allowed.');
        if(request.method==='OPTIONS'){headers.set('Access-Control-Allow-Methods','GET, POST');headers.set('Access-Control-Allow-Headers','Content-Type');return new Response(null,{status:204,headers});}
        const ready=Boolean(config.key&&config.secret.length>=32&&env.DB);
        if(path==='/api/status'&&request.method==='GET')return json(200,{available:ready,message:ready?'Ready':'SS07 is unavailable: server credentials or usage storage are not configured.'});
        if(path==='/api/config'&&request.method==='GET')return json(200,{sample:knowledge.sample,navigation:knowledge.navigation,hostOrigins:config.hosts,links:[...knowledge.projects,knowledge.contact].filter(x=>x.url).map(x=>({label:x.name||'Contact',url:x.url}))});
        if(path!=='/api/chat'||request.method!=='POST')throw fail(404,'not_found','Not found.');
        const messages=validate(await readBody(request));
        if(!ready)throw fail(503,'not_configured','SS07 is unavailable because its server configuration is incomplete. Please use the contact section.');
        const tokens=new TextEncoder().encode(instructions(knowledge)+JSON.stringify(messages)).length+MAX_OUTPUT_TOKENS+2048;
        const day=await reserve(env.DB,config,(request.headers.get('cf-connecting-ip')||'unknown').slice(0,100),tokens,id);
        let actual=0;
        try {
          const reply=await callProvider(config,knowledge,messages,undefined,request.signal);actual=reply.tokens;
          console.log(JSON.stringify({requestId:id,event:'chat',status:200,durationMs:Date.now()-started,tokens:actual}));
          return json(200,{answer:reply.answer,navigationIds:reply.navigationIds,contextLimited:messages.length>=11});
        } finally {await release(env.DB,id,day,actual);}
      }
      if(!['GET','HEAD'].includes(request.method))throw fail(405,'method','Method not allowed.');
      const asset=assets[path];if(!asset)throw fail(404,'not_found','Not found.');
      headers.set('Content-Type',asset.type+'; charset=utf-8');headers.set('Cache-Control','no-cache');
      return new Response(request.method==='HEAD'?null:asset.body,{headers});
    } catch(error) {
      const code=['AbortError','TimeoutError'].includes(error.name)?'timeout':error.code||'internal';const status=error.status||(code==='timeout'?504:500);
      if(error.retry)headers.set('Retry-After',String(error.retry));
      console.log(JSON.stringify({requestId:id,event:'request_error',status,code,durationMs:Date.now()-started}));
      return json(status,{error:{code,message:error.status?error.message:code==='timeout'?'SS07 took too long to reply. Please retry.':'SS07 is temporarily unavailable. Please retry later.'},requestId:id});
    }
  }
};
