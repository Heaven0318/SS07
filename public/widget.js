'use strict';
const $ = id => document.getElementById(id);
const welcome = 'Hi, I’m SS07, your AI portfolio assistant. Ask me about the developer, projects, or how to get in touch.';
const questions = ['Tell me about the developer.', 'What projects can I explore?', 'What skills are listed?', 'How can I get in touch?'];
const previewOnly = new URLSearchParams(location.search).get('previewOnly') === 'true';
const previewNotice = 'Showcase preview: the AI backend is not connected yet. Browse the approved sections or visit GitHub.';
let messages = [], pending = false, failed = false, epoch = 0, controller, publicConfig, token, allowedIds = [], parentOrigin;
let nearBottom = true;
try { const u = new URL(new URLSearchParams(location.search).get('hostOrigin')); if (['http:','https:'].includes(u.protocol) && u.origin === u.href.slice(0,-1)) parentOrigin = u.origin; } catch {}
const post = (type, extra = {}) => { if (parentOrigin && token) parent.postMessage({ channel: 'ss07', type, token, ...extra }, parentOrigin); };
function announce(text) { $('announce').textContent = text; }
function scrollLatest(force = false) { if (force || nearBottom) { $('messages').scrollTop = $('messages').scrollHeight; $('latest').hidden = true; } else $('latest').hidden = false; }
function addMessage(role, content, navigationIds = []) {
  const row = document.createElement('article'); row.className = `message ${role}`;
  const label = document.createElement('div'); label.className = 'label'; label.textContent = role === 'user' ? 'You' : 'SS07 · AI';
  const bubble = document.createElement('div'); bubble.className = 'bubble'; bubble.textContent = content;
  row.append(label, bubble);
  const actions = document.createElement('div'); actions.className = 'nav-row';
  for (const id of navigationIds.filter(id => allowedIds.includes(id))) {
    const n = publicConfig?.navigation.find(x => x.id === id); if (!n) continue;
    const b = document.createElement('button'); b.textContent = n.label + ' ↗'; b.onclick = () => post('navigate', { id }); actions.append(b);
  }
  if (role === 'assistant' && content !== welcome) for (const link of publicConfig?.links || []) {
    try { const u = new URL(link.url); if (!['https:','http:','mailto:'].includes(u.protocol) || u.username || u.password) continue;
      const a = document.createElement('a'); a.href = u.href; a.textContent = link.label + ' ↗'; a.target = '_blank'; a.rel = 'noopener noreferrer'; actions.append(a);
    } catch {}
  }
  if (actions.childNodes.length) row.append(actions);
  $('messages').append(row); scrollLatest();
}
function controls() {
  $('send').disabled = pending || failed || !$('input').value.trim();
  for (const b of $('suggestions').children) b.disabled = pending || failed;
  $('retry').disabled = pending;
  $('counter').textContent = `${$('input').value.length} / 4000`;
}
function context() {
  // Keep complete recent pairs; older messages stay visible but are not sent.
  let recent = messages.slice(-11); let size = recent.reduce((n,m) => n + m.content.length, 0);
  while (size > 16000 && recent.length > 1) { size -= recent[0].content.length + recent[1].content.length; recent = recent.slice(2); }
  return recent;
}
async function request() {
  if (pending) return;
  pending = true; $('error').hidden = true; controls();
  const currentEpoch = epoch; controller = new AbortController();
  const waiting = document.createElement('div'); waiting.className = 'waiting'; waiting.textContent = 'SS07 is thinking…'; $('messages').append(waiting); scrollLatest(); announce('SS07 is preparing a reply.');
  try {
    if (previewOnly) throw Error('AI chat is not connected in this showcase preview. Your message has not been sent to an AI provider. Use Browse sections or visit GitHub.');
    const response = await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type':'application/json' }, body: JSON.stringify({ messages: context() }), signal: AbortSignal.any([controller.signal, AbortSignal.timeout(35000)]) });
    const data = await response.json(); if (epoch !== currentEpoch) return;
    if (!response.ok) throw Error(data.error?.message || 'SS07 could not respond. Please retry.');
    if (typeof data.answer !== 'string' || !Array.isArray(data.navigationIds)) throw Error('SS07 received an invalid response. Please retry.');
    waiting.remove(); messages.push({ role:'assistant', content:data.answer }); addMessage('assistant',data.answer,data.navigationIds);
    failed = false; announce(data.answer);
    if (messages.length > 11) $('availability').textContent = 'For follow-ups, SS07 uses only recent messages. Earlier messages remain visible.';
    if (messages.length > 11) $('availability').hidden = false;
  } catch (e) {
    if (epoch !== currentEpoch) return;
    failed = true; $('error-text').textContent = e.name === 'TimeoutError' ? 'SS07 took too long. Your message is kept; Retry sends it again.' : e.message;
    $('error').hidden = false; $('availability').hidden = true; announce($('error-text').textContent);
  } finally {
    waiting.remove(); if (epoch === currentEpoch) { pending = false; controls(); }
  }
}
function submit(text) {
  if (pending || failed || !text.trim()) return;
  if (text.length > 4000) return;
  messages.push({ role:'user',content:text.trim() }); addMessage('user',text.trim()); $('input').value = ''; $('suggestions').hidden = true; request();
}
function reset() {
  epoch++; controller?.abort(); pending = false; failed = false; messages = []; $('messages').replaceChildren(); $('input').value = ''; $('error').hidden = true; $('suggestions').hidden = false; nearBottom = true; $('latest').hidden = true;
  addMessage('assistant',welcome); controls(); announce('Conversation cleared.'); $('input').focus(); checkStatus();
}
async function checkStatus() {
  if (previewOnly) { $('availability').hidden = false; $('availability').textContent = previewNotice; return; }
  const current = epoch;
  try { const r = await fetch('/api/status', { signal: AbortSignal.timeout(5000) }); if (!r.ok) throw Error(); const s = await r.json(); if (current !== epoch) return;
    $('availability').hidden = s.available; $('availability').textContent = s.message;
  } catch { if (current === epoch) { $('availability').hidden = false; $('availability').textContent = 'Cannot reach SS07’s backend. You can retry a question or explore the website.'; } }
}
$('messages').addEventListener('scroll', () => { nearBottom = $('messages').scrollHeight - $('messages').scrollTop - $('messages').clientHeight < 65; if (nearBottom) $('latest').hidden = true; });
$('latest').onclick = () => { nearBottom = true; scrollLatest(true); };
$('composer').onsubmit = e => { e.preventDefault(); submit($('input').value); };
$('send').onclick = () => submit($('input').value);
$('input').oninput = controls;
$('input').onkeydown = e => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing && matchMedia('(pointer:fine)').matches) { e.preventDefault(); submit($('input').value); } };
$('retry').onclick = () => { if (failed && !pending) request(); };
$('reset').onclick = reset; $('close').onclick = () => post('close');
document.addEventListener('keydown', e => { if (e.key === 'Escape') { e.preventDefault(); post('close'); } });
// Keep Tab inside the chat until closed; Escape returns focus to the launcher.
document.addEventListener('keydown', e => {
  if (e.key !== 'Tab') return;
  const focusable = [...document.querySelectorAll('button:not(:disabled),textarea,a[href],summary,[tabindex="0"]')].filter(el => el.getClientRects().length);
  const first = focusable[0], last = focusable.at(-1);
  if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
  else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
});
window.addEventListener('message', e => {
  const m = e.data;
  if (e.source !== parent || e.origin !== parentOrigin || !publicConfig?.hostOrigins.includes(e.origin) || !m || m.channel !== 'ss07') return;
  if (m.type === 'init' && typeof m.token === 'string' && m.token.length <= 100 && ['light','dark'].includes(m.theme) && typeof m.open === 'boolean' && Array.isArray(m.navigationIds) && m.navigationIds.every(x => typeof x === 'string')) {
    if (token && token !== m.token) return;
    token = m.token; allowedIds = m.navigationIds.filter(id => publicConfig.navigation.some(x => x.id === id)); document.documentElement.dataset.theme = m.theme;
    $('browse-actions').replaceChildren();
    for (const id of allowedIds) { const b = document.createElement('button'); b.textContent = publicConfig.navigation.find(x => x.id === id).label; b.onclick = () => post('navigate', { id }); $('browse-actions').append(b); }
    if (m.open) $('input').focus(); return;
  }
  if (!token || m.token !== token) return;
  if (m.type === 'theme' && ['light','dark'].includes(m.theme)) document.documentElement.dataset.theme = m.theme;
  if (m.type === 'visibility' && typeof m.open === 'boolean' && m.open) $('input').focus();
});
async function init() {
  if (previewOnly) $('privacy').textContent = 'Showcase preview: no messages are sent to an AI provider. Chat clears on reload.';
  document.documentElement.dataset.theme = matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  for (const q of questions) { const b = document.createElement('button'); b.textContent = q; b.onclick = () => submit(q); $('suggestions').append(b); }
  addMessage('assistant',welcome); controls(); checkStatus();
  try { const r = await fetch(previewOnly ? '/preview-config.json' : '/api/config', { signal: AbortSignal.timeout(5000) }); if (!r.ok) throw Error(); publicConfig = await r.json();
    if (parent !== window && parentOrigin && publicConfig.hostOrigins.includes(parentOrigin)) parent.postMessage({ channel:'ss07',type:'ready' },parentOrigin);
    else { $('availability').hidden = false; $('availability').textContent = 'Open SS07 from its demo or an approved host website.'; }
  } catch { $('availability').hidden = false; $('availability').textContent = 'SS07 configuration could not load. Please reload the page.'; }
}
init();
