/**
 * Synthetic recruiter threads for the listing demo and evals.
 *
 * These are not real mailboxes and not a live crawl. They are the shape of
 * what a candidate would forward: a From/Date/Subject/body sequence that
 * shows how far the loop actually got.
 */

export const CANONICAL_FORWARDS = `From: Maya Chen <talent@ledgerpay.example>
Date: Mon, 3 Mar 2026 10:12:00 -0500
Subject: Recruiter screen — Senior Backend Engineer

Hi — confirming our 30-min recruiter screen tomorrow.

----------
From: Maya Chen <talent@ledgerpay.example>
Date: Thu, 6 Mar 2026 14:04:00 -0500
Subject: Next step: technical interview

Great conversation. Next is a 60-min technical interview with an engineer.

----------
From: Maya Chen <talent@ledgerpay.example>
Date: Tue, 11 Mar 2026 09:30:00 -0400
Subject: System design round

You're through to system design this Thursday.

----------
From: Maya Chen <talent@ledgerpay.example>
Date: Fri, 14 Mar 2026 16:45:00 -0400
Subject: Update after the final panel

The final panel is done. Candidate was rejected after the final round.
`;

export const HEALTHTECH_FORWARDS = `From: Jordan Blake <talent@northwind-health.example>
Date: Wed, 12 Feb 2026 11:00:00 -0500
Subject: Recruiter screen

Confirming the recruiter screen. After that we'll figure out the technical interviews.

----------
From: Jordan Blake <talent@northwind-health.example>
Date: Mon, 17 Feb 2026 09:12:00 -0500
Subject: A few technical interviews

We'll set up a few technical interviews next. I'll send times.
`;

export const CRYPTO_FORWARDS = `From: Sam Patel <hiring@vaultkit.example>
Date: Mon, 5 Jan 2026 08:00:00 +0000
Subject: Loop complete — Head of Engineering

Recruiter screen, take-home, technical interview, system design, panel, and a final round. We're a 30 person seed stage crypto company in London. The loop runs about 8 weeks. They went with another candidate.
`;

export const MISMATCH_FORWARDS = `From: Riley Ng <recruiting@harbor-clinic.example>
Date: Mon, 2 Mar 2026 10:00:00 -0500
Subject: Recruiter screen — Senior Backend Engineer

Confirming the recruiter screen for the Senior Backend Engineer role at our Series B fintech.

----------
From: Riley Ng <recruiting@harbor-clinic.example>
Date: Fri, 13 Mar 2026 17:00:00 -0400
Subject: Final panel

You're through to the final panel after system design. Technical interview is done. Candidate was rejected after the final round.
`;

export const SCREEN_ONLY_FORWARDS = `From: Maya Chen <talent@ledgerpay.example>
Date: Mon, 3 Mar 2026 10:12:00 -0500
Subject: Recruiter screen — Senior Backend Engineer

Hi — confirming our 30-min recruiter screen tomorrow.
`;

export const GMAIL_FORWARDS = `From: Alex Rivera <talent@gmail.com>
Date: Mon, 2 Mar 2026 10:00:00 -0500
Subject: Recruiter screen

Confirming the recruiter screen, then technical interview, system design, and a final panel. Candidate was rejected after the final round.
`;

export const UNKNOWN_FORWARDS = `From: Recruiter <talent@unknown-corp.example>
Date: Mon, 2 Mar 2026 10:00:00 -0500
Subject: Recruiter screen — Senior Backend Engineer

Confirming the recruiter screen for Senior Backend Engineer.

----------
From: Recruiter <talent@unknown-corp.example>
Date: Fri, 13 Mar 2026 17:00:00 -0400
Subject: Final panel

Technical interview and system design are done. You're through to the final panel. Candidate was rejected after the final round.
`;

export const LOOKALIKE_FORWARDS = `From: Recruiter <talent@ledgerpayy.example>
Date: Mon, 2 Mar 2026 10:00:00 -0500
Subject: Recruiter screen — Senior Backend Engineer

Confirming the recruiter screen at a Series B fintech.

----------
From: Recruiter <talent@ledgerpayy.example>
Date: Fri, 13 Mar 2026 17:00:00 -0400
Subject: Final panel

System design is done. Final panel next. Candidate was rejected after the final round.
`;

export const MALFORMED_FORWARDS = `this is not an email
no headers
just noise`;
