import type { Metadata } from "next";
import "./globals.css";
import { Nav } from "../components/Nav";

export const metadata: Metadata = {
  title: "Elestar — keep the interviews that didn't become a job",
  description:
    "Your interview history shouldn't disappear when you don't get the job. Forward the recruiter email to prove@elestar.ai.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {/* Grain and vignette sit above everything and take no pointer events. */}
        <div className="grain" aria-hidden="true" />
        <div className="vignette" aria-hidden="true" />
        <Nav />
        <main className="page">{children}</main>
      </body>
    </html>
  );
}
