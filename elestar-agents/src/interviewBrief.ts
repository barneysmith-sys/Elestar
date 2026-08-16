import { z } from "zod";
import { callJSON, MODELS } from "./client";
import type { InterviewBrief, ParsedProcess } from "./types";
import { BRIEF_SYSTEM } from "../prompts/brief";

const BriefZ = z.object({
  alreadyAssessed: z.array(z.object({
    competency: z.string(), depth: z.enum(["mentioned","probed","assessed"]), format: z.string(),
  })),
  safeToSkip: z.array(z.object({ round: z.string(), redundantWith: z.string() })),
  probeInstead: z.array(z.string()).min(1),
  neverSkip: z.array(z.string()).min(1),
  outcomeContext: z.string().max(400),
});

/**
 * Generated only AFTER the candidate approves an intro. Never pre-generate
 * for an unapproved record — the brief is the reward for approval and
 * caching it before approval creates an artifact that shouldn't exist yet.
 */
export async function buildInterviewBrief(args: {
  record: ParsedProcess;
  roleDescription: string;
  hiringLoop?: string[];   // the hiring team's own round names, if known
}): Promise<InterviewBrief> {
  const brief = await callJSON({
    model: MODELS.brief,
    system: BRIEF_SYSTEM,
    user: JSON.stringify({
      record: args.record,
      role: args.roleDescription,
      hiringLoop: args.hiringLoop ?? null,
    }),
    validate: (v) => BriefZ.parse(v),
  });

  // Never recommend skipping more than half a loop — past that, recruiters
  // stop trusting the brief and there is a real limit to what another
  // company's process says about fit for yours.
  const loopSize = args.hiringLoop?.length ?? 5;
  const cap = Math.floor(loopSize / 2);
  return { ...brief, safeToSkip: brief.safeToSkip.slice(0, cap) };
}
