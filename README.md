# SS07

An independent AI portfolio support assistant: Node.js API, isolated iframe chat, small public loader, and a standalone sample website. No portfolio repository or infrastructure is used. No visitor accounts, dashboard, transcript database, or runtime npm dependencies.

## White showcase and public hosted preview

The public showcase is hosted at https://ss07-portfolio-assistant.cedrickyosh-pereyra.chatgpt.site. This repository contains both that showcase and the separate Node AI backend; only the static showcase is currently hosted. Uploading this source to GitHub does not automatically deploy the AI backend.

The home page now explains SS07 and showcases Cedrick Yosh Pereyra's public GitHub profile and five public repositories from a snapshot verified on 2026-10-06. The account is [Heaven0318](https://github.com/Heaven0318). No repository source, private data, or portfolio infrastructure was reused. Public repository language metadata is labeled as observed technology, not proficiency. The configured contact route is the GitHub profile; no personal email from the connector is included.

The Sites deployment is a **public static showcase**, separate from the Node AI service. It includes the chat interface and approved section navigation. It has no AI backend connection, keys, database or paid resources. It clearly explains that no AI request is sent from this preview. The original Node API remains implemented and tested in this repository and requires separate server deployment to enable real AI replies. Deploy the Node service and configure its host origins before embedding the working assistant into a portfolio.

`npm run build:showcase` creates only public assets in `dist/`. The build marks the hosted iframe as `previewOnly`, ships an explicit public configuration file and excludes server code, `.env`, Git, logs and usage data. `showcase.config.json` holds the preview origin; `.openai/hosting.json` records its Sites identity. Use the Sites workflow to publish future showcase edits. Never move Node/SQLite into ephemeral static hosting. Opening `npm start` locally uses the actual Node backend (not preview mode), with the white page at `/` and the historical sample demo at `/demo.html`.

## Run locally

Install Node.js 24 or later. From this directory:

```powershell
Copy-Item .env.example .env
# Edit .env locally to configure your own SS07 OpenAI project key.
npm start
```

Open http://localhost:3000. `npm run dev` restarts the server when files change; reload the browser after frontend edits. `npm test` runs backend and browser-script behavioral tests. No npm install or frontend build is required.

With no `OPENAI_API_KEY`, the application runs but honestly displays AI unavailability. It does not simulate AI replies. Configure the key in the ignored `.env` file or hosting secret manager; never paste a key into chat. Use a new provider project/key exclusively for SS07. `OPENAI_MODEL` is server-configurable and must support Responses structured outputs. The example uses `gpt-4.1-mini`; account access must be verified with your provider. The small adapter is `server/provider.mjs`.

