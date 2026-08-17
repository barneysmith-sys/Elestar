---
name: redaction-audit
description: Score an anonymized record for re-identification risk before it is published to the circuit feed or exposed in recruiter search. Use whenever working on anonymity, the k-anonymity check, publishing a dossier, the circuit feed, employer-name handling, privacy settings, or anything where a record becomes visible to someone other than its owner. Run this on every record on every publish, not just the first time.
---

# Redaction Audit

The product promise is that a candidate can list a process without their employer
finding out. Everything else on elestar is recoverable from a bad week. This is
not.

## The actual risk

Nobody de-anonymizes a record by cracking the database. They do it by reading it.

"Five-round loop, Series B fintech, ~300 people, London, senior backend, went to
someone internal, three weeks ago" identifies one person to anyone who works
there. The record contains no name and is fully anonymous by any naive
definition. It is also useless as protection.

This agent exists because the field-level redaction is the easy half and the
combination is the hard half.

## What it does

Input: a candidate-facing record plus aggregate counts from the pool.

Output: a `RedactionAudit` per `schemas/redaction-audit.schema.json` -
`riskScore` 0-100, a list of contributing quasi-identifiers, a `decision` of
`publish` / `generalize` / `withhold`, and specific generalization suggestions.

## Quasi-identifiers to score

Any field is safe alone. Risk is in the intersection.

- Employer identity, even when named indirectly ("Series B fintech, ~300 people,
  London" is an employer name written slowly)
- Role seniority plus function plus location
- Timing - "three weeks ago" plus a known hiring freeze narrows hard
- Loop shape - a company that runs an unusual round order is identifiable by it
- Outcome detail - "they went with someone internal" is often known internally
- Anything the candidate typed into a free-text field

## The k-anonymity floor

A record may publish only if at least **k = 8** other live records share its
combination of (tier band, function, seniority band, region, quarter). Below that,
generalize until it clears, in this order - cheapest information loss first:

1. Timing: exact date -> month -> quarter
2. Employer size: "~300 people" -> "100-500"
3. Region: city -> metro -> country
4. Seniority: exact level -> band
5. Outcome: specific reason -> `unstated`

If it still does not clear at k=8, `withhold` and tell the candidate why in plain
language. Never publish and hope.

## Generalization must be lossy in the right direction

Generalizing must never make the record look *better*. Widening "Series B fintech,
300 people" to "fintech" is fine. Widening it to "a major fintech" is not - that
is inflation dressed as privacy.

## The employer-name decision

elestar withholds the employer name from public records, not only the candidate's
name. This is a real product cost - "cleared five rounds at Stripe" is far more
compelling than "cleared five rounds at a payments company" - and it is worth
paying, because in a thin pool the employer name plus function plus timing is an
identity.

Named employers are visible only after the candidate approves a specific intro.
If someone proposes reversing this, the argument to answer is not "does it convert
better" - it obviously does - but "what is the k-anonymity floor for a named
five-round loop at a 300-person company in one city," and the answer is usually 1.

## Failure behaviour

Fail closed. A timeout, a malformed response, or a schema violation results in
`withhold`, not `publish`. A record that fails to publish is an annoyed candidate.
A record that publishes when it should not have is the end of the product.
