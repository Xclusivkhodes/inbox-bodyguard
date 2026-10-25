<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Inbox Bodyguard

Personal AI email assistant with a prompt-injection guard. Hackathon entry for the Nebius x NVIDIA Global AI Hackathon (Personal AI, Devpost). The product name is always **Inbox Bodyguard**. The safety layer is "the guard". The model that drafts is "the assistant". Never shorten the product to "Bodyguard".

Tagline: "The AI email assistant that can't be turned against you." Landing H1: "An AI assistant for your inbox, with a bodyguard."

Start here, then read [docs/FEATURES.md](docs/FEATURES.md), [docs/DECISIONS.md](docs/DECISIONS.md), and [docs/ROADMAP.md](docs/ROADMAP.md).

## Goal

Triage a mailbox, draft replies, and remember who is who, without letting a letter turn the assistant against the user. Hidden instructions are removed and shown. Send, forward, and delete wait for one tap. Nothing is transmitted.

The sample person is Alex Rivera, Head of Product at Northline (climate analytics), London, alex@northline.io. Sign-off is "Best,\nAlex Rivera\nNorthline". Timezone is Europe/London. Org domain is northline.io. Trusted contacts include Priya Shah (priya@northline.io), Sam Okonkwo (sam@northline.io), Jonah Adeyemi (jonah@harborlight.co), and Maya Chen (maya.chen@acme.com). Harborlight fair use is 100 requests per second. Lookalike detection is label-based: northline-mail.co and northline.io.support-desk.com flag; notnorthline.com does not.

The landing scripted demo stays the Lumen Cloud / Ama Mensah example (hidden white text forwarding invoices to ap-sync@evil-ledger.example). The product inbox is the Northline fixture corpus. Do not mix them.

## Architecture

One Next.js 16 app (App Router, React 19, TypeScript, Tailwind v4) serves the UI and the API. There is no separate backend process.

```
letter -> hidden-text expand -> spotlight datamark -> local heuristics
       -> Nemotron Nano judge (skipped, canned, or live)
       -> quarantined reader (typed fields only)
       -> privileged planner (draft, no tools)
       -> exfiltration filter -> output judge -> approval gate
```

| Path | Role |
|---|---|
| `src/lib/pipeline.ts` | Orchestrates a letter. Copies fixture actions before mutation. |
| `src/lib/guard/` | Decode, heuristics, spotlight, reader, exfil, policy, unguarded sandbox. |
| `src/lib/store.ts` | SQLite inbox, memory, decisions. `node:sqlite`. |
| `src/lib/habit.ts` | Morning brief, follow-ups, weekly report. |
| `src/lib/eval/harness.ts` | Red-team rates. Scoring only. The gate must not read `attackerGoal`. |
| `src/lib/config.ts` | Models, caps, `PIPELINE_VERSION`, live opt-in. |
| `src/app/api/` | Route handlers. The browser never calls Token Factory. |
| `src/styles/` | Live tokens and `ib-` components. Design originals are in `docs/design/`. |

Memory is local SQLite (`BODYGUARD_DB`, default `data/bodyguard.db`). WAL. A `globalThis` singleton holds the connection. Tests use a temp file and must call `closeDb()` before switching paths. Rows from `node:sqlite` have a null prototype. Pass them through `plainRows()` before they become client props, or Next.js crashes the page.

`PIPELINE_VERSION` in `src/lib/config.ts` reseeds fixture letters when it changes. Preferences use `INSERT OR IGNORE` and survive reset. Reset deletes emails, the action log, memory events, threads, and the pipeline meta key, then reseeds.

## How to run

```bash
npm install
cp .env.example .env
npm run dev
```

Open http://127.0.0.1:4721. The process binds `0.0.0.0`. Locally the port is 4721. If `PORT` is set (Render, Hugging Face Spaces), `npm start` listens there.

`npm run dev` needs `allowedDevOrigins` for `127.0.0.1` (already set). Without it, Next 16 blocks the HMR websocket and client buttons stay dead. Production `npm start` hydrates normally. Playwright uses `npm start` and reuses a server that is already on 4721.

Demo mode is the default. Do not set `NEBIUS_API_KEY`, `LLM_ENABLED=true`, or `BODYGUARD_ALLOW_LIVE` unless the user has agreed to spend Token Factory credit.

## How to test

```bash
npm test          # node:test, guard, memory, budget. No network.
npm run eval      # rewrites eval/results.json. Demo only.
npm run test:e2e  # Playwright chromium against production start.
npx eslint src e2e --max-warnings 0
```

Locked demo eval (no network): 11 scored text attacks, 8 benign, 1 image-channel case excluded from the rate. Unguarded attack success 100% (11/11). Guarded 0% (0/11). Hidden text removed leaves 72.7% (8/11). Tool-gate rate matches the guard because quarantine already drops the goal. Heuristic recall 81.8%, false positives 0. Misses `homoglyph-agenda` and `soft-cc` are canned classifier upgrades, not live Nemotron measurements. The image case `remittance-scan` stays clear because the text guard does not OCR.

Lighthouse, mobile, production server, 25 Oct 2026: performance 96–99, accessibility 100, best practices 100, SEO 100 on `/`, `/inbox`, `/how`, `/security`, `/privacy`, `/brief`, `/queue`, `/report`, `/memory`, `/eval`.

## How to deploy

Demo mode stays the hosted default. See the README deploy section.

