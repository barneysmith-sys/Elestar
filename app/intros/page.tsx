import { IntrosClient } from "../../components/IntrosClient";
import { engineLabel, reasoningEngine } from "../../lib/capabilities";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Intros — Elestar",
  description: "The approval gate: the only path by which an identity reaches a recruiter.",
};

export default function IntrosPage() {
  const engine = reasoningEngine();
  return <IntrosClient initialEngine={engine} initialEngineLabel={engineLabel(engine)} />;
}
