# SS07 hosted backend

The public deployment at https://ss07-portfolio-assistant.cedrickyosh-pereyra.chatgpt.site now targets a Cloudflare Worker through Sites, rather than a static-only preview. Its widget sends questions to `/api/chat` on the same independent origin. It does not use the portfolio's repository, hosting, authentication, credentials or storage.

`worker/index.mjs` handles Web Requests. `server/provider.mjs` contains the shared Gemini and OpenAI adapters. `knowledge.json` is trusted server knowledge. `scripts/build-worker.mjs` embeds only explicitly approved public assets and knowledge in a single Worker module. Knowledge is never served as a public JSON file. The build never reads `.env` or includes credentials.

Run `npm ci` for migration tooling, `npm test` for checks, and `npm run build` to build the hosted Worker. `npm start` still runs the standalone Node version locally without runtime dependencies; this local version uses its own SQLite usage database. `npm run build:showcase` is only a historical static-preview build and must not be packaged with the current Worker manifest.

Sites supplies a dedicated D1 database bound as `DB`, declared in `.openai/hosting.json`. Schema-only migrations live in `drizzle/` and are applied during deployment. To change the schema, edit `db/schema.ts`, run `npm run db:generate`, inspect the generated SQL and commit it. Never edit applied migrations.

D1 stores daily request counts, reserved and actual token totals, HMAC IP rate buckets, and short-lived concurrency leases. It stores no conversation text or raw IP addresses. A transactional D1 batch reserves all counters and a lease together, and a CHECK constraint rejects over-limit reservations atomically across instances. Expired leases and rate buckets are pruned on the next valid chat request; daily counters older than 31 days are removed. Lease expiry is the provider timeout plus 10 seconds. Cancellation does not refund reserved tokens. Public request origins are not authentication; global and daily caps still apply to direct callers. Per-IP grouping relies on the edge's trusted client IP header; if unavailable, callers share a bucket.

Configure secrets using Sites runtime environment variables, never in the hosting manifest or public files:

- `GEMINI_API_KEY`: SS07-only Google free-tier provider key, marked secret.
- `IP_HASH_SECRET`: random 32+ characters, marked secret.
- `AI_PROVIDER`: gemini (default), with `GEMINI_MODEL=gemini-2.5-flash-lite`. OpenAI is an explicitly selected alternative only; no automatic fallback.
- `HOST_ORIGINS`: exact HTTPS origins permitted to embed the widget, including the SS07 origin.
- Optional caps: `DAILY_REQUEST_CAP`, `DAILY_TOKEN_BUDGET`, `RATE_PER_MINUTE`, `GLOBAL_PER_MINUTE`, `MAX_CONCURRENT`, `PROVIDER_TIMEOUT_MS`.

After updating runtime variables, deploy a saved version to apply them. Use the Sites source helper to push the exact source state and package the build, then save/deploy that version. GitHub pushes alone do not deploy Sites.

The initial OpenAI test returned billing_not_active. At the user's request, SS07 was switched to Gemini's free API tier. No billing was activated, credits purchased or paid external resources provisioned. Configure a dedicated Gemini key in the ignored .env as GEMINI_API_KEY and in hosted secret storage. Keep the Google project on the free tier with billing disabled; SS07 cannot inspect or enforce your account's billing setting. Quotas and eligibility are controlled by Google. Free-tier content may be used to improve Google's products: https://ai.google.dev/gemini-api/docs/pricing. The widget discloses this and asks visitors to avoid sensitive information. /api/status reports configuration presence, not provider connectivity. The application never silently switches to a paid provider.

Once the Gemini key is configured, open the widget and ask “Tell me about the developer.” Test follow-ups, Filipino/Taglish and allowed section buttons. Use the public embed snippet only after adding your portfolio's exact origin to `HOST_ORIGINS`. Replace the snippet's placeholder service URL with the hosted SS07 URL, then connect your existing theme through `SS07.setTheme('light' | 'dark')`.