- `Dockerfile` plus `render.yaml`: one box, health `GET /api/health`, disk at `/data`, `DEMO_MODE=true`, `LLM_ENABLED=false`.
- `vercel.json`: Next.js UI. Set `NEXT_PUBLIC_API_BASE` when the API is a different origin, and `CORS_ORIGINS` on the API.
- Hugging Face Spaces can use the same Dockerfile. Honour `PORT`.
- SQLite on an ephemeral disk reseeds on boot. Render mounts `/data` so decisions survive restarts.

There is no SMTP. IMAP runs only when `INBOX_SOURCE=imap` and `POST /api/inbox/sync` carries `x-admin-secret`. Otherwise that route returns 409.

## Remotes

`origin` is the Cursor remote. `github` is https://github.com/Xclusivkhodes/inbox-bodyguard (private). Push `main` to both. Never commit `.env`, API keys, or `data/*.db`.

## Constraints

- **DEMO_MODE** is the default. Unset, or no key, means demo. `DEMO_MODE=true` forces demo even with a key. `false` does not by itself enable live calls.
- **No live Nebius call** unless the user has OK'd the API budget. A live call needs all of: `LLM_ENABLED=true` (only `true`, `1`, or `yes`), `BODYGUARD_ALLOW_LIVE=1`, `DEMO_MODE` off, `NEBIUS_API_KEY` set, spend under the hard cap, ledger readable, admin pause off, model not Ultra, guard model not Super or Ultra. Cache hits skip those checks.
- Product rescan (`POST /api/emails/:id/scan`) returns 409 unless `liveOptIn()` is true. `scripts/eval.ts --live` must exit 1 without that opt-in. `GET /api/eval` never calls the network. `POST /api/eval` returns 409 when not opted in.
- All LLM traffic goes to `https://api.tokenfactory.nebius.com/v1`. The key comes only from `NEBIUS_API_KEY`. Never hardcode it. Never log it.
- Budget: persisted spend from `usage`. Soft cap about 70% of `SPEND_BUDGET_USD` (default $1) forces Nano only. Hard cap about 90% serves cache or demo. `LLM_ENABLED` is the kill switch and defaults off. A broken ledger fails closed.
- Models, catalog 25 Oct 2026: Nano `nvidia/NVIDIA-Nemotron-3-Nano-30B-A3B` is the guard and the assistant. Lightning is an env override, not the default. Super is escalation only. Ultra is excluded. Vision `nvidia/Nemotron-3.5-Super-VL` stays off unless `GUARD_VISION` is set. There is no dedicated NVIDIA safety-guard model id in that public catalog, so Nano is the safety judge. Do not invent model ids.
- Super can spend the token cap on reasoning and return `content: null`. If `reasoning_content` contains JSON, use it once. If reasoning exists and there is no JSON, throw. Do not retry. Do not send a second request.
- Caps: email body 4000, paste 2000, classifier 300, assistant 500, Super 1000, global completion ceiling 1024. Timeout 8s, one request, no 400 retries. Rate limit about 5 POSTs a minute and 30 a day per IP, about 20 paid calls a minute globally, semaphore of 4, HTTP 429. Do not trust `X-Forwarded-For` unless `TRUST_PROXY=1`.
- Cache key is sha256 of app name, pipeline version, model, system, user sliced to 4000, temperature, and max tokens. Do not overwrite a non-prewarmed real response. Demo verdicts do not expire.
- **Read-only email.** Nothing is sent, forwarded, or deleted on a server. Approval writes a local decision and says so. Quarantine may offer a local delete that still needs approval. A forward or send to a stranger is withheld, not approvable.
- **Neutral light and dark.** Page background is `#FFFFFF` or `#111113`. Brand colour is an accent only. Do not paint large regions with guard backgrounds, accent-subtle, or a green radial gradient. Verdicts are neutral cards with a 3px accent border and a small `ib-guard` chip. The landing paper stays white in dark mode. Theme follows the OS until the user picks. Storage key is `ib-theme`. `?theme=light|dark` still works. The head script sets `data-theme` and `class="dark"` only when the stored choice is light or dark.
- **Professional bar.** Every state (loading, empty, error with retry, offline, guard down and fail-closed, approval pending). No dead buttons. British spelling in product copy. Sentence case. No exclamation marks. Never claim "100% safe". WCAG AA, keyboard, visible focus, ARIA. Self-hosted assets, no CDN. Lighthouse 90 or better on the main pages. Tests include the guard, memory, the red-team harness, and Playwright in demo mode.
- Fail closed. If the guard cannot finish, the letter is held and every tool call is denied.

## Coding conventions

- TypeScript, strict. Match the files you touch. Do not add a second component library. shadcn primitives already exist under `src/components/ui/`. Product chrome uses the `ib-` classes.
- Product copy is British spelling. Code identifiers stay as they are (`sanitize`, `color` in CSS).
- Do not put the attacker's goal into the production gate. `guardedGoalSucceeds` and `unguardedGoalSucceeds` are scoring-only.
- Heuristics are general. Do not blocklist the demo attacker domains. The high-precision instruction-override pattern must require words like instructions, prompts, rules, or directives, so "ignore my last note" stays clear. A quoted teaching attack with no unknown address is a low, non-counting finding. Heuristics must not fold confusables. The unguarded sandbox does.
- Client fetches go through `apiUrl()` so `NEXT_PUBLIC_API_BASE` can point at a separate API.
- Bump `PIPELINE_VERSION` when fixture assessments must be rebuilt.
- Do not commit `node_modules`, `.next`, `.env`, `data/*.db`, `data/llm-cache.json`, `uploads/`, or `hackathon/`.
