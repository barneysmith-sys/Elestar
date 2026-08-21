"use client"

import { FormEvent, useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import { useRouter, type Role } from "../router"
import Logo from "../brand"
import ResolveCanvas from "../components/ResolveCanvas"
import ResolveRecord from "../components/ResolveRecord"
import { createAccount, fetchAuth, resendConfirmation, signInAccount } from "../elestar-api"

export default function Access() {
  const { intent, setIntent, applySession, navigate } = useRouter()
  const search = useSearchParams()
  const [mode, setMode] = useState<"create" | "signin">("create")
  const [role, setRole] = useState<Role>(intent)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [accounts, setAccounts] = useState<boolean | null>(null)
  const [pendingEmail, setPendingEmail] = useState<string | null>(null)

  useEffect(() => {
    const next = search.get("intent")
    const nextMode = search.get("mode")
    if (next === "firm" || next === "employer") {
      setIntent("firm")
      setRole("firm")
    } else if (next === "creative" || next === "candidate") {
      setIntent("creative")
      setRole("creative")
    }
    if (nextMode === "signin") setMode("signin")
    const reason = search.get("reason")
    if (reason === "confirm-failed") setError("That confirmation link could not finish sign-in. Request a new email or try signing in.")
    if (reason === "missing-code") setMode("signin")
  }, [search, setIntent])

  useEffect(() => {
    setRole(intent)
  }, [intent])

  useEffect(() => {
    fetchAuth()
      .then((session) => {
        setAccounts(session.accounts ?? false)
        if (session.authenticated) applySession(session)
      })
      .catch(() => setAccounts(false))
  }, [applySession])

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    if (accounts === false) return
    setError(null)
    setBusy(true)
    try {
      const session = mode === "create"
        ? await createAccount({ email, password, role })
        : await signInAccount({ email, password })
      if (session.pendingConfirmation) {
        setPendingEmail(session.email ?? email)
        return
      }
      applySession(session)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not continue.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="access-stage">
      <div className="access-exhibit">
        <div className="access-lockup">
          <ResolveCanvas />
          <ResolveRecord />
        </div>
      </div>

      <div className="flex items-center justify-center p-8 md:p-10">
        <form className="w-full max-w-[360px]" onSubmit={onSubmit}>
          <button type="button" className="mb-8" onClick={() => navigate("landing")} aria-label="Elestar home">
            <Logo />
          </button>
          <h1 className="type-section">
            {mode === "create" ? "Create an account" : "Sign in"}
          </h1>
          {pendingEmail ? (
            <>
              <p className="type-lede" style={{ marginTop: 22 }}>
                Account created. Confirm <span className="font-mono">{pendingEmail}</span>. The
                link returns you to Elestar signed in. After that, candidates land on Verify
                with the live email pipeline.
              </p>
              <button
                type="button"
                className="btn btn-fill w-full mt-6"
                disabled={busy}
                onClick={() => {
                  setBusy(true);
                  void resendConfirmation(pendingEmail)
                    .then(() => setError("Another confirmation email is on the way."))
                    .catch((err: unknown) => setError(err instanceof Error ? err.message : "Could not resend."))
                    .finally(() => setBusy(false));
                }}
              >
                {busy ? "Sending…" : "Resend confirmation"}
              </button>
              <button
                type="button"
                className="btn w-full mt-3"
                onClick={() => { setPendingEmail(null); setMode("signin") }}
              >
                I already confirmed — sign in
              </button>
              {error ? (
                <p className="type-caption mt-3" style={{ color: "var(--ink)" }}>{error}</p>
              ) : null}
            </>
          ) : (
            <>
          <p className="type-lede">
            {mode === "signin"
              ? "Come back to the work and the proved round. The result stays off the profile."
              : role === "creative"
                ? "Show the work. Prove how far you got with one original email. The result stays private."
                : "Look at the work. Then the company and how far they already got. You do not see the outcome."}
          </p>
          {mode === "create" ? (
            <div className="flex p-[3px] border mt-[22px] mb-3" style={{ background: "var(--stock)", borderColor: "var(--rule)" }}>
              {([
                { id: "creative" as const, label: "I'm a candidate" },
                { id: "firm" as const, label: "I'm hiring" },
              ]).map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => {
                    setRole(r.id)
                    setIntent(r.id)
                  }}
                  className="flex-1 type-cta py-[9px] transition-colors"
                  style={{
                    background: role === r.id ? "var(--ink)" : "transparent",
                    color: role === r.id ? "var(--stock)" : "var(--ink-mid)",
                  }}
                >
                  {r.label}
                </button>
              ))}
            </div>
          ) : null}

          <div className={`flex gap-4 mb-[18px] ${mode === "signin" ? "mt-[22px]" : ""}`}>
            <button
              type="button"
              className="type-nav"
              onClick={() => { setMode("create"); setError(null) }}
              style={{ opacity: mode === "create" ? 1 : 0.45 }}
            >
              Create account
            </button>
            <button
              type="button"
              className="type-nav"
              onClick={() => { setMode("signin"); setError(null) }}
              style={{ opacity: mode === "signin" ? 1 : 0.45 }}
            >
              Sign in
            </button>
          </div>

          <div className="mb-[13px]">
            <label className="block type-label mb-1.5">Work email</label>
            <input
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@studio.com"
              className="field field-mono"
            />
          </div>
          <div className="mb-[13px]">
            <label className="block type-label mb-1.5">Password</label>
            <input
              type="password"
              autoComplete={mode === "create" ? "new-password" : "current-password"}
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 8 characters"
              className="field field-mono"
            />
          </div>

          {error ? (
            <p className="type-caption mb-3" style={{ color: "var(--ink)" }}>{error}</p>
          ) : null}

          {accounts === false ? (
            <p className="type-caption mb-3">
              Accounts are not live on this host yet. Demo mode still lets you walk the product. Set the Supabase URL and publishable key to persist sign-in. The service role key is not required to create an account.
            </p>
          ) : null}

          <button
            type="submit"
            disabled={busy}
            className="btn btn-fill w-full mt-2 disabled:opacity-60"
          >
            {busy ? "Saving..." : mode === "create" ? "Create account" : "Sign in"}
          </button>
          <p className="type-caption text-center mt-3.5">
            Employers see company and farthest round. Not the result. Not the assignment.
          </p>
            </>
          )}
        </form>
      </div>
    </div>
  )
}
