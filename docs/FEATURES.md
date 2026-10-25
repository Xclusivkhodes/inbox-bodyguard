# Features

Status against the research brief in [research/inbox-bodyguard.md](research/inbox-bodyguard.md). "Done" means the behaviour is in the demo build and covered by a unit test or the Playwright smoke test. It does not mean a live Nemotron measurement.

## Retention

| # | Feature | Status | Acceptance |
|---|---|---|---|
| 1 | Morning brief | Done | `/brief` shows five lines: needs reply, deadlines, money, what was blocked, and what still needs approval. Empty and loaded states both render. The page is server-rendered from the sample inbox. |
| 2 | Approval queue | Done | `/queue` lists send, forward, and delete that still need a tap. Approve and Decline write a local decision. Withheld actions are listed as denied and have no approve button. The UI says nothing was transmitted. Playwright approves the PO reply and sees "No mail was transmitted". |
| 3 | Editable memory | Done | `/memory` lists contacts as a directory (not written from mail), preferences labelled as written by the user, and blocked memory events. A form saves a preference. Reset keeps preferences and restores letters. A poisoned letter does not become applied memory. |
| 4 | Weekly report | Done | `/report` buckets hidden instructions, lookalike or unusual requests, risky links, and other holds, and names the letters. Counts come from the sample inbox on this machine. |
| 5 | Follow-up nudges | Done | The brief lists clear letters that have been waiting at least three calendar days against the newest mail, up to four. The sample uses Alex's dates, not a live clock. |
| 6 | Known-sender baseline | Done | A display name that does not match the address on file is `spoofed_sender`. A trusted person writing from their real address who asks for a new bank, account, IBAN, sort code, or routing is `baseline_shift`, unless the letter says the details are unchanged. Both quarantine. The weekly report groups them as lookalike or unusual requests. |

## Detection

| # | Feature | Status | Acceptance |
|---|---|---|---|
| 1 | Sanitise hidden text | Done | HTML hidden by `display:none`, `visibility`, `font-size: 0`, `opacity: 0`, 1px white text, off-screen (`text-indent`, negative `left`, `clip`), white-on-white, HTML comments, zero-width characters, and Unicode tags U+E0000–U+E007F are pulled out of the visible text. A hidden-versus-visible gap is a finding. The poisoned invoice shows "We removed hidden instructions." |
| 2 | Spotlight datamark | Done | Email text and the planner prompt wrap lines in `^mark^`. The system prompt says that text is data. The mark is `sha256(inbox-bodyguard\|id)` truncated to 8 hex characters, stable per letter so the cache key matches. It is not a fresh random mark on every request. See [DECISIONS.md](DECISIONS.md). |
| 3 | Nemotron judge on the letter and on tool output | Done in demo, live path gated | Heuristics run first. Nano is asked only when they cannot settle the letter. The same judge idea runs again as the output gate before a tool. Demo mode uses a canned or mirrored judgment and does not call Token Factory. The trace says so. Live calls require the opt-in in [../AGENTS.md](../AGENTS.md). There is no separate safety-guard model id. Super is not the guard. |
| 4 | Quarantined reader and privileged planner | Done | The reader returns name, email, subject, amounts, dates, and a short ask. It has no actions field and does not copy hidden instructions. The planner sees those typed fields and the user's request, not the raw letter, and cannot execute tools. Send may name only an allowed recipient and still waits. |
| 5 | Tool-call policy | Done | Before a tool: recipient must be the principal, a thread participant, or a saved contact. Send, forward, and delete need approval. A stranger, a goal hit, or a quarantined send or forward is withheld. Delete on a quarantined letter stays pending because it is local. A separate masked re-execution (MELON) is not built. |
| 6 | Exfiltration filter | Done | Markdown images are stripped. Links that were not in the source are dropped. Query strings on allowed links are redacted. |
| 7 | Memory provenance | Done | Memory writes are not taken from letter text. Contacts show "directory, not from email". Preferences show "you wrote this". Injection events are stored as blocked. |
| 8 | On-stage red team | Done for the authored suite. The 50–100 case public corpus is not done. | `/eval` and `npm run eval` report attack success with no defence, after hidden text is removed, with the guard, and at the tool gate. `GET /api/eval` does not use the network. The page is server-rendered. The suite is 11 scored text attacks, 8 benign letters, and 1 image gap. It is not a sample of LLMail-Inject or AgentDojo. |

