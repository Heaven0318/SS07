// Behavioral unit tests of the actual browser scripts with a minimal DOM.
// Real browser layout/keyboard checks are recorded separately in VERIFICATION.md.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
class Element {
  constructor(tag='div') { this.tagName=tag;this.children=[];this.style={};this.dataset={};this.attrs={};this.value='';this.hidden=false;this.disabled=false;this.scrollTop=0;this.scrollHeight=100;this.clientHeight=100;this.listeners={};this.className='';this.textContent=''; }
  append(...items){for(const x of items){x.parentElement=this;this.children.push(x);}}
  get childNodes(){return this.children;}
  replaceChildren(...items){this.children=[];this.append(...items);}
  setAttribute(k,v){this.attrs[k]=v;} hasAttribute(k){return Object.hasOwn(this.attrs,k);} removeAttribute(k){delete this.attrs[k];}
  addEventListener(k,fn){this.listeners[k]=fn;} focus(){this.focused=true;} remove(){if(this.parentElement)this.parentElement.children=this.parentElement.children.filter(x=>x!==this);}
  attachShadow(){return this.shadowRoot=new Element();} scrollIntoView(){this.scrolled=true;} getClientRects(){return this.hidden?[]:[{}];}
}
const flush=()=>new Promise(r=>setImmediate(r));
function widget(chatFetch) {
  const ids=Object.fromEntries(['panel','reset','close','availability','messages','suggestions','browse','browse-actions','latest','error','error-text','retry','composer','input','send','counter','announce'].map(id=>[id,new Element()]));
  const doc={getElementById:id=>ids[id],createElement:tag=>new Element(tag),documentElement:new Element(),addEventListener(){},querySelectorAll:()=>[]};
  const events={}, sent=[], parent={postMessage:(data,origin)=>sent.push({data,origin})};
  const config={hostOrigins:['https://host.example'],sample:true,navigation:[{id:'about',label:'About'}],links:[]};
  const context=vm.createContext({document:doc,location:{search:'?hostOrigin=https%3A%2F%2Fhost.example'},parent,window:{addEventListener:(type,fn)=>events[type]=fn},URL,URLSearchParams,AbortController,AbortSignal,matchMedia:()=>({matches:true}),fetch:(path,opts)=>path==='/api/config'?Promise.resolve(new Response(JSON.stringify(config))):path==='/api/status'?Promise.resolve(new Response(JSON.stringify({available:true,message:'Ready'}))):chatFetch(path,opts)});
  vm.runInContext(readFileSync(new URL('../public/widget.js',import.meta.url),'utf8'),context);
  return {ids,doc,events,parent,sent,context,config};
}
const response=(answer='TEST FIXTURE',navigationIds=[])=>new Response(JSON.stringify({answer,navigationIds}));
const clickSend=(w,text)=>{w.ids.input.value=text;w.ids.send.onclick();};
test('empty and duplicate sends blocked; Retry does not duplicate visitor message',async()=>{
  let calls=0,release;
  const w=widget(()=>{calls++;return new Promise(r=>release=r);});await flush();
  clickSend(w,'  ');assert.equal(calls,0);
  clickSend(w,'A question');clickSend(w,'duplicate');assert.equal(calls,1);
  release(new Response(JSON.stringify({error:{message:'Test failure'}}),{status:502}));await flush();
  assert.equal(w.ids.error.hidden,false);assert.equal(w.ids.messages.children.filter(x=>x.className==='message user').length,1);
  w.ids.retry.onclick();assert.equal(calls,2);release(response());await flush();
  assert.equal(w.ids.messages.children.filter(x=>x.className==='message user').length,1);
  assert.equal(w.ids.error.hidden,true);
});
test('Start Over aborts and ignores old reply even if transport completes',async()=>{
  let release,signal;
  const w=widget((_,opts)=>{signal=opts.signal;return new Promise(r=>release=r);});await flush();
  clickSend(w,'Old question');w.ids.reset.onclick();assert.equal(signal.aborted,true);
  release(response('Stale reply'));await flush();
  assert.equal(w.ids.messages.children.length,1);assert.ok(!JSON.stringify(w.ids.messages.children[0].children.map(x=>x.textContent)).includes('Stale reply'));
});
test('follow-ups bounded to complete recent pairs and safe plain text rendering',async()=>{
  const payloads=[];const w=widget((_,opts)=>{payloads.push(JSON.parse(opts.body));return Promise.resolve(response('<script>alert(1)</script>'));});await flush();
  for(let i=0;i<8;i++){clickSend(w,'Question '+i);await flush();}
  assert.equal(payloads.at(-1).messages.length,11);assert.equal(payloads.at(-1).messages[0].role,'user');
  const last=w.ids.messages.children.at(-1);assert.equal(last.children[1].textContent,'<script>alert(1)</script>');assert.equal(last.children[1].children.length,0);
  assert.equal(w.ids.availability.hidden,false);
});
test('widget rejects wrong origin/window/payload and applies host theme immediately',async()=>{
  const w=widget(()=>Promise.resolve(response()));await flush();
  const init={channel:'ss07',type:'init',token:'test-token',theme:'light',open:true,navigationIds:['about','evil']};
  const emit=(origin,source,data)=>w.events.message({origin,source,data});
  emit('https://evil.example',w.parent,init);assert.equal(w.doc.documentElement.dataset.theme,'dark');
  emit('https://host.example',{},init);assert.equal(w.ids['browse-actions'].children.length,0);
  emit('https://host.example',w.parent,{...init,open:'yes'});assert.equal(w.ids['browse-actions'].children.length,0);
  emit('https://host.example',w.parent,init);assert.equal(w.doc.documentElement.dataset.theme,'light');assert.equal(w.ids['browse-actions'].children.length,1);
  emit('https://host.example',w.parent,{channel:'ss07',type:'theme',token:'wrong',theme:'dark'});assert.equal(w.doc.documentElement.dataset.theme,'light');
  emit('https://host.example',w.parent,{channel:'ss07',type:'theme',token:'test-token',theme:'dark'});assert.equal(w.doc.documentElement.dataset.theme,'dark');
  w.ids['browse-actions'].children[0].onclick();assert.equal(w.sent.at(-1).data.id,'about');assert.equal(w.sent.at(-1).origin,'https://host.example');
});
test('reading earlier messages is not interrupted; Jump to latest restores scrolling',async()=>{
  const w=widget(()=>Promise.resolve(response('Latest response')));await flush();
  w.ids.messages.scrollHeight=1500;w.ids.messages.clientHeight=300;w.ids.messages.scrollTop=100;
  w.ids.messages.listeners.scroll();clickSend(w,'Follow-up');await flush();
  assert.equal(w.ids.messages.scrollTop,100);assert.equal(w.ids.latest.hidden,false);
  w.ids.latest.onclick();assert.equal(w.ids.messages.scrollTop,1500);assert.equal(w.ids.latest.hidden,true);
});
test('loader restricts navigation, sender and token; hidden iframe has no hit area',()=>{
  const body=new Element(),section=new Element(),events={},posted=[];
  const doc={body,documentElement:{clientWidth:1200},currentScript:{src:'https://ss07.example/loader.js'},createElement:tag=>{const e=new Element(tag);if(tag==='iframe')e.contentWindow={postMessage:(m,o)=>posted.push({m,o})};return e;},getElementById:id=>id==='about'?section:null,addEventListener(){}};
  const win={innerHeight:900,SS07_CONFIG:{theme:'light',navigation:{about:'#about',unsafe:'javascript:alert(1)'}},addEventListener:(t,fn)=>events[t]=fn};
  const ctx=vm.createContext({window:win,document:doc,crypto:{randomUUID:()=> 'nonce'},URL,location:{origin:'https://host.example'},matchMedia:()=>({matches:false,addEventListener(){}}),setTimeout:()=>1,clearTimeout(){}});
  vm.runInContext(readFileSync(new URL('../public/loader.js',import.meta.url),'utf8'),ctx);
  const shadow=body.children[0].shadowRoot,launcher=shadow.children[1],frame=shadow.children[2];
  const emit=(data,origin='https://ss07.example',source=frame.contentWindow)=>events.message({data,origin,source});
  win.SS07.open();emit({channel:'ss07',type:'ready'});assert.equal(frame.style.display,'block');assert.equal(posted[0].o,'https://ss07.example');
  const nav=id=>({channel:'ss07',type:'navigate',token:'nonce',id});
  emit(nav('about'),'https://evil.example');emit(nav('about'),'https://ss07.example',{});emit({...nav('about'),token:'wrong'});emit(nav('unknown'));emit(nav('unsafe'));assert.equal(section.scrolled,undefined);
  emit(nav('about'));assert.equal(section.scrolled,true);assert.equal(frame.style.display,'none');assert.equal(section.focused,true);
  win.SS07.open();emit({channel:'ss07',type:'close',token:'nonce'});assert.equal(launcher.focused,true);assert.equal(frame.style.display,'none');
  assert.throws(()=>win.SS07.setTheme('invalid'));win.SS07.setTheme('dark');assert.equal(posted.at(-1).m.theme,'dark');
});
