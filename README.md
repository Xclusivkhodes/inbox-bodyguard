# Inbox Bodyguard

The AI email assistant that can't be turned against you.

Inbox Bodyguard triages a mailbox, drafts replies, and remembers who is who. A guard reads every letter before the assistant does, and again before any tool runs. Hidden instructions are removed and shown. Send, forward, and delete wait for one tap. Nothing is transmitted.

This is a demo. It ships with Alex Rivera's sample inbox at Northline and does not call Nebius Token Factory unless you opt in.

Someone continuing the work should read [AGENTS.md](AGENTS.md), then [docs/FEATURES.md](docs/FEATURES.md), [docs/DECISIONS.md](docs/DECISIONS.md), and [docs/ROADMAP.md](docs/ROADMAP.md). The research brief is in [docs/research/](docs/research/) and the design tokens are in [docs/design/](docs/design/).

## Why it exists

Three gaps, from public reports, not from a lab we ran:

- **Hidden text can hijack an AI summary.** In July 2025, white-on-white HTML in an email redirected Gmail's Gemini summary. Inbox Bodyguard separates visible text from hidden CSS, comments, zero-width characters, and Unicode tags, then says what it removed.
- **A single classifier is not a defence.** Adaptive attacks bypass static filters most of the time. The assistant is split: a quarantined reader returns typed fields and cannot start a tool, and a privileged planner sees only those fields and your request. A policy check and an exfiltration filter sit in front of every tool.
- **Assistants are costly or Gmail-only, and security tools often only flag.** Shortwave is priced per seat and tied to Gmail. Superhuman starts at a monthly subscription. Lakera Guard is a developer API. Abnormal is enterprise. Inbox Bodyguard is one personal inbox, with the assistant and the guard in the same view. The public demo is free because it does not call a model.

Nebius Token Factory has no dedicated NVIDIA safety-guard model in the public catalog (25 Oct 2026). Nemotron Nano is the safety judge. Super is an escalation only. Ultra is not on the live path.

## How a letter moves

```mermaid
flowchart LR
  mail[Letter] --> expand[Hidden text and invisible characters]
  expand --> spot[Spotlight datamark]
  spot --> rules[Local rules]
  rules --> judge[Nemotron Nano judge]
  judge --> reader[Quarantined reader]
  reader --> planner[Privileged planner]
  planner --> out[Output judge]
  out --> exfil[Exfiltration filter]
  exfil --> gate[Policy and approval]
```

The reader returns amounts, dates, and a short ask. It does not return tools. The planner's prompt contains those fields inside a datamark, not the raw letter. Send, forward, and delete always wait. A recipient who is not you, the sender, or a saved contact is denied. A contact you add yourself counts. Markdown images, links that were not in the letter, and query strings are stripped before a tool can use them. A masked check then drops memory writes and exfiltration without a second model call.

A demo trace says no Token Factory call was made. A live trace shows an estimated cost from the same rate table as the spend ledger. Cache hits are not charged again.

Memory is local SQLite. Contacts are a directory, not something a letter can write. Preferences show that you wrote them. A memory instruction inside mail is blocked.

## Run it

```bash
npm install
cp .env.example .env
npm run dev
```

Open http://127.0.0.1:4721. The server binds `0.0.0.0`. Locally the port is 4721. A host can set `PORT` (Render and Hugging Face Spaces do) and the same process listens there.

Start with the morning brief, open the poisoned invoice, then the approval queue and the weekly report.

## Screens

Light and dark follow the system until you choose. The toggle stores `ib-theme`.

![Landing, light](docs/screenshots/landing-light.png)

![Sample inbox, the poisoned invoice blocked](docs/screenshots/inbox-light.png)

![The same letter in dark mode](docs/screenshots/inbox-dark.png)

![Approval queue](docs/screenshots/queue.png)

![Morning brief](docs/screenshots/brief.png)

