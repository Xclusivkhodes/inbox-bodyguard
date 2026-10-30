# AI spend cap

Live AI runs on Nebius Token Factory. The account has $1 of credit, shared by three hackathon apps. Inbox Bodyguard gets **$0.30** of it, and the three caps add up to $0.90, which leaves a 10% margin.

## How the cap works (`src/lib/ai-spend-cap.ts`)

1. Before each live call, the server reserves the worst case: the estimated prompt tokens (about chars/3) at the model's input price, plus `max_tokens` at its output price.
2. If that reservation would take the total past the cap, the call is refused and never sent. The pipeline then uses the demo judgment or draft, and the page shows: *"AI spend cap reached. Live AI is off, showing the cached demo."*
3. When the reply comes back, the reservation is settled to the real cost from the `usage` field of the API response. If there is no usage, or the call timed out or failed after it was sent, the worst case is kept. A retry after a timeout reserves again.
4. Every call sends `max_tokens`. The role caps are guard 300, triage 500 and Super 1000, inside a 4096-token budget per letter.

Prices are per 1M tokens, from https://tokenfactory.nebius.com/model-catalog.md, checked on 2026-10-30. A model not in the table is priced at the Ultra rate, which is the safe side.

| Model | Input | Output |
|---|---|---|
| Nano-30B-A3B / Nemotron-3_5-Lightning | $0.06 | $0.24 |
| nemotron-3-super-120b-a12b / Nemotron-3.5-Super-VL | $0.30 | $0.90 |
| Ultra-550b | $1.00 | $3.00 |

## The math

- The worst case for one letter is about **$0.0021–0.0026**. That assumes the full 4000-character body, a guard and triage pass on Nano or Lightning, and a Super review that uses all 1000 of its tokens. A typical letter costs much less.
- The demo inbox holds 20 letters. One full live scan is at most about $0.05.
- The plan allows about 100 live letters (judges plus rehearsals, roughly 5 full scans), so 100 × $0.0026 ≈ **$0.26**. That is under the **$0.30** cap.

## Where the running total is kept

| Store | When | Limits |
|---|---|---|
| Upstash Redis (`INCRBYFLOAT ai-spend-cap:inbox-bodyguard:usd`) | `UPSTASH_REDIS_REST_URL` + `_TOKEN`, or `KV_REST_API_URL` + `_TOKEN` | Durable and shared across all serverless instances. **Recommended on Vercel.** |
| File `data/ai-spend.json` (or `AI_SPEND_FILE`) | Local or single-server runs | Durable on one machine only. |
| `/tmp` file on Vercel | Only if `AI_SPEND_ALLOW_EPHEMERAL=1` | Each instance has its own counter, and the counter resets on a cold start, so the real spend can go past the cap. |

On Vercel with no Redis and no `AI_SPEND_ALLOW_EPHEMERAL=1`, live calls are refused and the app stays in demo mode.

## Settings

- `AI_SPEND_CAP_USD`: the cap in USD. The default is `0.30`.
- `SPEND_BUDGET_USD`: an older setting, still read, but it can only *lower* the cap.

## Adding your own key (Eli)

The repo and Vercel hold no key. To go live:

1. In Vercel, open the project, go to **Storage**, and add **Upstash for Redis** from the Marketplace. This creates the `KV_REST_API_*` variables.
2. In **Settings → Environment Variables (Production)**, add `NEBIUS_API_KEY` (mark it Sensitive). Then set `LLM_ENABLED=true`, `BODYGUARD_ALLOW_LIVE=1` and `DEMO_MODE=false`. You can also set `AI_SPEND_CAP_USD=0.30`.
3. Redeploy. To return to demo mode, remove the key or set `DEMO_MODE=true`.
