/**
 * Anonymous public label for a record, e.g. "A-1842". The only identifier a
 * recruiter ever sees for a dossier.
 *
 * Derived from the row id so it is stable across requests and reproducible in
 * a demo, and deliberately short so it reads as a citation rather than as a
 * database key. It is one-way and non-sequential: nothing about the candidate
 * or the submission order is recoverable from it.
 *
 * Lives in its own module because both the store and its seed data need it,
 * and importing it from either would make them circular.
 */
export function recordLabel(rowId: string): string {
  let hash = 0;
  for (let i = 0; i < rowId.length; i++) {
    hash = (hash * 31 + rowId.charCodeAt(i)) % 10000;
  }
  return `A-${String(hash).padStart(4, "0")}`;
}
