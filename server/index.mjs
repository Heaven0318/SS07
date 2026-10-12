import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { randomUUID } from 'node:crypto';
import { root, settings, loadKnowledge, safeUrl } from './config.mjs';
import { Limits } from './limits.mjs';
import { callProvider, instructions, MAX_OUTPUT_TOKENS } from './provider.mjs';
const fail = (status, code, message) => Object.assign(Error(message), { status, code });
export { validate } from './validation.mjs';
import { validate } from './validation.mjs';
async function readBody(req) {
  if (!/^application\/json(?:;|$)/i.test(req.headers['content-type'] || '')) throw fail(415, 'content_type', 'Use application/json.');
  if (Number(req.headers['content-length']) > 65536) throw fail(413, 'request_size', 'Request is too large.');
  const chunks = []; let size = 0;
  for await (const chunk of req) { size += chunk.length; if (size > 65536) throw fail(413, 'request_size', 'Request is too large.'); chunks.push(chunk); }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { throw fail(400, 'invalid_json', 'Request must be valid JSON.'); }
}
export function createApp(config = settings(), { provider = callProvider, logger = x => console.log(JSON.stringify(x)) } = {}) {
  const knowledge = loadKnowledge(), limits = new Limits(config); let active = 0;
  const publicConfig = { sample: knowledge.sample, navigation: knowledge.navigation, hostOrigins: config.hosts,
    links: [...knowledge.projects, ...(knowledge.contact.links || [knowledge.contact])].filter(x => x.url).map(x => ({ label: x.name || 'Contact', url: safeUrl(x.url) })) };
  const server = createServer(async (req, res) => {
    const id = randomUUID(), started = Date.now(); let code = 'ok';
    const send = (status, body) => { if (!res.destroyed) { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(body)); } };
    res.setHeader('X-Content-Type-Options', 'nosniff'); res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    res.setHeader('Content-Security-Policy', `default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self' data:; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors ${config.hosts.join(' ')}; frame-src 'self'`);
    const reqOrigin = req.headers.origin;
    // Loader executes on host; widget API requests originate from the SS07 iframe.
    if (reqOrigin === config.publicOrigin) { res.setHeader('Access-Control-Allow-Origin', reqOrigin); res.setHeader('Vary', 'Origin'); }
    try {
      const path = new URL(req.url, config.publicOrigin).pathname;
      if (path.startsWith('/api/')) {
        if (reqOrigin && reqOrigin !== config.publicOrigin) throw fail(403, 'origin_denied', 'Origin is not allowed.');
        if (req.method === 'OPTIONS') { res.writeHead(204, { 'Access-Control-Allow-Methods': 'GET, POST', 'Access-Control-Allow-Headers': 'Content-Type' }); return res.end(); }
        if (path === '/api/config' && req.method === 'GET') return send(200, publicConfig);
        if (path === '/api/status' && req.method === 'GET') return send(200, { available: Boolean(config.key), message: config.key ? 'Ready' : 'SS07 is unavailable: the server AI credentials have not been configured.' });
        if (path !== '/api/chat' || req.method !== 'POST') throw fail(404, 'not_found', 'Not found.');
        const messages = validate(await readBody(req));
        const ip = config.trustProxy ? (req.headers['x-forwarded-for'] || req.socket.remoteAddress).split(',')[0].trim().slice(0, 100) : req.socket.remoteAddress;
        const reservation = Buffer.byteLength(instructions(knowledge)) + Buffer.byteLength(JSON.stringify(messages)) + MAX_OUTPUT_TOKENS + 2048;
        const day = limits.reserve(ip, reservation);
        if (!config.key) throw fail(503, 'not_configured', 'SS07 is unavailable because its AI credentials are not configured. Please use the contact section.');
        if (active >= config.concurrent) throw fail(503, 'busy', 'SS07 is busy. Please retry shortly.');
        const abort = new AbortController(); const onClose = () => { if (!res.writableEnded) abort.abort(); }; res.on('close', onClose);
        active++;
        try {
          const reply = await provider(config, knowledge, messages, undefined, abort.signal);
          limits.record(day, reply.tokens);
          send(200, { answer: reply.answer, navigationIds: reply.navigationIds, contextLimited: messages.length >= 11 });
          logger({ requestId: id, event: 'chat', status: 200, durationMs: Date.now() - started, tokens: reply.tokens });
        } finally { active--; res.off('close', onClose); }
        return;
      }
      if (req.method !== 'GET' && req.method !== 'HEAD') throw fail(405, 'method', 'Method not allowed.');
      const files = { '/': 'index.html', '/demo.html': 'demo.html', '/showcase.js': 'showcase.js', '/showcase.css': 'showcase.css', '/demo.js': 'demo.js', '/demo.css': 'demo.css', '/loader.js': 'loader.js', '/loader.css': 'loader.css', '/widget.html': 'widget.html', '/widget.js': 'widget.js', '/widget.css': 'widget.css' };
      if (!files[path]) throw fail(404, 'not_found', 'Not found.');
      const ext = files[path].split('.').at(-1), type = { html: 'text/html', js: 'text/javascript', css: 'text/css' }[ext];
      const bytes = await readFile(resolve(root, 'public', files[path]));
      res.writeHead(200, { 'Content-Type': `${type}; charset=utf-8`, 'Cache-Control': 'no-cache' }); res.end(req.method === 'HEAD' ? undefined : bytes);
    } catch (e) {
      code = ['TimeoutError','AbortError'].includes(e.name) ? 'timeout' : typeof e.code === 'string' ? e.code : 'internal';
      if (e.retry) res.setHeader('Retry-After', e.retry);
      const status = e.status || (code === 'timeout' ? 504 : 500);
      send(status, { error: { code, message: e.status ? e.message : code === 'timeout' ? 'SS07 took too long to reply. Please retry.' : 'SS07 is temporarily unavailable. Please retry later.' }, requestId: id });
      logger({ requestId: id, event: 'request_error', status, code, durationMs: Date.now() - started });
    }
  });
  server.requestTimeout = 10000; server.headersTimeout = 10000;
  server.on('close', () => limits.close());
  return server;
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const config = settings(); const server = createApp(config);
  server.listen(config.port, '0.0.0.0', () => console.log(`SS07 demo: ${config.publicOrigin}`));
  for (const signal of ['SIGINT','SIGTERM']) process.on(signal, () => server.close());
}
