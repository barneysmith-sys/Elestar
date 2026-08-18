import { CircuitClient } from "../../components/CircuitClient";
import { engineLabel, reasoningEngine } from "../../lib/capabilities";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Circuit — Elestar",
  description: "The intelligence network: anonymous, verified interview records.",
};

export default function CircuitPage() {
  const engine = reasoningEngine();
  return <CircuitClient initialEngine={engine} initialEngineLabel={engineLabel(engine)} />;
}
