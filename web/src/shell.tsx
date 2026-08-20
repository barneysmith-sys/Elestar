"use client";

import { type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { RouterProvider } from "./router";
import EyeFade from "./components/EyeFade";
import Toast from "./components/Toast";

export function ProductShell({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? "/";
  const product =
    pathname.startsWith("/wall") ||
    pathname.startsWith("/circuit") ||
    pathname.startsWith("/desk") ||
    pathname.startsWith("/search") ||
    pathname.startsWith("/verify") ||
    pathname.startsWith("/signals") ||
    pathname.startsWith("/intros") ||
    pathname.startsWith("/system") ||
    pathname.startsWith("/brief") ||
    pathname.startsWith("/list");

  return (
    <RouterProvider>
      {product ? <EyeFade tone="site" /> : null}
      <div className="grain" aria-hidden="true" />
      <div className="vignette" aria-hidden="true" />
      <div className="relative z-[1]">{children}</div>
      <Toast />
    </RouterProvider>
  );
}
