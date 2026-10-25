/** Characters that look like Latin letters. Used by the unguarded sandbox, not by the high-precision scanner. */
const LATIN_TO_CONFUSABLE: Record<string, string> = {
  a: "\u0430",
  c: "\u0441",
  e: "\u0435",
  i: "\u0456",
  o: "\u043e",
  p: "\u0440",
  s: "\u0455",
  x: "\u0445",
  y: "\u0443",
  A: "\u0410",
  C: "\u0421",
  E: "\u0415",
  I: "\u0406",
  O: "\u041e",
  P: "\u0420",
  S: "\u0405",
  X: "\u0425",
  Y: "\u0423",
};

const CONFUSABLE_TO_LATIN: Record<string, string> = Object.fromEntries(
  Object.entries(LATIN_TO_CONFUSABLE).map(([latin, confusable]) => [confusable, latin]),
);

const ZW0 = "\u200b";
const ZW1 = "\u200c";
const ZWSEP = "\u2060";

export function mixScript(input: string): string {
  return [...input].map((char) => LATIN_TO_CONFUSABLE[char] ?? char).join("");
}

export function foldConfusables(input: string): string {
  return [...input].map((char) => CONFUSABLE_TO_LATIN[char] ?? char).join("");
}

export function encodeInvisible(message: string): string {
  return [...Buffer.from(message, "utf8")]
    .map((byte) =>
      byte
        .toString(2)
        .padStart(8, "0")
        .split("")
        .map((bit) => (bit === "0" ? ZW0 : ZW1))
        .join(""),
    )
    .join(ZWSEP);
}

export function decodeInvisible(text: string): string | null {
  const run = text.match(/[\u200b\u200c\u2060]{32,}/);
  if (!run) return null;
  const parts = run[0].split(ZWSEP).filter(Boolean);
  const bytes: number[] = [];
  for (const part of parts) {
    if (!/^[\u200b\u200c]{8}$/.test(part)) return null;
    const bits = [...part].map((char) => (char === ZW0 ? "0" : "1")).join("");
    bytes.push(Number.parseInt(bits, 2));
  }
  const decoded = Buffer.from(bytes).toString("utf8");
  if (!/^[\t\n\r\x20-\x7e]+$/.test(decoded)) return null;
  return decoded;
}

export function stripInvisible(text: string): string {
  return [...text]
    .filter((char) => {
      const code = char.codePointAt(0) ?? 0;
      if (code >= 0xe0000 && code <= 0xe007f) return false;
      return !/[\u200b\u200c\u200d\u2060\ufeff\u202a-\u202e]/.test(char);
    })
    .join("");
}

/** ASCII smuggling hides letters in Unicode tags (U+E0000–U+E007F). */
export function decodeTagSmuggle(text: string): string | null {
  const tags = [...text].filter((char) => {
    const code = char.codePointAt(0) ?? 0;
    return code >= 0xe0000 && code <= 0xe007f;
  });
  if (tags.length < 6) return null;
  const decoded = tags
    .map((char) => String.fromCodePoint((char.codePointAt(0) ?? 0) - 0xe0000))
    .join("")
    .replace(/[\0-\x1f]/g, "")
    .trim();
  if (decoded.length < 6 || !/[a-z]/i.test(decoded)) return null;
  return decoded;
}

