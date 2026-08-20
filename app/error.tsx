"use client";

export default function Error({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="min-h-[60dvh] grid place-items-center px-6 text-center">
      <div>
        <p className="font-mono text-[11px] uppercase tracking-[0.16em] mb-3" style={{ color: "var(--ink-3)" }}>
          Elestar
        </p>
        <h1 className="edn-lg mb-3" style={{ color: "var(--navy)" }}>
          The page hit a snag.
        </h1>
        <button
          type="button"
          onClick={reset}
          className="font-mono text-[12px] uppercase tracking-[0.14em]"
          style={{ color: "var(--navy)" }}
        >
          Try again
        </button>
      </div>
    </main>
  );
}
