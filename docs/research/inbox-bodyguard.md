# Inbox Bodyguard — build brief (AI email assistant + prompt-injection guard)

Prepared 25 Oct 2026 (Africa/Accra). Every LLM call goes through Nebius Token Factory using NVIDIA Nemotron. Sources are linked; thin evidence is flagged.

## 1. Will people use it after day one?

- Email is a daily habit, which is the retention advantage. Barracuda's 2025 report found 1 in 4 emails is malicious or unwanted spam, and 1 in 100 links is malicious (https://assets.barracuda.com/assets/docs/dms/2025-email-threats-report.pdf).
- Gmail already blocks more than 99.9% of spam, phishing and malware (https://safety.google/intl/en_us/products/gmail/). So the bodyguard's daily value is not spam filtering. It's (a) the assistant work (triage, drafts, reminders) and (b) protecting the AI agent itself from booby-trapped emails.
- I found no public D1, D7 or D30 retention data for AI email assistants. Evidence is thin; don't claim a number. Competitors' pricing shows people pay for daily-use features: Superhuman Starter $25/mo billed annually (https://superhuman.com/plans/mail); Shortwave Business $30, Premier $45, Max $120 per seat per month (https://www.shortwave.com/pricing/).
- Benchmark for productivity apps: about 17.1% D1, 7.2% D7, 4.1% D30 (https://sendbird.com/blog/app-retention-benchmarks-broken-down-by-industry).
- Abandonment risk: disruptive security notifications reduce continued use (https://research.monash.edu/en/publications/effects-of-the-design-of-mobile-security-notifications-and-mobile/), and warning fatigue sets in within weeks (https://www.cl.cam.ac.uk/events/shb/2017/vance2.pdf). Keep security quiet and show it in a weekly ledger.

## 2. Retention features (ranked)

| # | Feature | Impact | Effort | Why |
|---|---------|--------|--------|-----|
| 1 | Morning brief: 5-line daily digest (needs reply, deadlines, money, threats blocked) | Very high | S | Daily trigger; summaries are core to Superhuman and Shortwave |
| 2 | Approval queue for gated actions: the assistant drafts replies or forwards, you approve with one tap | High | S | The safety feature doubles as the habit loop; Google also uses user confirmation as a defense layer (https://blog.google/security/mitigating-prompt-injection-attacks/) |
| 3 | Memory you can see and edit ("I know: your landlord is Kofi; you prefer short replies") | High | M | Shortwave sells memory; making it visible builds trust and protects against memory poisoning |
| 4 | Weekly Bodyguard report: "blocked 2 hidden-instruction emails, 1 lookalike sender, 3 risky links", with each one explained | Medium–High | S | Makes invisible protection visible without nagging |
| 5 | Follow-up nudges ("Ama hasn't replied in 3 days") | Medium | S | Superhuman has Auto Reminders (https://help.superhuman.com/hc/en-us/articles/46005658551053-Auto-Reminders-Auto-Drafts) |
| 6 | Known-sender baseline: alert when "your boss" writes from a new domain or with an unusual payment request | Medium | M | The behavioural approach Abnormal uses for business email compromise, scaled down (https://abnormal.ai/blog/behavioral-ai-outperforms-mail-flow-rules) |

Show in the demo: the morning brief → an email with hidden white-text instructions arrives → the guard strips it and quarantines it with an explanation → the assistant's attempt to forward data is blocked at the tool gate → the approval queue shows only legitimate drafts → the weekly report counter ticks up.

## 3. Detection: state of the art for prompt injection in email agents

- LLMail-Inject (Microsoft, 2025): 370,724 attack submissions against an email agent; end-to-end success was only 0.8% in phase 1 and 0.3% in phase 2. Prompt Shield was the easiest defense to bypass and the LLM judge the hardest. Top attacks used special tokens, other languages, obfuscation and HTML (https://arxiv.org/abs/2506.09956).
- Spotlighting: datamarking cut attack success from about 50% to under 3% on GPT-3.5; encoding brought it to 0–1.8% (https://arxiv.org/abs/2403.14720).
- AgentDojo (GPT-4o, important_instructions attack): tool filter 6.84% attack success; spotlighting with delimiters 41.65%; a transformer injection detector 7.95%, but utility dropped to 41.24% (https://agentdojo.spylab.ai/results/).
- Architecture beats filters: CaMeL completed 77% of tasks with provable security vs 84% undefended (https://arxiv.org/abs/2503.18813). Design patterns include action-selector, plan-then-execute and dual LLM (https://arxiv.org/abs/2506.08837; summary at https://simonwillison.net/2025/Jun/13/prompt-injection-design-patterns/).
- Guards: PromptArmor (an LLM detects and removes the injection) reached under 1% attack success on AgentDojo (https://arxiv.org/abs/2507.15219). MELON (masked re-execution) reached 0.24% attack success on GPT-4o (https://arxiv.org/abs/2502.05174). Prompt Guard 2 86M: 81.2% attack prevention at 3% utility loss (https://huggingface.co/meta-llama/Llama-Prompt-Guard-2-86M).
- Caution: adaptive attacks beat static classifiers more than 90% of the time (ProtectAI, PromptGuard, Model Armor) (https://arxiv.org/abs/2510.09023). Never rely on one classifier.
- Real incidents: the Gmail Gemini summary was hijacked by hidden HTML/CSS text (0din, July 2025: https://0din.ai/blog/phishing-for-gemini; https://www.bleepingcomputer.com/news/security/google-gemini-flaw-hijacks-email-summaries-for-phishing/). EchoLeak, CVE-2025-32711, was a zero-click data leak via markdown image links in M365 Copilot (https://arxiv.org/abs/2509.10540). ASCII smuggling with invisible Unicode tag characters is now used in phishing too (https://www.microsoft.com/en-us/security/blog/2026/09/03/ascii-smuggling-crosses-over-from-ai-prompt-injection-to-phishing-evasion/).
- NVIDIA guard models exist (Llama-3.1-Nemotron-Safety-Guard-8B-v3, 9 languages and 23 categories: https://huggingface.co/nvidia/Llama-3.1-Nemotron-Safety-Guard-8B-v3; NemoGuard jailbreak detect: https://docs.nvidia.com/nemo/guardrails/get-started/tutorials/nemoguard-jailbreakdetect-deployment), but none are in Nebius Token Factory's public model catalog as of 25 Oct 2026 (https://tokenfactory.nebius.com/api/public/models_info). So implement the guard as a prompted Nemotron Nano or Lightning judge, using NVIDIA's safety taxonomy as the rubric. NeMo Guardrails can wrap a Nebius-hosted Nemotron as its LLM.

### Beyond basic: upgrade list

1. **Sanitise and diff hidden text** (S, high Tech). Convert the HTML to visible text and separately pull out hidden text (display:none, font-size 0, white-on-white, off-screen) plus zero-width, bidi and Unicode tag characters (U+E0000–E007F). Any hidden-vs-visible gap is itself a red flag, and it is the exact Gemini 0din attack.
2. **Spotlighting with random datamarks** (S). Wrap email content in a per-request random marker and interleave the token; the system prompt says content inside the marks is data, never instructions.
3. **Nemotron guard judge** (S, high Tech). Lightning or Nano returns JSON {injection: bool, spans, category, confidence}, then a PromptArmor-style removal of flagged spans. Run it on every inbound email and every tool output. Escalate borderline cases to Super-120B.
4. **Dual-LLM / plan-then-execute** (M, very high Tech and Idea). The privileged planner (Super-120B) sees only the user request and decides the plan and tools. A quarantined reader (Nano) reads emails and returns only typed fields (dates, amounts, names) into variables. Planner tool arguments reference variables and never raw email text. This is a CaMeL-lite.
5. **Tool-call gate** (S–M). Before each call: deterministic policy (recipient must be the user, an existing thread participant or a saved contact; no new external domains; no attachments with secrets; rate limits). A Nemotron "task alignment" check asks whether this call serves the user's original request (MELON and Task-Shield ideas). Send, forward and delete always go to the approval queue.
6. **Exfiltration filter on outputs** (S). Strip markdown images and auto-loading URLs; drop links not present in the source email; redact query strings carrying data (the EchoLeak fix pattern, plus Google's URL redaction: https://bughunters.google.com/blog/mitigating-url-based-exfiltration-in-gemini).
7. **Memory provenance** (S). Memory writes are allowed only from user turns, never from email content; every memory shows its source.
8. **Red-team eval on stage** (M). Run 50–100 cases sampled from LLMail-Inject and AgentDojo-style tasks; report attack success and utility, before and after each layer (e.g., "no defense → spotlight → guard → gate").

## 4. Competitor gaps we solve

| Competitor gap (evidence) | Our fix | Tech (Nebius + Nemotron) | Design | Impact | Idea |
|---|---|---|---|---|---|
| **AI summaries can be hijacked by hidden text**: the Gmail Gemini 0din case (bleepingcomputer link above) | Hidden-text diff plus spotlighting plus Nemotron guard | Nano/Lightning judge on Nebius | "We removed hidden instructions" banner | Protects every AI-email user | Shows the attack live |
| **Single-classifier guards get bypassed**: more than 90% adaptive attack success (https://arxiv.org/abs/2510.09023); Prompt Shield was the easiest to bypass in LLMail-Inject | Defence in depth: architecture (dual LLM plus gate) over filters | Planner Super, reader Nano, judge Lightning, all Nemotron | Approval queue | Robust to new attacks | CaMeL-lite for consumers |
| **Expensive and Gmail-only assistants**: Shortwave $30–$120 per seat per month, Gmail or Workspace only (https://www.shortwave.com/pricing/; https://cmdk.email/post/shortwave-review/); Superhuman from $25/mo (https://superhuman.com/plans/mail) | Cheap cascade (Nano or Lightning at $0.06/$0.24 per M tokens) and IMAP support | Cost per email shown | Free tier is realistic | Affordable in Ghana | Low-cost model routing |
| **Security tools that don't assist, or are enterprise-only**: Lakera Guard is a developer API that only flags (https://docs.lakera.ai/docs/api.md); Abnormal is enterprise with a $25,000 minimum order on a public Florida contract (https://www.dms.myflorida.com/content/download/404594/8227931?version=1) | The assistant and the bodyguard in one personal app | Same Nemotron stack | One inbox view | Individuals and small businesses | Consumer-grade agent security |
| **Data leaks through outputs**: EchoLeak zero-click markdown exfiltration (https://nvd.nist.gov/vuln/detail/cve-2025-32711) | Output exfil filter plus link allowlist | Deterministic plus Nemotron check | Invisible to the user | Prevents leaks | Closes a known CVE class |

Top 3 gaps to pitch: (1) hidden-text injection in AI email summaries (Gemini 0din), (2) single-classifier guards bypassed by adaptive attacks, so use a gated architecture, (3) assistants are pricey or Gmail-only, and security tools are enterprise-only or don't assist.
