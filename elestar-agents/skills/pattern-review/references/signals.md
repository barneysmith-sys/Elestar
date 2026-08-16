# Signal catalogue

| Signal | Severity | Detectable in Phase 1? | Requires |
|---|---|---|---|
| Overlapping process dates | medium | yes | date ranges on Process |
| Round count vs loop length mismatch | low | yes | both fields captured |
| Loop structure differs from employer norm | medium | no - needs pool | round *structure* stored, not just count |
| Implausible finalist frequency | low | yes | per-candidate process index |
| Near-duplicate phrasing across accounts | high | yes | raw description retained |
| Signup clustering on one employer | high | yes | account creation timestamps |
| Calendar events contradict claimed rounds | high | Phase 2 | OAuth connection |
| Employer confirmation contradicts record | critical | Phase 3 | confirmation flow |

## The Phase 1 implication

Three of these need nothing but fields, and they are cheap to add now and
expensive to backfill later:

1. **Store round structure, not just a count.** An array of typed rounds
   (`screen`, `technical`, `system_design`, `case`, `take_home`, `panel`,
   `final`) is what lets you compare a record against how that employer actually
   hires. A single integer throws that away permanently.
2. **Retain the candidate's raw description** alongside the parsed record.
   Near-duplicate detection across accounts is the highest-value signal available
   before OAuth exists, and it is impossible if only the parsed output is kept.
3. **Keep account creation timestamps queryable by employer.** Coordinated listing
   is the referral loop's failure mode and it shows up here first.

None of these require any AI. They require deciding now.
