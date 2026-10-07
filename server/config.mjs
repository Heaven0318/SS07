import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
export const root = resolve(import.meta.dirname, '..');
export function origin(value) {
  const u = new URL(value);
  if (!['http:', 'https:'].includes(u.protocol) || u.origin !== value || u.username || u.password) throw Error('Expected an exact HTTP(S) origin');
  return value;
}
export function settings(env = process.env) {
  const num = (key, fallback, max) => {
    const n = Number(env[key] || fallback);
    if (!Number.isInteger(n) || n < 1 || n > max) throw Error(`Invalid ${key}`);
    return n;
  };
  const publicOrigin = origin(env.PUBLIC_ORIGIN || 'http://localhost:3000');
  const hosts = (env.HOST_ORIGINS || publicOrigin).split(',').map(x => origin(x.trim()));
  const secret = env.IP_HASH_SECRET || 'ss07-local-development-only';
  if (env.NODE_ENV === 'production' && (secret.length < 32 || !env.IP_HASH_SECRET || !publicOrigin.startsWith('https://') || hosts.some(x => !x.startsWith('https://')))) throw Error('Production requires HTTPS origins and IP_HASH_SECRET (32+ characters)');
  const provider = env.AI_PROVIDER || 'gemini';
  if (!['gemini','openai'].includes(provider)) throw Error('Invalid AI_PROVIDER');
  return { publicOrigin, hosts, secret, provider, key: (provider === 'gemini' ? env.GEMINI_API_KEY : env.OPENAI_API_KEY) || '', model: provider === 'gemini' ? env.GEMINI_MODEL || 'gemini-2.5-flash-lite' : env.OPENAI_MODEL || 'gpt-4.1-mini',
    dataDir: resolve(root, env.DATA_DIR || 'data'), port: num('PORT', 3000, 65535),
    dailyRequests: num('DAILY_REQUEST_CAP', 100, 100000), dailyTokens: num('DAILY_TOKEN_BUDGET', 200000, 100000000),
    rate: num('RATE_PER_MINUTE', 6, 1000), globalRate: num('GLOBAL_PER_MINUTE', 30, 10000),
    concurrent: num('MAX_CONCURRENT', 3, 100), timeout: num('PROVIDER_TIMEOUT_MS', 25000, 60000), trustProxy: env.TRUST_PROXY === 'true' };
}
export function safeUrl(value) {
  try { const u = new URL(value); return ['https:', 'http:', 'mailto:'].includes(u.protocol) && !u.username && !u.password ? u.href : null; } catch { return null; }
}
export function loadKnowledge() {
  const k = JSON.parse(readFileSync(resolve(root, 'knowledge.json'), 'utf8'));
  if (typeof k.sample !== 'boolean' || !k.developer || !Array.isArray(k.projects) || !Array.isArray(k.faqs) || !k.contact || !Array.isArray(k.navigation)) throw Error('Invalid knowledge structure');
  const ids = new Set();
  for (const n of k.navigation) {
    if (!/^[a-z][a-z0-9-]{0,39}$/.test(n.id) || typeof n.label !== 'string' || ids.has(n.id)) throw Error('Invalid navigation configuration');
    ids.add(n.id);
  }
  for (const item of [...k.projects, k.contact]) {
    if (item.url && !safeUrl(item.url)) throw Error('Unsafe knowledge URL');
    if (item.navigationId && !ids.has(item.navigationId)) throw Error('Unknown navigation ID');
  }
  if (Buffer.byteLength(JSON.stringify(k)) > 20000) throw Error('Knowledge must be under 20 KB');
  return k;
}
