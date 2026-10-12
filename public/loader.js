/* SS07 public loader. No credentials or conversation data live here. */
(() => {
  'use strict';
  if (window.SS07) return;
  const script = document.currentScript;
  const source = new URL(script.src).origin;
  const config = window.SS07_CONFIG || {};
  const targets = Object.assign(Object.create(null), config.navigation || {});
  let theme = ['light','dark'].includes(config.theme) ? config.theme : null;
  let opened = false, ready = false, failed = false;
  const token = crypto.randomUUID();
  const wrap = document.createElement('div');
  wrap.style.position = 'fixed'; wrap.style.zIndex = '2147483000';
  // A shadow root isolates launcher styles; the actual chat has iframe isolation.
  const shadow = wrap.attachShadow({ mode: 'open' });
  const style = document.createElement('link');
  style.rel = 'stylesheet';
  style.href = source + '/loader.css';

  const launcher = document.createElement('button'); const logo = document.createElement('img'); logo.src = source + '/ss07-logo.jpg'; logo.alt = ''; logo.setAttribute('aria-hidden','true'); const label = document.createElement('span'); label.textContent = 'Ask SS07'; launcher.append(logo, label); launcher.setAttribute('aria-expanded','false'); launcher.setAttribute('aria-label','Open SS07 portfolio assistant');
  const frame = document.createElement('iframe'); frame.title = 'SS07 AI portfolio assistant'; frame.setAttribute('sandbox','allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox'); frame.referrerPolicy = 'no-referrer';
  frame.style.display = 'none';
  frame.src = `${source}/widget.html?hostOrigin=${encodeURIComponent(location.origin)}${config.previewOnly === true ? '&previewOnly=true' : ''}`;
  const error = document.createElement('div'); error.id = 'error'; error.setAttribute('role','status');
  const errorText = document.createElement('p'); errorText.textContent = 'SS07 could not load. You can still explore this website.';
  const dismiss = document.createElement('button'); dismiss.textContent = 'Close'; dismiss.onclick = () => setOpen(false);
  error.append(errorText, dismiss); shadow.append(style, launcher, frame, error);
  const send = (type, extra = {}) => frame.contentWindow?.postMessage({ channel: 'ss07', type, token, ...extra }, source);
  const system = matchMedia('(prefers-color-scheme: dark)');
  function fitViewport() {
    const vv = window.visualViewport;
    const width = vv?.width || document.documentElement.clientWidth;
    const height = vv?.height || window.innerHeight;
    const margin = width <= 480 ? 12 : 20;
    frame.style.width = `${Math.max(0, Math.min(390, width - margin * 2))}px`;
    frame.style.height = `${Math.max(0, width <= 480 ? height - margin * 2 : Math.min(640, height - margin * 2))}px`;
    wrap.style.right = `${margin}px`;
    wrap.style.bottom = `${margin + (vv ? Math.max(0, window.innerHeight - vv.height - vv.offsetTop) : 0)}px`;
  }
  window.addEventListener('resize', fitViewport);
  window.visualViewport?.addEventListener('resize', fitViewport);
  window.visualViewport?.addEventListener('scroll', fitViewport);
  fitViewport();
  const effectiveTheme = () => theme || (system.matches ? 'dark' : 'light');
  const updateTheme = () => { wrap.className = effectiveTheme(); if (ready) send('theme', { theme: effectiveTheme() }); };
  function setOpen(value) {
    const wasOpen = opened;
    opened = value; launcher.style.display = value ? 'none' : ''; launcher.setAttribute('aria-expanded',String(value));
    frame.style.display = value && !failed ? 'block' : 'none'; error.style.display = value && failed ? 'block' : 'none';
    if (ready) send('visibility', { open: value });
    if (!value && wasOpen) launcher.focus(); else if (value && failed) dismiss.focus();
  }
  launcher.onclick = () => setOpen(true);
  window.addEventListener('message', e => {
    const m = e.data;
    if (e.origin !== source || e.source !== frame.contentWindow || !m || m.channel !== 'ss07' || typeof m.type !== 'string') return;
    if (m.type === 'ready') {
      ready = true; failed = false; clearTimeout(loadTimer);
      send('init', { theme: effectiveTheme(), open: opened, navigationIds: Object.keys(targets).filter(x => /^[a-z][a-z0-9-]{0,39}$/.test(x)) });
      setOpen(opened); return;
    }
    if (!ready || m.token !== token) return;
    if (m.type === 'close') setOpen(false);
    if (m.type === 'navigate' && typeof m.id === 'string' && Object.hasOwn(targets, m.id)) {
      const selector = targets[m.id];
      // Only literal element IDs are supported; model output never becomes a selector or URL.
      if (typeof selector !== 'string' || !/^#[A-Za-z][\w:-]{0,99}$/.test(selector)) return;
      const el = document.getElementById(selector.slice(1));
      if (!el) return;
      setOpen(false); el.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'start' });
      if (!el.hasAttribute('tabindex')) { el.setAttribute('tabindex','-1'); el.addEventListener('blur', () => el.removeAttribute('tabindex'), { once: true }); }
      el.focus({ preventScroll: true });
    }
  });
  const loadTimer = setTimeout(() => { if (!ready) { failed = true; setOpen(opened); } }, 12000);
  system.addEventListener('change', () => { if (!theme) updateTheme(); });
  window.SS07 = Object.freeze({ setTheme(value) { if (!['light','dark'].includes(value)) throw new TypeError('Theme must be light or dark'); theme = value; updateTheme(); }, open() { setOpen(true); }, close() { setOpen(false); } });
  updateTheme();
  if (document.body) document.body.append(wrap); else document.addEventListener('DOMContentLoaded', () => document.body.append(wrap), { once: true });
})();

