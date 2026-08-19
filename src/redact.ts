/**
 * Strips identity from candidate text before it reaches any model.
 * Runs first, always. If this throws, the caller must stop — never fall
 * back to the raw text.
 */

const EMAIL = /[\w.+-]+@[\w-]+\.[\w.]+/g;
const PHONE = /(\+?\d[\d\s().-]{7,}\d)/g;
const URL = /\bhttps?:\/\/\S+/g;
const HANDLE = /(^|\s)@[\w.-]{2,}/g;
const CONFIDENTIAL_SENTENCE =
  /[^.!?\n]*\b(nda|non[- ]disclosure(?: agreement)?|confidential (?:project|work|material|architecture|codebase)|do not (?:forward|share|disclose)|internal only)\b[^.!?\n]*[.!?]?/gi;

/**
 * Where in the ORIGINAL text a redaction landed. Display-only: the UI uses
 * these to show the candidate exactly what was removed, so the redaction
 * animation reflects real matches rather than a decorative sweep. `text` and
 * `removed` are unaffected by this and remain the authoritative outputs.
 */
export interface RedactionSpan {
  kind: string;
  start: number;
  end: number;
  replacement: string;
}

export interface RedactionResult {
  text: string;
  removed: { kind: string; count: number }[];
  spans: RedactionSpan[];
}

export function redact(input: string, opts: { knownNames?: string[] } = {}): RedactionResult {
  const removed: Record<string, number> = {};
  const tally = (kind: string, n: number) => {
    if (n) removed[kind] = (removed[kind] ?? 0) + n;
  };

  let text = input;

  tally("email", (text.match(EMAIL) ?? []).length);
  text = text.replace(EMAIL, "[email]");

  tally("phone", (text.match(PHONE) ?? []).length);
  text = text.replace(PHONE, "[phone]");

  tally("url", (text.match(URL) ?? []).length);
  text = text.replace(URL, "[url]");

  tally("handle", (text.match(HANDLE) ?? []).length);
  text = text.replace(HANDLE, "$1[handle]");

  const confidentialRe = new RegExp(CONFIDENTIAL_SENTENCE.source, "gi");
  const confidentialHits = text.match(confidentialRe) ?? [];
  tally("confidential", confidentialHits.length);
  text = text.replace(new RegExp(CONFIDENTIAL_SENTENCE.source, "gi"), "[confidential]");

  // Names the app already knows for this account: the candidate's own name,
  // their current employer, anyone they listed as a reference.
  for (const name of opts.knownNames ?? []) {
    if (name.trim().length < 2) continue;
    const re = new RegExp(escapeRegExp(name.trim()), "gi");
    tally("known_name", (text.match(re) ?? []).length);
    text = text.replace(re, "[redacted]");
  }

  return {
    text,
    removed: Object.entries(removed).map(([kind, count]) => ({ kind, count })),
    spans: locateSpans(input, opts.knownNames ?? []),
  };
}

/**
 * Finds redaction matches against the original input so the UI can point at
 * them. Computed independently of the replacement pass above, because that
 * pass rewrites the string as it goes and its offsets stop referring to
 * anything the candidate can see.
 */
function locateSpans(input: string, knownNames: string[]): RedactionSpan[] {
  const patterns: { kind: string; re: RegExp; replacement: string; group?: number }[] = [
    { kind: "email", re: new RegExp(EMAIL.source, "g"), replacement: "[email]" },
    { kind: "phone", re: new RegExp(PHONE.source, "g"), replacement: "[phone]" },
    { kind: "url", re: new RegExp(URL.source, "g"), replacement: "[url]" },
    { kind: "handle", re: new RegExp(HANDLE.source, "g"), replacement: "[handle]", group: 1 },
    { kind: "confidential", re: new RegExp(CONFIDENTIAL_SENTENCE.source, "gi"), replacement: "[confidential]" },
    ...knownNames
      .filter((n) => n.trim().length >= 2)
      .map((n) => ({
        kind: "known_name",
        re: new RegExp(escapeRegExp(n.trim()), "gi"),
        replacement: "[redacted]",
      })),
  ];

  const spans: RedactionSpan[] = [];
  for (const { kind, re, replacement, group } of patterns) {
    for (const m of input.matchAll(re)) {
      if (m.index === undefined) continue;
      // HANDLE captures a leading space it does not remove; skip past it.
      const offset = group === 1 ? (m[1]?.length ?? 0) : 0;
      const start = m.index + offset;
      const end = m.index + m[0].length;
      if (end > start) spans.push({ kind, start, end, replacement });
    }
  }

  // Overlapping matches (a phone-shaped run inside a URL, say) would render
  // as double-highlighted text. Keep the earliest, longest match.
  spans.sort((a, b) => a.start - b.start || b.end - a.end);
  const merged: RedactionSpan[] = [];
  for (const span of spans) {
    const last = merged[merged.length - 1];
    if (last && span.start < last.end) continue;
    merged.push(span);
  }
  return merged;
}

function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Assertion for use at agent boundaries. Cheap, and it catches the case
 * where someone adds a new input field and forgets to redact it.
 *
 * Uses fresh regexes rather than the module-level ones: those carry /g, and
 * a `lastIndex` left behind by an earlier successful `.test()` can make a
 * later call skip a match near the start of the string. A privacy assertion
 * that can false-negative depending on call order is worse than no
 * assertion, because it reads as a guarantee.
 */
export function assertRedacted(text: string): void {
  if (new RegExp(EMAIL.source).test(text) || new RegExp(PHONE.source).test(text)) {
    throw new Error("assertRedacted: identity-bearing text reached an agent boundary");
  }
}