function decodeEntities(text: string): string {
  return text
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function stripTags(html: string): string {
  return decodeEntities(
    html
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/p>/gi, "\n\n")
      .replace(/<[^>]+>/g, " "),
  )
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

export type HiddenSegment = { reason: string; text: string };

export type ExpandedMail = {
  visibleText: string;
  hiddenSegments: HiddenSegment[];
  decodedPayloads: HiddenSegment[];
  revealedText: string;
  expandedText: string;
  foldedText: string;
};

function hiddenBlocks(html: string): { htmlWithoutHidden: string; segments: HiddenSegment[] } {
  const segments: HiddenSegment[] = [];
  let next = html;
  next = next.replace(/<!--([\s\S]*?)-->/g, (_, comment: string) => {
    const text = decodeEntities(comment).trim();
    if (text) segments.push({ reason: "HTML comment", text });
    return " ";
  });
  const hiddenStyle =
    /<([a-z0-9]+)([^>]*)style\s*=\s*["']([^"']*)["']([^>]*)>([\s\S]*?)<\/\1>/gi;
  next = next.replace(hiddenStyle, (full, _tag, _a, style: string, _b, inner: string) => {
    const concealed =
      /display\s*:\s*none/i.test(style) ||
      /visibility\s*:\s*hidden/i.test(style) ||
      /font-size\s*:\s*0/i.test(style) ||
      /opacity\s*:\s*0/i.test(style) ||
      /text-indent\s*:\s*-\d{3,}/i.test(style) ||
      /left\s*:\s*-\d{3,}px/i.test(style) ||
      /clip\s*:\s*rect\(/i.test(style) ||
      (/color\s*:\s*(#fff\b|#ffffff\b|white)\b/i.test(style) &&
        /background(?:-color)?\s*:\s*(#fff\b|#ffffff\b|white)\b/i.test(style)) ||
      (/color\s*:\s*(#fff\b|#ffffff\b|white)/i.test(style) &&
        /font-size\s*:\s*[01]px/i.test(style));
    if (!concealed) return full;
    const text = stripTags(inner);
    if (text) segments.push({ reason: "Hidden CSS", text });
    return " ";
  });
  return { htmlWithoutHidden: next, segments };
}

export function decodeBase64Payloads(text: string): HiddenSegment[] {
  const found: HiddenSegment[] = [];
  const pattern = /(?:[A-Za-z0-9+/]{4}){8,}(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?/g;
  for (const match of text.matchAll(pattern)) {
    try {
      const decoded = Buffer.from(match[0], "base64").toString("utf8");
      if (decoded.length < 12) continue;
      const printable = [...decoded].filter((char) => /[\t\n\r\x20-\x7e]/.test(char)).length;
      if (printable / decoded.length < 0.9) continue;
      found.push({ reason: "Base64", text: decoded.trim() });
    } catch {
      // Ignore blobs that are not base64.
    }
  }
  return found;
}

export function expandMail(input: { text: string; html?: string }): ExpandedMail {
  let visible = input.text.trim();
  let hiddenSegments: HiddenSegment[] = [];
  if (input.html?.trim()) {
    const hidden = hiddenBlocks(input.html);
    hiddenSegments = hidden.segments;
    visible = stripTags(hidden.htmlWithoutHidden);
  }

  const decodedPayloads: HiddenSegment[] = [];
  const corpusForDecode = `${visible}\n${hiddenSegments.map((segment) => segment.text).join("\n")}`;
  const invisible = decodeInvisible(corpusForDecode);
  if (invisible) decodedPayloads.push({ reason: "Invisible characters", text: invisible });
  const smuggled = decodeTagSmuggle(corpusForDecode);
  if (smuggled) decodedPayloads.push({ reason: "Unicode tags", text: smuggled });
  const corpus = [visible, ...hiddenSegments.map((segment) => segment.text)].join("\n");
  for (const payload of decodeBase64Payloads(corpus)) decodedPayloads.push(payload);

  const revealedParts = [stripInvisible(visible)];
  for (const segment of hiddenSegments) {
    revealedParts.push(`— ${segment.reason} recovered —\n${segment.text}`);
  }
  for (const payload of decodedPayloads) {
    revealedParts.push(`— ${payload.reason} decoded —\n${payload.text}`);
  }
  const revealedText = revealedParts.filter(Boolean).join("\n\n").trim();
  const expandedText = [visible, ...hiddenSegments.map((segment) => segment.text), ...decodedPayloads.map((payload) => payload.text)]
    .filter(Boolean)
    .join("\n\n");

  return {
    visibleText: stripInvisible(visible),
    hiddenSegments,
    decodedPayloads,
    revealedText,
    expandedText,
    foldedText: foldConfusables(expandedText),
  };
}