## Competitor gaps

| Gap | Status | Acceptance |
|---|---|---|
| Hidden text hijacking an AI summary | Done | Landing, How it works, and Security name the July 2025 Gmail Gemini case. The poisoned invoice shows the removed instruction and blocks the forward. |
| One classifier is not enough | Done | The pipeline is expand, spotlight, rules, judge, reader, planner, exfil, output judge, approval. The eval table shows the layer rates. Copy does not claim the tool gate caught extra cases. |
| Costly or Gmail-only assistants, and security tools that only flag | Done as positioning | Landing, Security, and the README name Shortwave, Superhuman, Lakera, and Abnormal with the public prices from the brief. The demo does not call a model, so the public demo does not spend credit. A per-letter dollar figure is not shown. The sidebar shows the running ledger against the budget. |
| Output exfiltration | Done | See the exfiltration filter above. |

## Product shell

| Item | Status | Acceptance |
|---|---|---|
| Scripted landing demo | Done | Lumen Cloud example. Replay runs the four steps. "Nothing was forwarded" is in the verdict. `?state=blocked` opens on the blocked step. Example-data marker stays on this demo only. |
| Sample inbox | Done | Northline fixtures. Poisoned invoice is selected by default on desktop. Reset restores letters and keeps preferences. Search, empty state, error with retry, offline banner, skeleton. |
| Guard result and evidence | Done | `/guard/[id]` explains the verdict and lists denied tool calls. `/evidence/[id]` shows the stage timeline. |
| Rules | Done | `/onboarding` states what waits for Alex and that approval does not transmit mail. |
| Theme | Done | Follows the OS. Toggle persists `ib-theme`. Light and dark screenshots are in `docs/screenshots/`. |
| Marketing pages | Done | How it works, Security, Privacy, 404, Open Graph image, favicon. |
| States when the guard is down | Done | The letter is held and tools are denied. Copy does not claim the inbox is safe in an absolute sense. |
| Accessibility and Lighthouse | Done | Playwright covers landing, inbox approval, guard, memory, brief, queue, report, security, how, privacy, 404, and the theme toggle. Lighthouse on the main pages is 90 or better. See [../AGENTS.md](../AGENTS.md). |
| Deploy | Done | `Dockerfile`, `render.yaml`, `vercel.json`, `.env.example`, README deploy steps. `PORT` is honoured. |

## Not done

| Item | Status | Why it is not done |
|---|---|---|
| 50–100 cases sampled from LLMail-Inject and AgentDojo | Todo | Those corpora are not in the repo and must not be downloaded or copied without a licence. The authored suite stays the scored set. |
| Live Nemotron measurements | Todo | No API key, and live calls stay off until the user OK's the budget. Canned upgrades are labelled in the eval note. |
| OCR / vision on image attacks | Todo | `GUARD_VISION` is off. `remittance-scan` is a documented gap. Turning vision on spends Super-priced tokens. |
| A connected mailbox | Todo | IMAP is implemented behind `INBOX_SOURCE=imap` and the admin secret, and returns 409 otherwise. There is no mailbox credential, and mail must stay read-only. |
| MELON-style masked re-execution | Todo | The tool gate is a deterministic allow-list plus the output judge, not a second masked run. |
| Per-letter dollar cost | Todo | The ledger is a running total. The trace does not price one letter in the UI. |
| Click a memory chip to edit that one fact | Todo | Preferences are edited from a form. Contacts are a seeded directory and are not rewritten from the UI. |
