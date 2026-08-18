import { Suspense } from "react";
import { BriefClient } from "../../components/BriefClient";
import { Label } from "../../components/primitives";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Interview brief — Elestar",
  description: "What a prior process established, separated into known, inferred and unknown.",
};

export default async function BriefPage({
  searchParams,
}: {
  searchParams: Promise<{ recordId?: string; introId?: string; role?: string }>;
}) {
  const params = await searchParams;

  return (
    <Suspense
      fallback={
        <div className="wrap-narrow section">
          <Label>Loading brief…</Label>
        </div>
      }
    >
      <BriefClient
        recordId={params.recordId ?? null}
        introId={params.introId ?? null}
        role={params.role ?? null}
      />
    </Suspense>
  );
}
