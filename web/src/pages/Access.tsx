"use client"

import { FormEvent, useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import { useRouter, type Role } from "../router"
import Logo from "../brand"
import poster from "../assets/elestarr-poster.png"
import { createAccount, fetchAuth, signInAccount } from "../elestar-api"

export default function Access() {
  const { intent, setIntent, applySession } = useRouter()
  const search = useSearchParams()
  const [mode, setMode] = useState<"create" | "signin">("create")
  const [role, setRole] = useState<Role>(intent)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [accounts, setAccounts] = useState<boolean | null>(null)

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
    setError(null)
    setBusy(true)
    try {
      const session = mode === "create"
        ? await createAccount({ email, password, role })
        : await signInAccount({ email, password })
      applySession(session)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not continue.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="min-h-[100dvh] grid lg:grid-cols-[1.05fr_0.95fr]" style={{ background: "transparent", color: "var(--foreground)" }}>
      <div
        className="relative hidden lg:flex items-center justify-center p-8 xl:p-10 border-r"
        style={{ borderColor: "var(--border)", background: "var(--background)" }}
      >
        <img
          src={poster}
          alt="Elestar editorial poster with halftone eye illustration and brand tagline about work and what you look at"
          className="max-h-full max-w-full w-auto h-auto object-contain"
        />
      </div>

      <div className="flex items-center justify-center p-8 md:p-10">
        <form className="w-full max-w-[360px]" onSubmit={onSubmit}>
          <div className="lg:hidden mb-8">
            <Logo />
          </div>
          <h1 className="edn-lg" style={{ color: "var(--navy)" }}>
            {mode === "create"
              ? role === "creative" ? "Create a candidate account" : "Create a hiring account"
              : "Sign in"}
          </h1>
          <p className="text-[16px] mt-3" style={{ color: "var(--muted-foreground)" }}>
            {role === "creative"
              ? "Show your work. Prove one interview with the original email. Not the inbox."
              : "Look at the work first. Then see how far they already got."}
          </p>

          {mode === "create" ? (
            <div className="flex p-[3px] rounded-[10px] border mt-[22px] mb-[18px]" style={{ background: "var(--secondary)", borderColor: "var(--border)" }}>
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
                  className="flex-1 font-mono text-xs py-[9px] rounded-lg transition-colors"
                  style={{
                    background: role === r.id ? "var(--foreground)" : "transparent",
                    color: role === r.id ? "var(--background)" : "var(--muted-foreground)",
                  }}
                >
                  {r.label}
                </button>
              ))}
            </div>
          ) : (
            <div className="mt-[22px] mb-[18px]" />
          )}

          <div className="mb-[13px]">
            <label className="block font-mono text-[10.5px] uppercase tracking-[0.06em] mb-1.5" style={{ color: "var(--muted-foreground)" }}>Work email</label>
            <input
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@studio.com"
              className="w-full border rounded-[10px] px-[13px] py-3 text-sm outline-none"
              style={{ borderColor: "var(--border-2)", background: "var(--card)", color: "var(--foreground)" }}
            />
          </div>
          <div className="mb-[13px]">
            <label className="block font-mono text-[10.5px] uppercase tracking-[0.06em] mb-1.5" style={{ color: "var(--muted-foreground)" }}>Password</label>
            <input
              type="password"
              autoComplete={mode === "create" ? "new-password" : "current-password"}
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 8 characters"
              className="w-full border rounded-[10px] px-[13px] py-3 text-sm outline-none"
              style={{ borderColor: "var(--border-2)", background: "var(--card)", color: "var(--foreground)" }}
            />
          </div>

          {error ? (
            <p className="text-[14px] mb-3" style={{ color: "var(--navy)" }}>{error}</p>
          ) : null}

          {accounts === false ? (
            <p className="text-[14px] mb-3" style={{ color: "var(--muted-foreground)" }}>
              Accounts are not live on this host yet. Supabase keys still need to be set.
            </p>
          ) : null}

          <button
            type="submit"
            disabled={busy || accounts !== true}
            className="w-full mt-2 py-3.5 font-mono text-[13.5px] text-[var(--primary-foreground)] active:translate-y-px active:scale-[0.99] disabled:opacity-50"
            style={{ background: "var(--navy)" }}
          >
            {busy ? "Working…" : mode === "create" ? "Create account" : "Sign in"}
          </button>
          <button
            type="button"
            onClick={() => {
              setMode(mode === "create" ? "signin" : "create")
              setError(null)
            }}
            className="w-full font-mono text-[10px] text-center mt-3.5"
            style={{ color: "var(--ink-3)" }}
          >
            {mode === "create" ? "Already have an account? Sign in" : "Need an account? Create one"}
          </button>
        </form>
      </div>
    </div>
  )
}
