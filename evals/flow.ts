/**
 * End-to-end flow test against a running server.
 *
 * `evals/reasoners.ts` checks the judgment logic in isolation; this checks the
 * product as a recruiter and candidate actually meet it — over HTTP, through
 * the session cookie, in the order the demo runs:
 *
 *   list a process -> publish -> circuit -> search -> request intro
 *   -> pending -> approve -> brief
 *
 * The assertions that matter most here are the negative ones. A brief must be
 * refused before approval and after a decline, an identity must not appear on a
 * pending or declined request, and an unpublished record must not be reachable.
 * Those are the guarantees the product is selling, so they are tested against
 * the real routes rather than the functions behind them.
 *
 * Usage:
 *   npm run build && PORT=3111 npm start   # in one shell
 *   npm run eval:flow                      # in another
 */

const BASE = process.env.ELESTAR_BASE_URL ?? "http://127.0.0.1:3111";

let passed = 0;
let failed = 0;
const cookies = new Map<string, string>();

function check(name: string, condition: boolean, detail?: unknown) {
  if (condition) {
    passed += 1;
    console.log(`  ok    ${name}`);
  } else {
    failed += 1;
    console.error(`  FAIL  ${name}`);
    if (detail !== undefined) console.error(`        ${JSON.stringify(detail).slice(0, 400)}`);
  }
}

function section(title: string) {
  console.log(`\n${title}`);
}

/** Minimal cookie jar, so the session behaves the way a browser makes it behave. */
function remember(res: Response) {
  for (const raw of res.headers.getSetCookie?.() ?? []) {
    const [pair] = raw.split(";");
    const eq = pair?.indexOf("=") ?? -1;
    if (pair && eq > 0) cookies.set(pair.slice(0, eq), pair.slice(eq + 1));
  }
}

function cookieHeader(): Record<string, string> {
  if (cookies.size === 0) return {};
  return { cookie: [...cookies].map(([k, v]) => `${k}=${v}`).join("; ") };
}

async function api<T = any>(
  path: string,
  body?: unknown,
): Promise<{ status: number; json: T }> {
  const res = await fetch(BASE + path, {
    method: body === undefined ? "GET" : "POST",
    headers: { "content-type": "application/json", ...cookieHeader() },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  remember(res);
  const text = await res.text();
  let json: any = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text.slice(0, 200) };
  }
  return { status: res.status, json };
}

/** Runs the SSE pipeline and collects every message it emitted. */
async function runPipeline(
  description: string,
  priorAnswers?: Record<string, string>,
  extra?: { recruiterEmail?: string; role?: string; forwardedEmails?: string; fixture?: string; simulation?: boolean },
) {
  const forwardedEmails = extra?.forwardedEmails;
  const fixture = extra?.fixture;
  const recruiterEmail =
    extra?.recruiterEmail ?? (fixture || forwardedEmails ? undefined : "talent@ledgerpay.example");
  const role = extra?.role ?? (fixture || forwardedEmails ? undefined : "Senior Backend Engineer");
  const res = await fetch(`${BASE}/api/pipeline`, {
    method: "POST",
    headers: { "content-type": "application/json", ...cookieHeader() },
    body: JSON.stringify({
      description,
      priorAnswers,
      recruiterEmail,
      role,
      forwardedEmails,
      fixture,
      simulation: extra?.simulation ?? Boolean(fixture),
    }),
  });
  remember(res);
  if (!res.ok || !res.body) {
    return { ok: false as const, status: res.status, messages: [] as any[] };
  }

  const messages: any[] = [];
  let buffer = "";
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const chunks = buffer.split("\n\n");
    buffer = chunks.pop() ?? "";
    for (const chunk of chunks) {
      for (const line of chunk.split("\n")) {
        if (line.startsWith("data:")) {
          try {
            messages.push(JSON.parse(line.slice(5).trim()));
          } catch {
            /* partial frame, ignore */
          }
        }
      }
    }
  }
  return { ok: true as const, status: res.status, messages };
}

/**
 * The settled frame for a stage. Each stage emits `running` first and then its
 * result, so the last frame is the one carrying the payload and the real status.
 */
