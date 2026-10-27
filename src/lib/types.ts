export type Verdict = "clear" | "sanitize" | "quarantine";

export type Severity = "low" | "medium" | "high";

export type Finding = {
  id: string;
  category: string;
  severity: Severity;
  title: string;
  detail: string;
  excerpt: string;
  /** Downgraded findings stay visible but do not raise the verdict. */
  counts: boolean;
};

export type ActionType =
  | "draft_reply"
  | "label"
  | "reminder"
  | "forward"
  | "send"
  | "memory_write"
  | "exfiltrate"
  | "delete";

export type ProposedAction = {
  id: string;
  type: ActionType;
  title: string;
  detail: string;
  to?: string;
  risk: "local" | "external";
  needsApproval: boolean;
};

export type AttackerGoal = {
  type: "forward" | "send" | "memory_write" | "exfiltrate";
  target: string;
};

export type TraceStep = {
  stage: string;
  model: string;
  mode: string;
  role: string;
  summary: string;
  ms: number;
  decision?: "allow" | "deny" | "held" | "info";
};

/** Token counts from one Token Factory response, or from a cache hit. */
export type ModelUsage = {
  model: string;
  promptTokens: number;
  completionTokens: number;
  cached: boolean;
};

/** Estimated price of one letter, using the catalog rates in the spend ledger. */
export type LetterCost = {
  usd: number;
  calls: number;
  cached: number;
  note: string;
};

export type ClassifierJudgment = {
  verdict: Verdict;
  categories: string[];
  confidence: number;
  explanation: string;
  spans: string[];
  model: string;
  mode: "demo-canned" | "demo-mirror" | "live" | "skipped" | "unavailable" | "fallback";
  /** Present on live calls: cache, token cap, reasoning recovery. */
  usageNote?: string;
  usage?: ModelUsage;
};

export type GuardResult = {
  verdict: Verdict;
  score: number;
  explanation: string;
  findings: Finding[];
  sanitizedText: string;
  revealedText: string;
  heuristicVerdict: Verdict;
  classifierVerdict: Verdict;
};

export type AssistantResult = {
  summary: string;
  triage: "now" | "today" | "later" | "fyi";
  draft: string;
  actions: ProposedAction[];
};

export type SandboxResult = {
  complied: boolean;
  actions: ProposedAction[];
  note: string;
  usage?: ModelUsage;
};

export type DemoAssistant = {
  summary: string;
  triage: AssistantResult["triage"];
  draft: string;
  actions: ProposedAction[];
};

export type DemoClassifier = {
  verdict: Verdict;
  categories: string[];
  confidence: number;
  explanation: string;
  spans: string[];
};

export type Fixture = {
  id: string;
  kind: "attack" | "benign";
  /** Image-channel attacks are a coverage gap, not part of the text ASR. */
  channel: "text" | "image";
  inInbox: boolean;
  threadId: string;
  fromName: string;
  fromEmail: string;
  toEmail: string;
  subject: string;
  text: string;
  html?: string;
  receivedAt: string;
  attackerGoal?: AttackerGoal;
  demoClassifier?: DemoClassifier;
  demoAssistant?: DemoAssistant;
};

export type Assessment = {
  guard: GuardResult;
  classifier: ClassifierJudgment;
  sandbox: SandboxResult;
  assistant: AssistantResult;
  withheld: ProposedAction[];
  trace: TraceStep[];
  scanMode: "demo" | "live";
  guardDown: boolean;
  cost: LetterCost;
};

export type ActionDecision = {
  actionId: string;
  decision: "approved" | "denied";
  note: string;
  createdAt: string;
};

export type EmailView = Fixture & {
  assessment: Assessment;
  decisions: ActionDecision[];
  scanMode: "demo" | "live";
};

export type MemoryContact = {
  email: string;
  name: string;
  organization: string;
  trust: "trusted" | "known";
  notes: string;
  /** directory: seeded. you: added from the memory screen, never from a letter. */
  source?: "directory" | "you";
};

export type MemoryPreference = {
  key: string;
  value: string;
  updatedAt: string;
};

export type MemoryThread = {
  id: string;
  subject: string;
  summary: string;
  status: string;
  updatedAt: string;
};

export type MemoryEvent = {
  id: string;
  emailId: string;
  kind: string;
  detail: string;
  status: "applied" | "blocked";
  createdAt: string;
};

export type AppMeta = {
  demoMode: boolean;
  liveReady: boolean;
  inboxSource: string;
  pipelineVersion: string;
  models: {
    baseURL: string;
    classifier: string;
    assistant: string;
    vision: string;
    safety: string | null;
    escalation?: string;
    excluded?: string;
  };
  maxTokens: number;
  liveOptIn: boolean;
  safetyModelNote: string;
};

export type InboxResponse = {
  meta: AppMeta;
  emails: EmailView[];
};

export type MemoryResponse = {
  meta: AppMeta;
  principal: { name: string; email: string; title: string; org: string };
  contacts: MemoryContact[];
  preferences: MemoryPreference[];
  threads: MemoryThread[];
  events: MemoryEvent[];
};