The adapter uses the [OpenAI Responses API](https://developers.openai.com/api/reference/typescript/resources/responses/methods/create), structured JSON, `store: false`, no tools, a bounded output allowance and a provider timeout. Live provider testing requires a configured key.

## Replace demo knowledge

Edit `knowledge.json`, then restart the server. It currently contains verified public GitHub profile/repository metadata with `sample: false`. Update the introduction, background, skills, descriptions, URLs, FAQs and contact route only with verified public information. If experimenting with placeholders, use `sample: true` so SS07 labels them. The historical `/demo.html` remains a separate sample portfolio; editing knowledge does not automatically rewrite that page. The current white showcase at `/` contains the actual public GitHub snapshot.

Each project may have `url` (absolute verified HTTP(S) URL or null) and `navigationId` (a configured ID or null). Contact may use `mailto:` or a verified HTTP(S) URL. No email sending is implemented. Links are configured by you, validated on startup and rendered as safe external anchors with `noopener noreferrer`. Model output is plain text; model-produced URLs/HTML are never made executable or automatically linked. Navigation IDs and labels belong in `knowledge.navigation`; actual section IDs belong only in the host integration.

## Embed in a portfolio

Deploy SS07 first and replace `https://ss07.example.com` with its real independent service URL. This is a placeholder, not a deployed address. Copy the following immediately before `</body>`, replacing section IDs and the initial theme:

```html
<script>
  window.SS07_CONFIG = {
    theme: "light", // Use the portfolio's current theme.
    navigation: {
      about: "#about",
      projects: "#projects",
      skills: "#skills",
      contact: "#contact"
    }
  };
</script>
<script defer src="https://ss07.example.com/loader.js"></script>
```

A copyable version is also in `embed-snippet.html`. Public configuration is not secret. Omit `theme` to initially follow system theme. Connect the portfolio's existing theme handler:

```js
// Call after the portfolio applies its own theme.
window.SS07?.setTheme(currentTheme); // "light" or "dark"
```

If the host switches themes before the loader finishes, update `window.SS07_CONFIG.theme` as well. No separate widget theme switch exists. Public methods: `SS07.open()`, `SS07.close()`, `SS07.setTheme("light" | "dark")`.

Only explicitly mapped literal element IDs are supported for navigation. SS07 scrolls to that element, closes the panel and focuses the section. This does not switch a site's hidden hash-route views; if a target is hidden, expose a visible destination or adapt your host integration before using it. The loader accepts no model-generated selectors, arbitrary commands, JavaScript or navigation URLs. Both sides check exact message origins, source windows, expected payload fields and a per-page handshake token. Every message uses a specific target origin.

The launcher uses a shadow root and a separate `loader.css`; the chat uses an iframe. Closing hides the iframe entirely, so it cannot intercept clicks. Conversation memory remains in the existing iframe until reload/Start Over. A load timeout offers a dismissible failure message while the host stays usable. If the loader itself is blocked, the host remains usable with no widget.

### Origins and host CSP

On the SS07 server, set `PUBLIC_ORIGIN` to its exact HTTPS origin and `HOST_ORIGINS` to a comma-separated list of exact HTTPS portfolio/demo origins (no paths, wildcards or trailing slash). Include the SS07 origin to allow its own demo. The server sends `frame-ancestors` from this list. API CORS accepts the SS07 iframe origin, not arbitrary host origins; the host never calls the AI API directly.

If your portfolio has CSP, add the SS07 origin to `script-src`, `style-src` (external launcher stylesheet) and `frame-src`. Place public config/theme glue in an allowed external script or use the host's CSP nonce for the inline snippet. Host credentials and private configuration are never required. SS07's widget CSP permits only its own scripts/styles/network, no objects or inline HTML execution.

## Independent deployment

This implementation targets **one long-running Node.js 24 container/service with a dedicated persistent disk**. Host the demo, loader, widget, and API together on SS07's HTTPS origin. It is not a static-only app. SQLite stores only usage controls and requires a disk that survives restarts/deployments. Do not deploy it to ephemeral serverless storage or scale multiple instances against unrelated SQLite files; that would reset/split caps. For horizontal/serverless scaling, replace `Limits` with atomic counters in a separate SS07-owned shared store first.

No paid resources have been provisioned and no remote deployment has been performed. Choose your hosting provider and review its terms/costs yourself. `Dockerfile` and `compose.yaml` are provided for the dedicated container model. For Docker:

```sh
docker compose up --build -d
```

Before production:

1. Put this repository in its own Git remote; deploy only SS07, never the portfolio checkout.
2. Set SS07-only secrets through the host's secret manager: `OPENAI_API_KEY`, `IP_HASH_SECRET` (random, 32+ characters). Example generation: `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"`; store the result privately.
3. Set `NODE_ENV=production`, `PUBLIC_ORIGIN=https://your-ss07-domain`, exact `HOST_ORIGINS`, selected `OPENAI_MODEL`, caps and `DATA_DIR=/app/data` (container default).
4. Mount a dedicated disk/volume at `/app/data`; back up usage counters if required. Do not use the portfolio's database, volume, accounts, secrets, authentication or hosting config.
5. Put the service behind your SS07-only HTTPS reverse proxy. Overwrite client forwarding headers at the controlled proxy. Set `TRUST_PROXY=true` only if that proxy is the sole reachable ingress; otherwise keep false. Direct access to the backend must be blocked when trusting forwarded IPs.
6. Health probe: `GET /api/status` must return HTTP 200. Its `available` flag checks presence of configuration, not provider connectivity. Run a real chat to verify model/key access after deployment.
7. Add edge request/body limits and bot/traffic controls on SS07's service; keep provider project limits configured. Public origin checks, CORS, widget IDs and the handshake token are **not visitor authentication**. A scripted attacker can imitate headers. Server caps bound usage regardless; visitors sharing an IP share a rate bucket.
8. Verify theme, embedding, section IDs, provider failures and mobile keyboard on the real host. Then add the public embed snippet yourself.

On a host with a Node runtime and dedicated persistent directory, use `npm start` as the start command and set the same environment variables. Port is configurable. Graceful shutdown handles SIGTERM/SIGINT. Keep service logs in SS07's hosting account only.

## Limits and usage

| Control | Default |
| --- | --- |
| Request body | 64 KiB |
| Visitor/assistant message | 4,000 characters |
| Recent context | Last 11 messages (complete pairs), at most 16,000 characters |
| API conversation validation | 1–12 messages, must end in user (alternation means at most 11) |
| Visible AI reply | 3,500 characters |
| Provider output | 700 tokens, including any model reasoning |
| Provider timeout / browser timeout | 25 / 35 seconds |
| Per-IP requests per minute | 6 |
| Global requests per minute | 30 |
| In-flight provider calls | 3 per process |
| Daily validated requests | 100 |
| Daily reserved token budget | 200,000 |

Set environment variables from `.env.example` to adjust cost controls. Daily caps reset at 00:00 UTC. Before each call, SS07 atomically reserves a conservative allowance based on UTF-8 prompt bytes, output limit, and message overhead. Reservations are never refunded, including failed, unavailable, busy or cancelled requests; a timeout may still incur provider cost. Reported actual tokens are tracked separately. This is deliberately conservative and may stop use below the configured token budget. It is a token/call control, not a currency estimator or an exact bill. Usage caps do not guarantee zero provider-side spend after cancellation. Review current prices on the provider's own website and configure a separate provider project budget/alerts. No prices are embedded here.

Development shares the local IP bucket. Restarts preserve SQLite caps; tests use disposable independent stores. If you delete development `data/`, caps reset; do not do that in production to bypass a budget. Distributing instances or losing the disk invalidates durable cap protection. No background AI requests or automatic provider retries run; Retry is visitor-controlled.

## Data and privacy

Visitor messages and AI replies exist only in iframe memory, and are sent over HTTPS to SS07 and then its AI provider. Closing/reopening retains the page session; reloading or Start Over clears it. Start Over aborts the browser request and invalidates late replies. No transcript cookies, local/session storage, server transcript database or visitor accounts exist.

`data/ss07-usage.sqlite` stores daily aggregate requests, reserved/actual token counts, and short-lived rate buckets keyed by a daily salted HMAC of IP addresses. Raw IPs and conversation text are not saved by the application. Expired minute buckets and daily rows older than 31 days are pruned on the next validated chat attempt. Hosting/proxy platforms may separately retain access logs; disable request bodies, query logging and unnecessary IP retention there. Operational app logs include random request ID, status/error code, elapsed time and token count, never keys, messages or provider error bodies.

`store: false` requests that the provider not retain response objects for retrieval; it does not assert zero provider retention. Review your provider account's data controls and retention terms. The widget discloses AI processing and asks visitors to avoid sensitive information. No promise of unlimited memory or human handoff is made.

## Verification

See `VERIFICATION.md` for the checks performed and limitations. Tests inject synthetic responses only inside test code; production always uses the real adapter. Browser-script unit tests validate state transitions and messaging; they are distinct from real browser layout checks. No live AI answer was verified because credentials were absent.
