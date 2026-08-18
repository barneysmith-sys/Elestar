import { SignalsClient } from "../../components/SignalsClient";
import { engineLabel, reasoningEngine } from "../../lib/capabilities";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Signals — Elestar",
  description: "Aggregate intelligence from verified, anonymous interview processes.",
};

export default function SignalsPage() {
  const engine = reasoningEngine();
  return <SignalsClient initialEngine={engine} initialEngineLabel={engineLabel(engine)} />;
}
