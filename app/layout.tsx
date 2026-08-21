import type { Metadata } from "next";
import "../web/src/index.css";
import { ProductShell } from "../web/src/shell";
import { AuthReturn } from "../web/src/components/AuthReturn";

const SITE_TITLE = "Elestar — The round happened. Prove it once.";
const SITE_DESCRIPTION =
  "Your interview history shouldn't disappear when you don't get the job. Forward the recruiter email to prove@elestar.ai.";

export const metadata: Metadata = {
  metadataBase: new URL("https://elestar.ai"),
  title: SITE_TITLE,
  applicationName: "Elestar",
  description: SITE_DESCRIPTION,
  icons: {
    icon: [{ url: "/favicon.png", type: "image/png" }],
    apple: [{ url: "/apple-touch-icon.png", type: "image/png" }],
  },
  openGraph: {
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    siteName: "Elestar",
    type: "website",
    url: "/",
  },
  twitter: {
    card: "summary",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <ProductShell>
          <AuthReturn />
          {children}
        </ProductShell>
      </body>
    </html>
  );
}
