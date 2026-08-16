/**
 * Strips identity from candidate text before it reaches any model.
 * Runs first, always. If this throws, the caller must stop — never fall
 * back to the raw text.
 */

const EMAIL = /[\w.+-]+@[\w-]+\.[\w.]+/g;
const PHONE = /(\+?\d[\d\s().-]{7,}\d)/g;
const URL = /\bhttps?:\/\/\S+/g;
const HANDLE = /(^|\s)@[\w.-]{2,}/g;

export interface RedactionResult {
  text: string;
  removed: { kind: string; count: number }[];
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

  // Names the app already knows for this account: the candidate's own name,
  // their current employer, anyone they listed as a reference.
  for (const name of opts.knownNames ?? []) {
    if (name.trim().length < 2) continue;
    const re = new RegExp(escapeRegExp(name.trim()), "gi");
    tally("known_name", (text.match(re) ?? []).length);
    text = text.replace(re, "[redacted]");
  }

  return { text, removed: Object.entries(removed).map(([kind, count]) => ({ kind, count })) };
}

function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Assertion for use at agent boundaries. Cheap, and it catches the case
 * where someone adds a new input field and forgets to redact it.
 */
export function assertRedacted(text: string): void {
  if (EMAIL.test(text) || PHONE.test(text)) {
    throw new Error("assertRedacted: identity-bearing text reached an agent boundary");
  }
}
