import type { Metadata } from "next";
import "../web/src/index.css";
import { ProductShell } from "../web/src/shell";

export const metadata: Metadata = {
  title: "Elestar — keep the interviews that didn't become a job",
  description:
    "Your interview history shouldn't disappear when you don't get the job. Forward the recruiter email to prove@elestar.ai.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <ProductShell>{children}</ProductShell>
      </body>
    </html>
  );
}
