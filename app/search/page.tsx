import { SearchClient } from "../../components/SearchClient";
import { engineLabel, reasoningEngine } from "../../lib/capabilities";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Search — Elestar",
  description: "Search the intelligence pool and get ranked, explainable matches.",
};

export default function SearchPage() {
  const engine = reasoningEngine();
  return <SearchClient initialEngine={engine} initialEngineLabel={engineLabel(engine)} />;
}
