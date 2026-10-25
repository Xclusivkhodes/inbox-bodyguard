export type LetterFields = {
  fromName: string;
  fromEmail: string;
  subject: string;
  amounts: string[];
  dates: string[];
  ask: string;
};

const AMOUNT = /(?:£|\$|€)\s?\d[\d,]*(?:\.\d{2})?/g;
const WHEN =
  /\b(?:\d{1,2}\s(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*|(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)|\d{1,2}:\d{2})\b/gi;

/**
 * Quarantined reader. It returns typed fields and nothing else.
 * It cannot propose a tool. Callers must not pass hidden or revealed text.
 */
export function readLetter(
  email: { fromName: string; fromEmail: string; subject: string },
  sanitizedVisible: string,
): LetterFields {
  const flat = sanitizedVisible.replace(/\s+/g, " ").trim();
  return {
    fromName: email.fromName,
    fromEmail: email.fromEmail,
    subject: email.subject,
    amounts: [...new Set(sanitizedVisible.match(AMOUNT) ?? [])].slice(0, 4),
    dates: [...new Set(sanitizedVisible.match(WHEN) ?? [])].slice(0, 4),
    ask: flat.slice(0, 280),
  };
}

export function renderFields(fields: LetterFields): string {
  return [
    `from_name: ${fields.fromName}`,
    `from_email: ${fields.fromEmail}`,
    `subject: ${fields.subject}`,
    `amounts: ${fields.amounts.join(", ") || "none"}`,
    `dates: ${fields.dates.join(", ") || "none"}`,
    `ask: ${fields.ask || "none"}`,
  ].join("\n");
}
