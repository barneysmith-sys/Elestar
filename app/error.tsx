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
        <p className="type-label mb-3">Elestar</p>
        <h1 className="type-section mb-3">The page hit a snag.</h1>
        <button type="button" onClick={reset} className="type-nav">
          Try again
        </button>
      </div>
    </main>
  );
}
