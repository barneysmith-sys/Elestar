import { engineLabel, reasoningEngine } from "../lib/capabilities";

/** Server-rendered honesty label so first paint discloses the engine. */
export function EngineMark() {
  return <span className="sr-only">{engineLabel(reasoningEngine())}</span>;
}
