# SS07 verification — 2026-10-06

## Automated checks

`npm test` passes 14 behavioral tests with Node.js 24.20.0. The suite exercises actual backend HTTP handlers, a temporary dedicated SQLite store, the provider adapter with explicit test fixtures, and the actual loader/widget scripts using a minimal DOM harness.

- Input validation: empty text, roles/order, 4,000-character message limit, 16,000-character context limit, message count, invalid JSON/content type, 64 KiB request rejection.
- Honest 503 without credentials; per-IP rate limit and Retry-After; durable daily request/token reservations across reopening the SQLite store; UTC reset; bounded concurrent requests.
- Provider timeout becomes helpful 504; upstream failures/incomplete responses are handled; provider payload uses server-controlled instructions, model configuration, bounded output, structured JSON, `store: false`; unknown/duplicate navigation IDs are filtered.
- No transcript text or keys in application logs; frontend has no provider credentials, HTML insertion or browser transcript storage; private knowledge, environment, server files and SQLite are not publicly served.
- Empty/duplicate sends blocked; Retry reuses the existing visitor message; Start Over aborts and ignores a stale reply even if transport later completes.
- Follow-up context is bounded to recent complete pairs; output is rendered as text, including a script-shaped fixture.
- Widget origin, sender window, token and theme payload checks; loader rejects unknown/unsafe targets and wrong origins/windows/tokens. Closing removes the iframe's hit area; navigation focuses only an explicitly configured destination.
- Reading earlier messages preserves scroll position; Jump to latest restores bottom scrolling.

## Live browser checks

Performed on the separately served SS07 demo using the Codex browser. The preview used `http://localhost:3001` because an interrupted earlier preview was still bound to 3000; documented default remains 3000.

- Light and dark page themes synchronize with launcher and iframe. Desktop panel is compact and isolated.
- Open/close, suggestions, missing-credential notice, visible Send button, helpful request error and Retry work. Retry left exactly one visitor message. Close/reopen preserves the conversation.
- Start Over clears the displayed conversation. Escape closes; focus visibly returns to launcher. Shift+Enter inserts a newline; desktop Enter sends.
- Browse sections displays approved buttons. Explore projects closes the panel, scrolls and focuses the Projects section.
- Layout inspected at 1200 × 900, 390 × 844 and 320 × 568. Iframe bounds measured within the host viewport at 320 pixels. A long repeated URL string wraps as plain text without widening the panel.
- Reduced-height 390 × 360 layout verified: message area scrolls, error and Retry remain accessible, input/Send and Close remain available. This simulates a keyboard-reduced viewport; it is not an actual iOS/Android keyboard test.
- Browser verification caught and corrected blocked inline launcher styles under CSP and sandbox-blocked native form submission. Launcher styles now load from a self-hosted external stylesheet; Send uses a direct button handler. A duplicate notice was removed from compact error states to keep Retry usable.
- Reduced motion is respected in CSS and navigation behavior. A screen-reader session was not performed; labels/live-region behavior are implemented and exposed in the accessibility tree.

Preview image: `../ss07-preview.jpg`.

## Remaining validation before production

### White showcase update

The home page was replaced with a simple white explanatory showcase, public GitHub source links, developer introduction and five repository entries. Metadata was fetched from GitHub's public API for `Heaven0318` on 2026-10-06. No private repositories or portfolio source were read. Public contact is GitHub only. The user selected a private preview. The static build includes only public assets and an explicit unavailable AI state; the Node API remains a separate deployment.

No provider credentials were present. Real AI answers, English/Filipino/Taglish behavior, grounding accuracy, live follow-ups and account/model compatibility remain **unverified**. Synthetic test responses are used only in tests and are never offered as AI answers in the production widget.

No external hosting, DNS, TLS, real portfolio integration, container build, production reverse proxy or persistent hosting disk has been deployed/tested. Test the real host's CSP/frame-ancestors/origins and section IDs, verified external links, touch keyboard and selected provider before production. Public embed settings are not authentication; hard usage caps and dedicated infrastructure remain necessary. Read README for the exact single-instance deployment boundary.

## 2026-10-07 delivery
The showcase audience was changed to public at the user's explicit request. The source was restored into a separate workspace, and all 15 tests passed. The hosted static showcase has no live AI backend or provider credentials.

## Hosted Worker migration
18 tests pass, including Web Request validation, D1 transactional reservation rollback under simultaneous calls, lease cleanup and provider flow. A dedicated key was securely configured. The real provider test reached OpenAI and returned HTTP 429 billing_not_active; successful AI replies remain blocked by API billing. No purchases were made.

The user requested a free AI provider. Gemini support includes bounded JSON output, approved navigation filtering, server-only credentials, quota errors and no automatic paid fallback. Live Gemini verification awaits the dedicated key being saved locally.

## Gemini credential setup (2026-10-07)

A real server-side Gemini 3.8 Flash request returned a grounded developer answer. The separate SS07 Google project displayed Free tier with billing disabled. The key is stored only in ignored local environment configuration and hosted secret storage. Provider timeout is 60 seconds; the browser allows 75 seconds. Automated provider tests use synthetic fixtures, not live responses.
