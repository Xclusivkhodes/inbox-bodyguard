import type { MemoryContact } from "./types";

export const principal = {
  name: "Alex Rivera",
  email: "alex@northline.io",
  title: "Head of Product",
  org: "Northline",
  orgDomains: ["northline.io"],
  location: "London",
};

export const seededContacts: MemoryContact[] = [
  {
    email: "priya@northline.io",
    name: "Priya Shah",
    organization: "Northline",
    trust: "trusted",
    notes: "Design. Often moves reviews between Thursday and Friday.",
  },
  {
    email: "sam@northline.io",
    name: "Sam Okonkwo",
    organization: "Northline",
    trust: "trusted",
    notes: "Cofounder. Presents the board deck himself.",
  },
  {
    email: "jonah@harborlight.co",
    name: "Jonah Adeyemi",
    organization: "Harborlight",
    trust: "known",
    notes: "Customer. Renewal in progress. Fair use 100 requests/second.",
  },
  {
    email: "maya.chen@acme.com",
    name: "Maya Chen",
    organization: "Acme Ledger",
    trust: "known",
    notes: "External accountant. Holds vendor bank details.",
  },
];

const contactEmails = new Set(
  [principal.email, ...seededContacts.map((contact) => contact.email)].map((email) =>
    email.toLowerCase(),
  ),
);

export function isKnownAddress(email: string): boolean {
  return contactEmails.has(email.toLowerCase());
}

export function contactByName(name: string): MemoryContact | undefined {
  const needle = name.trim().toLowerCase();
  return seededContacts.find((contact) => contact.name.toLowerCase() === needle);
}

export function orgLookalike(host: string): string | null {
  const labels = host.toLowerCase().split(/[.-]/).filter(Boolean);
  for (const domain of principal.orgDomains) {
    const org = domain.split(".")[0];
    const isReal =
      host.toLowerCase() === domain || host.toLowerCase().endsWith(`.${domain}`);
    if (!isReal && labels.includes(org)) return domain;
  }
  return null;
}

export const seededPreferences: { key: string; value: string }[] = [
  {
    key: "tone",
    value: "Warm, brief, British spelling. No exclamation marks.",
  },
  {
    key: "sign_off",
    value: "Best,\nAlex Rivera\nNorthline",
  },
  {
    key: "auto_send",
    value: "Never. Any mail to another person waits for Alex.",
  },
  {
    key: "timezone",
    value: "Europe/London",
  },
  {
    key: "harborlight_fair_use",
    value: "100 requests/second.",
  },
  {
    key: "accountant",
    value: "Maya Chen, maya.chen@acme.com, Acme Ledger.",
  },
];
