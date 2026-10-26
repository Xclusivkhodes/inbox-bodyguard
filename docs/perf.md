# Load

Demo mode, 26 Oct 2026, production `npm start` on this machine. `BODYGUARD_RELAX_LIMITS=1` was set only for these runs. It is not a production setting. The per-IP cap is 5 requests a minute, so a 30 second open test would otherwise be mostly 429s.

## Approve, demo

```bash
PORT=4722 BODYGUARD_RELAX_LIMITS=1 DEMO_MODE=true LLM_ENABLED=false \
  npx autocannon -c 20 -d 30 -m POST \
  -H 'content-type: application/json' \
  -b '{"emailId":"po-1842","actionId":"po-1842-send","decision":"approved"}' \
  http://127.0.0.1:4722/api/actions
```

| | |
|---|---|
| Requests | 12,605 |
| Non-2xx | 0 |
| p50 | 44 ms |
| p99 | 87 ms |
| Average | 47 ms |

Target was p50 ≤ 150 ms and p99 ≤ 800 ms, with no unexpected non-2xx. This run is inside that.

## Live scan, mocked Token Factory

A local stub answered `POST /v1/chat/completions` with one JSON body. The app had `DEMO_MODE=false`, `LLM_ENABLED=true`, `BODYGUARD_ALLOW_LIVE=1`, and a test key. No call left the machine.

```bash
npx autocannon -c 20 -d 30 -m POST \
  http://127.0.0.1:4723/api/emails/homoglyph-agenda/scan
```

| | |
|---|---|
| Requests | 9,508 |
| Non-2xx | 0 |
| p50 | 59 ms |
| p99 | 111 ms |
| Max | 905 ms |

The letter deadline is 22 seconds. p99 is under that deadline plus 200 ms.

The live slot limit is 4. A fifth caller waits at most 2 seconds and then gets 429. That bound is covered by `src/lib/limits.test.ts` (the wait was about 2.1 seconds, not an open queue).
