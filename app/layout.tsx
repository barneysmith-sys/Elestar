import type { Metadata } from "next";
import "../web/src/index.css";
import { ProductShell } from "../web/src/shell";

const SITE_TITLE = "Elestar - Agents make the hiring experience, what it deserves.";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: SITE_TITLE,
  applicationName: "Elestar",
  description:
    "Your interview history shouldn't disappear when you don't get the job. Forward the recruiter email to prove@elestar.ai.",
  icons: {
    icon: [{ url: "/favicon.png", type: "image/png" }],
    apple: [{ url: "/apple-icon.png", type: "image/png" }],
  },
  openGraph: {
    title: SITE_TITLE,
    siteName: "Elestar",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: SITE_TITLE,
  },
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