![Red-team rates, demo mode](docs/screenshots/eval.png)

```bash
npm test
npm run eval
npm run test:e2e
```

`npm test` covers the guard, the reader, the exfiltration filter, memory, and the red-team suite. The browser smoke test runs in `DEMO_MODE`. No test calls Token Factory.

## Demo mode and live calls

Demo mode is the default when `NEBIUS_API_KEY` is unset. `DEMO_MODE=true` forces canned judgments even if a key is present.

A live call needs all of the following, and spend under the hard limit:

- `LLM_ENABLED=true`
- `BODYGUARD_ALLOW_LIVE=1`
- `DEMO_MODE` off
- `NEBIUS_API_KEY` set
- the ledger readable, and the admin pause off

`LLM_ENABLED` defaults off. Cache hits do not call the API. `AI_SPEND_CAP_USD` (default $0.30) is a hard cap: every live call reserves its worst-case cost first and is refused if that would pass the cap, then the demo or the cache is served. Past 70% of the cap only Nano runs. See [docs/AI_SPEND_CAP.md](docs/AI_SPEND_CAP.md). If the guard cannot finish, the letter is held and no tool runs.

Prices used for the ledger, per million tokens, catalog of 25 Oct 2026:

| Model | Input | Output |
|---|---|---|
| `nvidia/NVIDIA-Nemotron-3-Nano-30B-A3B` | $0.06 | $0.24 |
| `nvidia/Nemotron-3_5-Lightning` | $0.06 | $0.24 |
| `nvidia/nemotron-3-super-120b-a12b` | $0.30 | $0.90 |
| `nvidia/Nemotron-3-Ultra-550b-a55b` | $1.00 | $3.00 |

Ultra is excluded from the live path. The guard refuses Super. Vision (`nvidia/Nemotron-3.5-Super-VL`) stays off unless `GUARD_VISION` is set, and the text guard does not read pictures.

## Eval

Demo suite, regenerated locally, no network. 11 scored text attacks, 8 benign letters, 1 image-channel case that is not in the rate.

| Layer | Attack success |
|---|---|
| No defence | 100% (11/11) |
| Hidden text removed | 72.7% (8/11) |
| Guard | 0% (0/11) |
| Tool gate | 0% (0/11) |

Heuristic recall 81.8%, false positives 0, two misses: `homoglyph-agenda` and `soft-cc`. Those two are canned classifier judgments in the demo, not live Nemotron measurements. Fused demo recall is 100% with no false positives on this set. The image case `remittance-scan` stays clear because nothing OCRs it.

Removing hidden text is not enough. Eight attacks still succeed in the visible letter. The guard and the gate are what bring the rate to zero on this suite. The tool-gate row matches the guard here because quarantine already drops the attacker's goal. Do not read 0% as "safe against a new attack".

## Deploy

Demo mode is the hosted default. Do not set `LLM_ENABLED` or `BODYGUARD_ALLOW_LIVE` until you have decided to spend Token Factory credit.

### One box on Render

`Dockerfile` builds a standalone Next app and runs it as a non-root user. `render.yaml` uses the free plan, with `DEMO_MODE=true`, `LLM_ENABLED=false`, `PUBLIC_DEMO=true`, and `TRUST_PROXY=1`. The free plan has no disk, so the SQLite file is `/tmp/bodyguard.db` and the sample inbox is reseeded on restart. Liveness is `GET /api/healthz` (`{ok:true}`, no I/O). Readiness is `GET /api/readyz` (`{ok, mode, llm}` only).

1. Push the repo and create a Render Blueprint from `render.yaml`, or a new Web Service using the Dockerfile.
2. Leave the live-call variables unset. `TRUST_PROXY=1` is set because Render appends the client address. The limiter uses only the right-most forwarding hop, and only when that flag is `1`.
3. Open the service URL. Decisions on the free plan do not survive a restart. To keep the spend hard stop across restarts, set Upstash (`UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`) or Turso (`TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`). If either pair is set and the store cannot be reached, live calls stay off.
4. Ping `GET /api/healthz` from an outside cron if the free instance sleeps.

