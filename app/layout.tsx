import type { Metadata } from "next";
import "./globals.css";
import { Nav } from "../components/Nav";

export const metadata: Metadata = {
  title: "Elestar — an intelligence layer for hiring",
  description:
    "Interview processes contain valuable intelligence. Elestar captures it, verifies it, protects it, and makes it reusable.",
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
