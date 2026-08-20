import { redirect } from "next/navigation";

export default function CandidateListRedirect() {
  redirect("/verify");
}
