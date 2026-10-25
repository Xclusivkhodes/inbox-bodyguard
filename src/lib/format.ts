export function formatWhen(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/London",
  }).format(new Date(iso));
}

export function verdictLabel(verdict: string): string {
  if (verdict === "quarantine") return "Quarantine";
  if (verdict === "sanitize") return "Sanitised";
  if (verdict === "clear") return "Clear";
  return verdict;
}

export function previewText(text: string): string {
  return text.replace(/\s+/g, " ").trim().slice(0, 140);
}

export type TextPart = { text: string; hit: boolean };

export function splitHighlights(text: string, spans: string[]): TextPart[] {
  const ranges: { start: number; end: number }[] = [];
  for (const span of spans) {
    const needle = span.trim();
    if (needle.length < 4) continue;
    let from = 0;
    while (from < text.length) {
      const found = text.indexOf(needle, from);
      if (found < 0) break;
      ranges.push({ start: found, end: found + needle.length });
      from = found + needle.length;
    }
  }
  ranges.sort((a, b) => a.start - b.start || b.end - a.end);
  const merged: { start: number; end: number }[] = [];
  for (const range of ranges) {
    const last = merged[merged.length - 1];
    if (!last || range.start > last.end) merged.push({ ...range });
    else last.end = Math.max(last.end, range.end);
  }
  const parts: TextPart[] = [];
  let cursor = 0;
  for (const range of merged) {
    if (range.start > cursor) parts.push({ text: text.slice(cursor, range.start), hit: false });
    parts.push({ text: text.slice(range.start, range.end), hit: true });
    cursor = range.end;
  }
  if (cursor < text.length) parts.push({ text: text.slice(cursor), hit: false });
  return parts.length ? parts : [{ text, hit: false }];
}
