export default function NotFound() {
  return (
    <main className="min-h-[60dvh] grid place-items-center px-6 text-center">
      <div>
        <p className="font-mono text-[11px] uppercase tracking-[0.16em] mb-3" style={{ color: "var(--ink-3)" }}>
          404
        </p>
        <h1 className="edn-lg mb-3" style={{ color: "var(--navy)" }}>
          That page is not on Elestar.
        </h1>
        <a href="/" className="font-mono text-[12px] uppercase tracking-[0.14em]" style={{ color: "var(--navy)" }}>
          Back to the start
        </a>
      </div>
    </main>
  );
}
