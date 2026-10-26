# Roadmap

Order is what a next agent should do, not a calendar. Do not start a live Token Factory call until the user OK's the spend. Demo mode stays the default.

## 1. Keep the demo honest

The authored eval, the canned-upgrade disclosure, and the image gap are the numbers we can stand behind. If you change the pipeline, bump `PIPELINE_VERSION`, rerun `npm test` and `npm run eval`, and update the README table and [FEATURES.md](FEATURES.md) in the same change. Do not fold the tool-gate rate into a claim that the gate caught attacks the guard missed.

## 2. Live judge, only after a budget OK

When the user agrees:

- Set the key in the host env, not in the repo.
- Turn on `LLM_ENABLED`, `BODYGUARD_ALLOW_LIVE=1`, and `DEMO_MODE` off.
- Run one opted-in eval, then turn live calls back off.
- Replace the canned-upgrade sentence only with numbers from that run. Keep the demo suite as the default `npm run eval`.
- Watch the ledger. Soft cap is Nano only. Hard cap stops paid calls.

## 3. A larger red-team set

The brief asks for 50–100 cases sampled from LLMail-Inject and AgentDojo. That needs a licence to use those sets. Do not scrape or commit them. If a licence arrives, add them as a separate scored file, keep the current 11 attacks as the smoke set, and report the new rate beside the old one. Do not retune heuristics to the new ids.

## 4. Image channel

`remittance-scan` is clear because nothing reads the picture. A vision pass needs `GUARD_VISION`, the Super-priced vision model, and the same live opt-in. Downscale before the call. Leave it off in the public demo.

## 5. A real mailbox, still read-only

IMAP sync stays off unless `PUBLIC_DEMO=false`, an admin secret, `INBOX_SOURCE=imap`, and IMAP credentials are all set. The route returns 202 and a job id. A next step is a documented read-only connect for one mailbox the user owns. Do not add SMTP. Do not auto-send. Approval stays a local decision until a transport exists, and even then send stays behind an explicit second confirmation.

## 6. Smaller product gaps

Done in the demo build:

- A live trace shows an estimated cost from the same rate table as the ledger. Demo traces say no call was made. Cache hits are not charged again.
- A preference row opens the editor for that key. A person added from the memory screen joins the directory. Seeded addresses are not rewritten. Letters cannot write either store.
- Masked re-execution is deterministic and local. It withholds memory writes and exfiltration, leaves send and forward for approval, and fails closed. It does not spend a second model call. A live Nemotron task-alignment pass still waits on a budget OK.

## 7. Housekeeping

- `middleware` now lives in `src/proxy.ts`. The named export is `proxy`. It mints `ib-session` and echoes `x-request-id`.
- GitHub Actions runs the offline checks. Protecting `main` so that check is required is a repository setting. A read-only token cannot turn it on.
- Load numbers from the demo server are in [perf.md](perf.md).
- `tailwind.config.js` at the repo root is the designer's v3 reference. The app does not load it. Do not "fix" dark mode there.
- Dev HMR from `127.0.0.1` needs `allowedDevOrigins`. Production does not use HMR. If buttons die in `next dev`, check that before changing React.
