# SS07 hosted backend

The public deployment at https://ss07-portfolio-assistant.cedrickyosh-pereyra.chatgpt.site now targets a Cloudflare Worker through Sites, rather than a static-only preview. Its widget sends questions to `/api/chat` on the same independent origin. It does not use the portfolio's repository, hosting, authentication, credentials or storage.

`worker/index.mjs` handles Web Requests. `server/provider.mjs` is the shared OpenAI adapter. `knowledge.json` is trusted server knowledge. `scripts/build-worker.mjs` embeds only explicitly approved public assets and knowledge in a single Worker module. Knowledge is never served as a public JSON file. The build never reads `.env` or includes credentials.

Run `npm ci` for migration tooling, `npm test` for checks, and `npm run build` to build the hosted Worker. `npm start` still runs the standalone Node version locally without runtime dependencies; this local version uses its own SQLite usage database. `npm run build:showcase` is only a historical static-preview build and must not be packaged with the current Worker manifest.

Sites supplies a dedicated D1 database bound as `DB`, declared in `.openai/hosting.json`. Schema-only migrations live in `drizzle/` and are applied during deployment. To change the schema, edit `db/schema.ts`, run `npm run db:generate`, inspect the generated SQL and commit it. Never edit applied migrations.

D1 stores daily request counts, reserved and actual token totals, HMAC IP rate buckets, and short-lived concurrency leases. It stores no conversation text or raw IP addresses. A transactional D1 batch reserves all counters and a lease together, and a CHECK constraint rejects over-limit reservations atomically across instances. Expired leases and rate buckets are pruned on the next valid chat request; daily counters older than 31 days are removed. Lease expiry is the provider timeout plus 10 seconds. Cancellation does not refund reserved tokens. Public request origins are not authentication; global and daily caps still apply to direct callers. Per-IP grouping relies on the edge's trusted client IP header; if unavailable, callers share a bucket.

Configure secrets using Sites runtime environment variables, never in the hosting manifest or public files:

- `OPENAI_API_KEY`: SS07-only provider key, marked secret.
- `IP_HASH_SECRET`: random 32+ characters, marked secret.
- `OPENAI_MODEL`: default `gpt-4.1-mini`.
- `HOST_ORIGINS`: exact HTTPS origins permitted to embed the widget, including the SS07 origin.
- Optional caps: `DAILY_REQUEST_CAP`, `DAILY_TOKEN_BUDGET`, `RATE_PER_MINUTE`, `GLOBAL_PER_MINUTE`, `MAX_CONCURRENT`, `PROVIDER_TIMEOUT_MS`.

After updating runtime variables, deploy a saved version to apply them. Use the Sites source helper to push the exact source state and package the build, then save/deploy that version. GitHub pushes alone do not deploy Sites.

The key was securely created for SS07 and saved in the ignored local `.env`, then transferred to hosted secret storage. A live test on 2026-10-07 reached OpenAI but returned `billing_not_active`. Billing activation is a user action: https://platform.openai.com/settings/organization/billing. No billing was activated, credits purchased, or paid external resources provisioned. A successful AI reply remains blocked until that provider account is enabled. `/api/status` reports configuration presence, not a provider connectivity or billing check. The app displays honest unavailability when provider billing prevents replies.

Once billing is enabled, open the widget and ask “Tell me about the developer.” Test follow-ups, Filipino/Taglish and allowed section buttons. Use the public embed snippet only after adding your portfolio's exact origin to `HOST_ORIGINS`. Replace the snippet's placeholder service URL with the hosted SS07 URL, then connect your existing theme through `SS07.setTheme('light' | 'dark')`.