The completion cache lives in the SQLite `llm_cache` table. `BODYGUARD_CACHE_PATH` is unused.

### All on Vercel (demo mode)

Import the repo on Vercel with no environment variables. The UI and the API routes are served from the same origin. On Vercel the SQLite file is `/tmp/bodyguard.db`, and the sample inbox is reseeded on each cold start, the same as the Render free plan. Each function instance has its own copy, so a queue approval can vanish after a cold start. The rate limiter reads `x-real-ip`, which Vercel's edge sets, so `TRUST_PROXY` is not needed. Live AI stays off until the spend cap has a Redis store (see `docs/AI_SPEND_CAP.md`).

### Web UI on Vercel, API on Render

`vercel.json` is the frontend project. The browser calls `NEXT_PUBLIC_API_BASE` when it is set, and the same origin when it is empty.

1. Deploy the API with Render, as above. Note its URL.
2. Import the same repo on Vercel. Framework preset is Next.js.
3. Set `NEXT_PUBLIC_API_BASE` to the Render origin, with no trailing slash, and `NEXT_PUBLIC_SITE_URL` to the Vercel origin.
4. On Render, set `CORS_ORIGINS` to the Vercel origin. Keep `TRUST_PROXY=1` on Render. Leave it unset anywhere the process sees the client socket directly.
5. Redeploy the Vercel project so the public URL is baked into the client.

Vercel’s filesystem is ephemeral. Do not point `BODYGUARD_DB` at Vercel if Render is the API. The API owns the database.

Each browser gets an `ib-session` cookie. Approvals, reset, and memory edits apply to that session. The sample letters stay shared. Nothing in the demo requires a login.

IMAP stays off on the public demo. It runs only when `PUBLIC_DEMO=false`, `ADMIN_SECRET` is set, `INBOX_SOURCE=imap`, and the IMAP host, user, and password are set. `POST /api/inbox/sync` then returns 202 and a job id. Otherwise it returns 409. Public inbox reads never include `source=imap` rows. There is no SMTP. Approval never sends mail.

Hugging Face Spaces can run the same Dockerfile. Set the same environment variables and the health path to `/api/healthz`. Spaces also has an ephemeral disk unless you attach persistent storage.

`/api/v1/*` is the same API as `/api/*`. Errors are `{ error, code, requestId }` with `error` a string. `code` is one of `RATE_LIMITED`, `BAD_INPUT`, `LLM_UNAVAILABLE`, `BUDGET_PAUSED`, `NOT_FOUND`, `INTERNAL`.

GitHub Actions runs typecheck, lint, unit tests, the offline eval, and the production build on pull requests and on `main`. Branch protection for `main` has to be turned on in the repository settings. This change cannot set that from a read-only token.

## Limits

- The text guard does not read images.
- Two heuristic misses are canned upgrades in the demo, not measured Nano judgments.
- A quoted teaching example is left alone on purpose.
- Adaptive attacks against a new channel are not covered by an 11-letter suite.
- Approval is a local record. Mail is never sent.

## Feedback for Nebius and NVIDIA

What worked, what the catalog was missing, and what we would turn on with a key:

- A safety-judge model id on Token Factory would replace the prompted Nano judge. None was in the public catalog on 25 Oct 2026.
- Nano is the right default for classify and triage. Super is only useful when a live judgment is unsure and the budget is healthy.
- Reasoning models can spend the whole token cap before `content` arrives. The client reads `reasoning_content` once and does not retry that empty answer. Transport failures (429, 5xx, timeout) retry once inside a 22 second deadline. A circuit breaker stops further spend while it is open.
- The spend ledger, the cache, and `LLM_ENABLED` are there because a public demo cannot afford an open model loop.
