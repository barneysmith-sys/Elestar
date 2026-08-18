import { redirect } from "next/navigation";

/**
 * The listing flow moved to /list when it grew past a form and a status list.
 *
 * Kept as a redirect rather than deleted: this was the original entry point and
 * anything already pointing at it should keep working.
 */
export default function CandidateListPage() {
  redirect("/list");
}
