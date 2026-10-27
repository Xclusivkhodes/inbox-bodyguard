# Decisions

Why the build looks like this. Dates are 25 Oct 2026 unless a later note says otherwise.

## One Next.js app

The UI and the API ship together so a free Render or Hugging Face container can run the demo, and Vercel can still host the UI alone via `NEXT_PUBLIC_API_BASE`. A second Python service was not added. SQLite is local because memory has to stay on the machine and the demo has to reseed when the disk is empty.

## Nano is the guard and the assistant

The Token Factory public catalog that day had no dedicated NVIDIA safety-guard model id. Nemotron Nano is the safety judge. Lightning is an override (`NEBIUS_GUARD_MODEL`), not the default. Super is escalation for an unsure assistant draft, and only under the soft spend cap. The guard refuses a Super or Ultra model id and falls back to Nano. Ultra is never on the live path. Vision stays off unless `GUARD_VISION` is set, because it is priced like Super and the text suite does not need it.

The brief's planner was described as Super. The default planner is Nano so a public demo cannot burn the credit on reasoning. Super remains the escalation id in config.

## Demo mode is the default, and live is a conjunction

No key was provided, and the credit budget is about $1. `LLM_ENABLED` defaults off. A live HTTP call needs the key, `LLM_ENABLED`, `BODYGUARD_ALLOW_LIVE=1`, demo mode off, a healthy ledger, no admin pause, and a model that is not Ultra. Cache hits do not pay. `GET /api/eval` never uses the network, so a judge opening the red-team page cannot spend credit. Product rescan and `POST /api/eval` return 409 until the same opt-in is set.

## Fail closed

If the guard, the ledger, or the model call cannot finish, the letter is held and tools are denied. The UI says the guard is unavailable. It does not claim the letter is safe.

## Heuristics first, then a judge

Most demo letters settle on rules, so Nano is not called. The two heuristic misses (`homoglyph-agenda`, `soft-cc`) carry canned classifier judgments so the fused demo rate is 100% on this set. Those rows are named in `cannedUpgrades`. They are not Nemotron measurements. Heuristics do not fold confusables, so the classifier layer still has a job. The unguarded sandbox does fold them, reads hidden HTML, and follows the instruction. That is the "no defence" column.

The instruction-override regex requires words such as instructions, prompts, rules, or directives. "Ignore my last note" from Priya stays clear. A quoted teaching attack with no unknown address is downgraded.

## Spotlight marks are stable per letter

The brief asked for a random per-request datamark. The mark is the first 8 hex characters of `sha256("inbox-bodyguard|" + id)`. It is stable so pre-warmed cache keys match and a rescan does not look like a new prompt. The system prompt still says text inside the marks is data.

## Reader and planner

A simplified CaMeL split: the reader returns typed fields and cannot start a tool. The planner sees those fields, not the raw letter. Hidden text must not appear in the fields. This is enforced in `src/lib/guard/reader.ts` and the layer tests.

## Tool gate does not get its own attack-success win

Quarantine already drops the attacker's goal, so the tool-gate column matches the guard on this suite. The README says that on purpose. Withheld actions are not approvable. Send and forward to an allowed recipient stay pending. Delete needs approval even on a quarantined letter because it is a local record, not a send.

## Letter cost and masked re-execution

Demo assessments carry a cost of zero and the sentence "No Token Factory call was made." A live assessment sums `estimateUsd` over the calls that were not cache hits, using the same 25 Oct 2026 rates as the ledger. The masked check is local: memory writes and exfiltration are withheld, send and forward to an allowed person stay in the queue, and a thrown check withholds every action. It is not a second Nemotron call. `src/proxy.ts` replaced `middleware.ts`.

## Exfiltration is deterministic

Markdown images, links that were not in the source, and query strings are stripped in code. That covers the EchoLeak shape without a model call. The output judge still runs.

## Nothing is emailed

Approval records a decision in SQLite and the API returns "No mail was transmitted." There is no SMTP client. IMAP is off unless both the source flag and the admin secret are set. The confirmation stays on the letter after the pending card unmounts, because the decision row is what the UI reads.

## SQLite rows are plain objects

`node:sqlite` returns null-prototype rows. Next.js refuses those as client props and the next navigation 500s. `plainRows()` copies them before they cross the server-to-client boundary. An approval used to crash `/guard` for this reason.

## Cache, caps, and rates

Content-hash cache in SQLite (`llm_cache`, WAL, LRU about 400, prewarm cannot overwrite a real response). No expiry for demo verdicts. Role caps are tighter than the 1024 ceiling. Per-call timeout is 8 seconds, 15 for Super. A letter has one 22 second deadline. Transport errors retry once. HTTP 400 is not retried, except one drop of `response_format`. An empty completion is not retried. Completions are checked with zod before they are cached. A billable 200 is still recorded if the body fails that check. Per-IP and global limits return 429. With `TRUST_PROXY=1` the client address is the right-most forwarding hop, and only when it looks like an IP. The address map is capped.

Super reasoning: if `content` is null and `reasoning_content` holds JSON, use that JSON once. If there is reasoning and no JSON, throw. Do not call again. Super and Ultra requests send `chat_template_kwargs.enable_thinking` false in that same request.

## Design v1.1

Backgrounds are white (`#FFFFFF`) and `#0A0A0B`. The accent is plum (`#862F9B` light, `#D08BE3` dark). Safe, blocked, and flagged stay status colours. Model tags are neutral except the guard lane. Instrument Serif is only `.ib-display` on marketing pages. Theme follows `prefers-color-scheme` until `localStorage` key `ib-theme` is `light` or `dark`. The blocking script in `src/app/layout.tsx` matches the designer snippet. Tailwind v4 dark mode is a custom variant in `src/app/globals.css`, not the v3 config file. The files under `docs/design/` are the earlier jade reference. The live tokens are `src/styles/tokens.css`.

`cacheComponents` and `partialPrefetching` were turned off. They left the page in a postponed shell, so client components rendered and never hydrated.

Fonts are self-hosted with `next/font` (Geist, Geist Mono, Instrument Serif). Lucide comes from `lucide-react`. No runtime CDN.

## Eval corpus

The scored set is fixture-authored: 11 text attacks, 8 benign, 1 image case outside the rate. LLMail-Inject and AgentDojo were not copied. Publishing a 0% guarded rate is allowed only with the layer table, the canned-upgrade list, and the statement that this is not a claim about new attacks.

## Hosting

`Dockerfile` is a multi-stage standalone image. It runs as user `nextjs` and health-checks `GET /api/healthz`. `render.yaml` is the free plan with no disk, `TRUST_PROXY=1`, and demo mode on. Spend across restarts needs Upstash or Turso. `vercel.json` is the frontend preset. `.dockerignore` keeps `node_modules`, `.next`, the database, and the local uploads out of the image. Approvals, reset, and memory edits are scoped by an HMAC `ib-session` cookie so one public demo does not share a single decision log.