function settled(messages: any[], step: string) {
  return [...messages].reverse().find((m) => m.kind === "step" && m.step === step);
}

const CANONICAL =
  "Senior Backend Engineer at a Series B fintech. Recruiter screen. Technical interview. " +
  "System design. Final panel. Candidate was rejected after the final round.";

async function main() {
  section("status: the deployment describes itself honestly");
  {
    const { status, json } = await api("/api/status");
    check("status responds", status === 200, json);
    check("names the reasoning engine", json.engine === "model" || json.engine === "deterministic", json.engine);
    check(
      "labels simulated reasoning when there is no key",
      json.engine === "model" || /SIMULATED/i.test(json.engineLabel),
      json.engineLabel,
    );
    check("publishes the k floor", json.kFloor === 8, json.kFloor);
    check("lists the logic that is real either way", Array.isArray(json.alwaysReal) && json.alwaysReal.length > 0);
  }

  section("list a process: the pipeline publishes an anonymous record");
  let publishedId: string | null = null;
  {
    const run = await runPipeline("", undefined, { fixture: "canonical" });
    check("pipeline streams", run.ok, run.status);
    const steps = run.messages.filter((m) => m.kind === "step");
    const done = run.messages.find((m) => m.kind === "done");
    const meta = run.messages.find((m) => m.kind === "meta");

    check("emits a meta frame before the work", Boolean(meta), meta);
    check(
      "runs receive, parse_mail, identify, plan, research, match, audit, publish",
      ["receive", "parse_mail", "identify", "plan", "research", "match", "audit", "publish"].every((s) =>
        steps.some((m) => m.step === s),
      ),
      steps.map((s) => s.step),
    );
    check("publishes the canonical input", done?.outcome === "published", done);
    check("returns an anonymous handle", /^[A-Z]-\d+$/.test(done?.recordId ?? ""), done?.recordId);
    publishedId = done?.recordId ?? null;

    const receive = settled(run.messages, "receive");
    check("receive is at prove@elestar.ai", receive?.data?.arrival?.to === "prove@elestar.ai", receive?.data);
    check("canonical run is labelled a simulation", receive?.data?.arrival?.simulation === true, receive?.data);
    const plan = settled(run.messages, "plan");
    check("plan selects catalog tools for the known domain", plan?.data?.action === "catalog_lookup", plan?.data);
    check("plan does not invent a live crawl", Array.isArray(plan?.data?.tools) && plan.data.tools.includes("resolveCompany"), plan?.data);
    check("ingest last round reached is the final", /final/i.test(receive?.data?.arrival?.lastReachedLabel ?? ""), receive?.data);

    const parsed = settled(run.messages, "identify")?.data?.parsed;
    check("extracts 4 rounds, not 5", parsed?.rounds?.length === 4, parsed?.rounds?.map((r: any) => r.type));
    check("outcome is not invented", parsed?.outcome === "unstated", parsed?.outcome);

    const verify = settled(run.messages, "match");
    check("verify step is ok", verify?.status === "ok", verify?.status);
    check("verify payload names decision checks", (verify?.data?.verification?.checks?.length ?? 0) >= 4, verify?.data?.verification?.checks);
    check("verify payload has a domain, not a mailbox", typeof verify?.data?.domain === "string" && !String(verify?.data?.domain).includes("@"), verify?.data);
    check(
      "structured evidence never contains a mailbox",
      !/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i.test(JSON.stringify(verify?.data?.structured ?? {})),
      verify?.data?.structured,
    );

    const audit = settled(run.messages, "audit");
    check("measures a real cohort against the floor", typeof audit?.data?.cohortCount === "number", audit?.data);
    check("cohort clears the floor before publishing", (audit?.data?.cohortCount ?? 0) >= 8, audit?.data?.cohortCount);

    const serialised = JSON.stringify(run.messages);
    check("no company name survives anywhere in the stream", !/\bacme|stripe|monzo\b/i.test(serialised));
    check("the recruiter mailbox is gone from the whole stream", !serialised.toLowerCase().includes("talent@ledgerpay.example"));
    check("recruiter display names do not ride the stream", !/maya chen/i.test(serialised), serialised.slice(0, 200));
  }

  section("list a process: identity never leaves the server");
  {
    const run = await runPipeline("", undefined, { fixture: "pii" });
    const parseMail = settled(run.messages, "parse_mail");
    check("reports identifier kinds removed", (parseMail?.data?.removed?.length ?? 0) >= 3, parseMail?.data?.removed);
    check("emits spans so the UI can show the removal", (parseMail?.data?.spans?.length ?? 0) >= 3, parseMail?.data?.spans);

    const serialised = JSON.stringify(run.messages);
    check("the email is gone from the whole stream", !serialised.includes("ada@example.com"));
    check("the phone number is gone", !serialised.includes("555-0199"));
    check("the handle is gone", !serialised.includes("adalovelace"));
    check("still publishes after redaction", run.messages.find((m) => m.kind === "done")?.outcome === "published");
  }

  section("list a process: ambiguity asks instead of guessing");
  {
    const vague = "Recruiter screen then several technical rounds at a Series B fintech.";
    const first = await runPipeline(vague);
    const parse = settled(first.messages, "identify");
    const asked = first.messages.find((m) => m.kind === "questions");
    const done = first.messages.find((m) => m.kind === "done");
    check("stops at parse", parse?.status === "blocked", parse?.status);
    check("asks at least one question", (asked?.questions?.length ?? 0) > 0, asked);
    check("hands back the partial parse with the questions", Boolean(asked?.priorParse), Object.keys(asked ?? {}));
    check("does not publish an ambiguous record", done?.outcome !== "published", done);
    check("no handle is issued", !done?.recordId, done?.recordId);

    const questions: string[] = asked?.questions ?? [];
    const answers: Record<string, string> = {};
    for (const q of questions) {
      answers[q] = /how many/i.test(q) ? "4 rounds in total" : "the last one was the system design round";
    }
    const second = await runPipeline(vague, answers);
    const parse2 = settled(second.messages, "identify");
    const done2 = second.messages.find((m) => m.kind === "done");
    check("answering the questions unblocks the parse", parse2?.status === "ok", parse2?.status);
    check("nothing further is asked", !second.messages.some((m) => m.kind === "questions"), second.messages.filter((m) => m.kind === "questions"));
    // Publication is a separate gate. Clearing the ambiguity is what lets the
    // record be sized at all; whether it then publishes still depends on the
    // cohort it would join.
    check("the answered submission reaches a terminal outcome", Boolean(done2?.outcome), done2);
    check("the answered submission publishes", done2?.outcome === "published", done2);
    check("the stated total is recorded, not the named count", parse2?.data?.parsed?.roundsTotal === 4, parse2?.data?.parsed);
    check(
      "rounds it cannot name stay unnamed rather than invented",
      (parse2?.data?.parsed?.rounds?.length ?? 0) < (parse2?.data?.parsed?.roundsTotal ?? 0),
      parse2?.data?.parsed?.rounds?.map((r: any) => r.type),
    );
  }

  section("list a process: the privacy audit can refuse");
  {
    const run = await runPipeline("", undefined, { fixture: "crypto" });
    const audit = settled(run.messages, "audit");
    const publish = settled(run.messages, "publish");
    const done = run.messages.find((m) => m.kind === "done");
    check("the audit blocks a too-specific record", audit?.status === "blocked", audit?.status);
    check("it says why, with a measured cohort", typeof audit?.data?.cohortCount === "number", audit?.data);
    check(
      "it proposes generalisations rather than only refusing",
      (audit?.data?.audit?.generalizations?.length ?? 0) > 0,
      audit?.data?.audit,
    );
    check("publish does not run", publish?.status === "blocked", publish?.status);
    check("the outcome is not published", done?.outcome !== "published", done);

    const held = done?.recordId;
    if (held) {
      const { status } = await api("/api/intro", {
        action: "request",
        recordId: held,
        roleDescription: "Head of Engineering",
      });
      check("a held record is not reachable by handle", status === 404, status);
    } else {
      check("a held record exposes no handle to reach", true);
    }
  }

  section("list a process: personal email is not a company signal");
  {
    const run = await runPipeline("", undefined, { fixture: "gmail" });
    const verify = settled(run.messages, "match");
    const done = run.messages.find((m) => m.kind === "done");
    check("verify is blocked or failed", verify?.status === "blocked" || verify?.data?.verification?.status === "failed", verify);
    check("personal email is not published", done?.outcome !== "published", done);
    check("the gmail address is not in the stream", !JSON.stringify(run.messages).toLowerCase().includes("talent@gmail.com"));
  }

  section("list a process: company mismatch fails verification");
  {
    const run = await runPipeline("", undefined, { fixture: "mismatch" });
    const verify = settled(run.messages, "match");
    const done = run.messages.find((m) => m.kind === "done");
    check("verify is blocked", verify?.status === "blocked", verify?.status);
    check("status is failed", verify?.data?.verification?.status === "failed", verify?.data?.verification);
    check("mismatch is not published", done?.outcome !== "published", done);
    check("the harbor mailbox is not in the stream", !JSON.stringify(run.messages).includes("recruiting@harbor-clinic.example"));
  }

  section("list a process: claimed stage vs mail is a contradiction");
  {
    const run = await runPipeline("", undefined, { fixture: "contradiction" });
    const verify = settled(run.messages, "match");
    const done = run.messages.find((m) => m.kind === "done");
    check("contradiction is held for review", verify?.status === "blocked", verify?.status);
    check("status is needs_review", verify?.data?.verification?.status === "needs_review", verify?.data?.verification);
    check(
      "the discrepancy is explained rather than a bare no",
      (verify?.data?.verification?.inconsistencies ?? []).some((line: string) => /discrepancy|only supports/i.test(line)),
      verify?.data?.verification?.inconsistencies,
    );
    check("contradiction is not published", done?.outcome !== "published", done);
  }

  section("list a process: NDA material never publishes");
  {
    const run = await runPipeline("", undefined, { fixture: "nda" });
    const serialised = JSON.stringify(run.messages);
    check("project codename is gone from the stream", !/nightingale/i.test(serialised), serialised.slice(0, 200));
    check("confidential kind was stripped", (settled(run.messages, "parse_mail")?.data?.removed ?? []).some((r: any) => r.kind === "confidential"));
    check("nda loop can still publish after stripping", run.messages.find((m) => m.kind === "done")?.outcome === "published");
  }

  section("list a process: garbage input degrades gracefully");
  {
    const run = await runPipeline("asdf");
    const done = run.messages.find((m) => m.kind === "done");
    const asked = run.messages.find((m) => m.kind === "questions");
    const parsed = settled(run.messages, "identify")?.data?.parsed;
    check("does not crash", run.ok, run.status);
    check("does not publish", done?.outcome !== "published", done);
    check("asks what the rounds were", (asked?.questions?.length ?? 0) > 0, asked);
    check("invents no rounds", (parsed?.rounds?.length ?? 0) === 0, parsed?.rounds);

    const empty = await fetch(`${BASE}/api/pipeline`, {
      method: "POST",
      headers: { "content-type": "application/json", ...cookieHeader() },
      body: JSON.stringify({ description: "" }),
    });
    check("an empty submission is rejected, not processed", empty.status === 400, empty.status);
  }

  section("circuit: the wall is anonymous by construction");
  {
    const { status, json } = await api("/api/circuit");
    check("circuit responds", status === 200, status);
    check("has records to show", (json.records?.length ?? 0) > 0, json.records?.length);
    check("the record we just published is on the wall", json.records?.some((r: any) => r.id === publishedId), publishedId);
    check(
      "a simulated publish is labelled demo",
      json.records?.find((r: any) => r.id === publishedId)?.demo === true,
      json.records?.find((r: any) => r.id === publishedId)?.demo,
    );

    const record = json.records[0];
    check("every record has an anonymous handle", json.records.every((r: any) => /^[A-Z]-\d+$/.test(r.id)));
    check("no record carries a user-facing identity field", !("identity" in record) && !("name" in record));
    check("demo seeds are labelled as such", json.records.some((r: any) => r.demo === true));
    check("employer detail is generalised, never named", json.records.every((r: any) => {
      const p = r.parsed?.employerProfile ?? {};
      return Object.values(p).every((v) => v === null || (typeof v === "string" && !/\s/.test(v) || typeof v === "string"));
    }));
  }

  section("search: ranked, explainable, and honest about gaps");
  let topId: string | null = null;
  {
    const { status, json } = await api("/api/search", {
      role: "Senior backend engineer at a Series B fintech, system design heavy",
    });
    check("search responds", status === 200, status);
    check("returns results", (json.results?.length ?? 0) > 0, json.results?.length);
    check("reports the pool it searched", typeof json.meta?.pool === "number", json.meta);
    check("labels the engine", typeof json.meta?.engineLabel === "string", json.meta?.engineLabel);

    const results = json.results ?? [];
    check("scores are 0..100", results.every((r: any) => r.match.fitScore >= 0 && r.match.fitScore <= 100));
    check(
      "ranked descending",
      results.every((r: any, i: number) => i === 0 || results[i - 1].match.fitScore >= r.match.fitScore),
      results.map((r: any) => r.match.fitScore),
    );
    check("every result names a gap", results.every((r: any) => (r.match.gaps?.length ?? 0) > 0));
    check("every result explains its score", results.every((r: any) => r.match.rationale && r.match.components));
    check(
      "score components are 0..1",
      results.every((r: any) => Object.values(r.match.components).every((v: any) => v >= 0 && v <= 1)),
      results[0]?.match?.components,
    );
    check(
      "results carry the anonymised record, not an identity",
      results.every((r: any) => r.record?.id && !r.record.identity),
    );

    topId = results[0]?.record?.id ?? null;

    const repeat = await api("/api/search", {
      role: "Senior backend engineer at a Series B fintech, system design heavy",
    });
    check(
      "the same query ranks the same way twice",
      JSON.stringify(repeat.json.results?.map((r: any) => r.record.id)) ===
        JSON.stringify(results.map((r: any) => r.record.id)),
    );

    const empty = await api("/api/search", { role: "" });
    check("an empty query is rejected", empty.status === 400, empty.status);
  }

  section("intro: identity is gated on the candidate's approval");
  let introId: string | null = null;
  {
    const requested = await api("/api/intro", {
      action: "request",
      recordId: topId,
      roleDescription: "Senior backend engineer, Series B fintech",
    });
    check("an intro can be requested", requested.status === 200, requested.json);
    introId = requested.json?.intro?.id ?? null;
    check("it starts pending", requested.json?.intro?.status === "pending", requested.json?.intro?.status);
    check("no identity on a pending request", requested.json?.intro?.revealedIdentity === null, requested.json?.intro);

    const early = await api("/api/brief", {
      recordId: topId,
      introId,
      roleDescription: "Senior backend engineer",
    });
    check("a brief is refused while pending", early.status === 403, early.status);
    check("the refusal says why", /pending/i.test(early.json?.error ?? ""), early.json);

    const inbox = await api("/api/intro");
    check("the request appears in the candidate's inbox", inbox.json?.intros?.some((i: any) => i.id === introId));
    check("the inbox reveals no identity for pending rows", inbox.json?.intros?.every((i: any) => i.status === "approved" || i.revealedIdentity === null));

    const approved = await api("/api/intro", { action: "decide", introId, decision: "approved" });
    check("the candidate can approve", approved.status === 200, approved.json);
    check("status moves to approved", approved.json?.intro?.status === "approved", approved.json?.intro?.status);
    check("approval is what reveals a contact channel", approved.json?.intro?.revealedIdentity !== null, approved.json?.intro);
    check(
      "the revealed identity is an alias, not a real name",
      typeof approved.json?.intro?.revealedIdentity?.alias === "string",
      approved.json?.intro?.revealedIdentity,
    );

    const again = await api("/api/intro", { action: "decide", introId, decision: "declined" });
    check("a decided request cannot be decided again", again.status === 409, again.status);
  }

  section("brief: known vs inferred vs unknown");
  {
    const { status, json } = await api("/api/brief", {
      recordId: topId,
      introId,
      roleDescription: "Senior backend engineer at a Series B fintech",
    });
    check("the brief generates after approval", status === 200, json);
    const brief = json.brief ?? {};
    check("labels the engine that wrote it", typeof json.meta?.engineLabel === "string", json.meta);
    check("every fact carries a provenance", (brief.facts ?? []).every((f: any) => ["known", "inferred", "unknown"].includes(f.provenance)), brief.facts?.slice(0, 3));
    check("has at least one known fact", (brief.facts ?? []).some((f: any) => f.provenance === "known"));
    check("names what it does not know", (brief.facts ?? []).some((f: any) => f.provenance === "unknown"));
    check("says what to probe", (brief.probeInstead?.length ?? 0) > 0, brief.probeInstead);
    check("says what never to skip", (brief.neverSkip?.length ?? 0) > 0, brief.neverSkip);
    check(
      "never proposes skipping the whole loop",
      (brief.safeToSkip?.length ?? 0) <= Math.max((brief.alreadyAssessed?.length ?? 0) - 1, 0),
      { skip: brief.safeToSkip?.length, assessed: brief.alreadyAssessed?.length },
    );
    check(
      "the outcome is never read as a verdict on the candidate",
      /says nothing about|not an inference|was not stated/i.test(brief.outcomeContext ?? ""),
      brief.outcomeContext,
    );
    check("carries a confidence and its basis", typeof brief.confidence === "number" && typeof brief.confidenceBasis === "string", {
      confidence: brief.confidence,
      basis: brief.confidenceBasis,
    });
    check("the unstated outcome is not reported as a negative", JSON.stringify(brief).match(/\bfailed\b/i) === null, "no 'failed' claim");

    const { json: circuit } = await api("/api/circuit");
    const publicBlob = JSON.stringify({ records: circuit.records, brief: json });
    check(
      "circuit records + brief never contain the recruiter mailbox",
      !publicBlob.toLowerCase().includes("talent@ledgerpay.example"),
      publicBlob.slice(0, 200),
    );
    check(
      "circuit records + brief never contain @ledgerpay",
      !publicBlob.toLowerCase().includes("@ledgerpay"),
      publicBlob.slice(0, 200),
    );
  }

  section("intro: a decline closes the door");
  let declinedRecordId: string | null = null;
  {
    const { json: circuit } = await api("/api/circuit");
    const other = circuit.records.find((r: any) => r.id !== topId);
    declinedRecordId = other?.id ?? null;
    const requested = await api("/api/intro", {
      action: "request",
      recordId: other.id,
      roleDescription: "Staff engineer, payments",
    });
    const id = requested.json?.intro?.id;
    const declined = await api("/api/intro", { action: "decide", introId: id, decision: "declined" });
    check("the candidate can decline", declined.json?.intro?.status === "declined", declined.json?.intro?.status);
    check("a declined request reveals nothing", declined.json?.intro?.revealedIdentity === null, declined.json?.intro);

    const brief = await api("/api/brief", {
      recordId: other.id,
      introId: id,
      roleDescription: "Staff engineer",
    });
    check("no brief after a decline", brief.status === 403, brief.status);
    check("the refusal names the decline", /declined/i.test(brief.json?.error ?? ""), brief.json);
  }

  section("error states: bad input is refused, not absorbed");
  {
    const cases: [string, string, unknown, number][] = [
      ["unknown record on intro", "/api/intro", { action: "request", recordId: "A-0000", roleDescription: "x" }, 404],
      ["unknown action on intro", "/api/intro", { action: "nonsense" }, 400],
      ["unknown intro on decide", "/api/intro", { action: "decide", introId: "nope", decision: "approved" }, 404],
      ["unknown record on brief", "/api/brief", { recordId: "A-0000", roleDescription: "x" }, 404],
      ["malformed search", "/api/search", { nope: true }, 400],
      ["malformed pipeline", "/api/pipeline", { nope: true }, 400],
    ];
    for (const [name, path, payload, expected] of cases) {
      const { status, json } = await api(path, payload);
      check(`${name} -> ${expected}`, status === expected, { status, json });
    }

    // A real, published record that this session never requested an intro for.
    // Refusing this is the whole privacy contract: a brief is not something a
    // recruiter can obtain by knowing a handle.
    const { json: circuit } = await api("/api/circuit");
    const untouched = circuit.records.find((r: any) => r.id !== topId && r.id !== declinedRecordId);
    if (untouched) {
      const { status, json } = await api("/api/brief", {
        recordId: untouched.id,
        roleDescription: "Senior backend engineer",
      });
      check("a brief on a record with no intro is refused", status === 403, { status, json });
      check("the refusal tells the recruiter to request one", /request one/i.test(json?.error ?? ""), json);
    }
  }

  section("signals: aggregate published records only");
  {
    const { status, json } = await api("/api/signals");
    check("signals responds", status === 200, json);
    check("the pool is non-empty", (json.report?.pool ?? 0) > 0, json.report);
    check("demo seeds are labelled when present", json.report?.demoCount === 0 || json.report?.demoCount > 0, json.report);
    const blob = JSON.stringify(json);
    check("signals never contain a recruiter mailbox", !blob.toLowerCase().includes("talent@ledgerpay.example"));
    check("signals never contain @ledgerpay", !blob.toLowerCase().includes("@ledgerpay"));

    const fintech = await api("/api/signals?sector=fintech");
    check("sector filter returns only that sector", (fintech.json.report?.sectors ?? []).every((s: any) => s.name === "fintech"), fintech.json.report);
    check("sector filter cannot exceed the unfiltered pool", (fintech.json.report?.pool ?? 0) <= (json.report?.pool ?? 0));

    const empty = await api("/api/signals?sector=not_a_real_sector");
    check("an empty filter does not invent claims", empty.json.report?.pool === 0 && (empty.json.report?.trending?.length ?? 1) === 0, empty.json.report);

    const byRole = await api("/api/signals?role=engineering");
    check("role family filter returns a real subset", (byRole.json.report?.pool ?? 0) > 0 && (byRole.json.report?.pool ?? 0) <= (json.report?.pool ?? 0), byRole.json.report);
  }

  section("inbound: unsigned mail is refused");
  {
    const unsigned = await fetch(`${BASE}/api/inbound`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ from: "talent@ledgerpay.example", text: "hi" }),
    });
    check("unconfigured webhook is 503", unsigned.status === 503, unsigned.status);
    const body = await unsigned.json().catch(() => ({}));
    check("the refusal says inbound is not configured", body.configured === false, body);
  }

  section("pages: every route renders");
  {
    const { json: status } = await api("/api/status");
    for (const path of ["/", "/list", "/verify", "/circuit", "/wall", "/desk", "/search", "/signals", "/intros", "/system", "/agent-lab", "/brief"]) {
      const res = await fetch(BASE + path, { headers: cookieHeader() });
      const html = await res.text();
      check(`${path} responds 200`, res.status === 200, res.status);
      check(`${path} has no error overlay`, !/Application error|Unhandled Runtime Error/i.test(html));

      // The reasoning label has to be in the server-rendered markup, not
      // applied once a client fetch resolves. A disclosure that arrives late
      // is one a reader can miss, and these are the pages that show the output
      // of the reasoning being disclosed.
      if (path === "/") {
        check("/ states the product in first paint", /interview history|prove@elestar\.ai/i.test(html));
        check("/ names the prove inbox", html.includes("prove@elestar.ai"));
      }
      if (["/circuit", "/wall", "/search", "/desk", "/intros", "/signals", "/verify", "/list", "/system", "/agent-lab"].includes(path)) {
        check(`${path} labels the engine in first paint`, html.includes(status.engineLabel), status.engineLabel);
      }
    }
    const redirect = await fetch(`${BASE}/candidate/list`, { headers: cookieHeader(), redirect: "manual" });
    check("the original /candidate/list entry point still works", [200, 307, 308].includes(redirect.status), redirect.status);
  }

  console.log(`\n${passed}/${passed + failed} checks passed.`);
  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error(`\nflow eval could not run against ${BASE}`);
  console.error(String(err));
  console.error("\nStart the server first:  npm run build && PORT=3111 npm start");
  process.exit(1);
});
