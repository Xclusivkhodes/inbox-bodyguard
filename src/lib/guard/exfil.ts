const MARKDOWN_IMAGE = /!\[[^\]]*\]\(\s*(https?:\/\/[^)\s]+)\s*\)/gi;
const URL_PATTERN = /https?:\/\/[^\s<>"')\]]+/gi;

function bare(url: string): string {
  return url.replace(/[),.;]+$/g, "");
}

function withoutQuery(url: string): string {
  const clean = bare(url);
  try {
    const parsed = new URL(clean);
    parsed.search = "";
    parsed.hash = "";
    return parsed.toString();
  } catch {
    return clean.split("?")[0] ?? clean;
  }
}

/** EchoLeak-style filter: markdown images, unknown links, and query strings. */
export function filterExfil(text: string, source: string): { text: string; dropped: string[] } {
  const allowed = new Set((source.match(URL_PATTERN) ?? []).map((url) => withoutQuery(url)));
  const dropped: string[] = [];
  let next = text.replace(MARKDOWN_IMAGE, (_match, url: string) => {
    dropped.push(bare(url));
    return "";
  });
  next = next.replace(URL_PATTERN, (url) => {
    const cleaned = bare(url);
    const base = withoutQuery(cleaned);
    const known = [...allowed].some((item) => item === base || cleaned.startsWith(item));
    if (!known) {
      dropped.push(cleaned);
      return "[link removed]";
    }
    if (cleaned.includes("?")) {
      dropped.push(cleaned);
      return base;
    }
    return cleaned;
  });
  return { text: next.replace(/[ \t]{2,}/g, " ").trim(), dropped };
}
