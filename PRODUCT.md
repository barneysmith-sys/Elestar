# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Two audiences, never mixed inside one scroll.

- **Candidates** supply. They already sat interviews. They forward one original interview email so a later employer can see how far they got.
- **Employers** pay. They browse a portfolio wall, read a proved round next to the work, and skip rounds the candidate already sat.

Companies pay. Candidates supply.

## Product Purpose

Elestar turns one real interview email into a verified credential. A candidate forwards the email. Elestar checks it cryptographically (SPF / DKIM / DMARC). It publishes exactly two facts to the public profile: the company, and the farthest round they reached.

It never publishes the outcome, the questions, the take-home, or the reason they were rejected.

Success for a candidate: the next company can see they sat the round, without publishing a rejection. Success for an employer: a round another company already ran is a round they can skip.

## Positioning

The credential is that the round happened, not that the candidate won it. Past tense. Flat declaratives. Not potential, not promise.

## Mechanism

1. Name the interview.
2. Send the original email (as a file or forwarded as an attachment). A normal forward breaks the signature.
3. If the mail is real, the company and farthest round post to the public profile.

The desk is the employer tool: look at the work, read the proved round, skip that round. Chemistry and the decision conversation still happen.

## Evidence and constraints

- Current wall: **10** people (specimen profiles in this prototype). Do not imply larger scale.
- Pricing: **not set**. Access is open while the wall is this size. A hiring account includes the wall, the desk, and a skip note on each proved round.
- NDA: prove the loop from the interview email, not the assignment. Do not send take-home files or NDA work. The email can still prove they sat a project round.
- Proof address in the live product remains the configured inbound mail. Marketing copy uses **Elestar** and **elestar.io**.
- One spelling on every surface: **Elestar**.

## Brand commitments

Preserve: the halftone dot-matrix mark (four-point star punched out of a lens, with a horizontal dot trail), the Elestar wordmark traced from the official lockup, a canvas resolve animation for the public record, and the scanned observation plates (eye, face fragments, print emblem) used as work fields on stock.

Retire: crumpled-paper as a page texture, aging, distressing, sepia, and campaign lines from the poster ("your eyes deserve…"). The eye is a plate, not a second mark. Grain is a quiet fractal overlay on paper, not distress.

Visual world (pinned): warm paper `#F5F0E6`, midnight navy `#152238`, mid ink `#4E4A42`, hairline `rgba(21, 34, 56, 0.14)`. One saturated accent `--verify` only on the verification mark. Newsreader for body, PP Editorial New for display, Geist Mono for structure.

Three marketing routes: `/` shared, `/candidates` supply, `/hiring` buyer.

## Voice

Past tense. Flat declaratives. "Four rounds happened." "Stripe took them to final." No adjectives about potential.

## Accessibility

`prefers-reduced-motion` respected. Visible keyboard focus. Responsive to 380px. `--ink-mid` on `--stock` must pass WCAG AA.

## Open

- Commercial price and plan names, when the wall is no longer 10 people.
- Production proof domain cutover from the current inbound address.
