"use client";

import { type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { RouterProvider } from "./router";
import LandingField from "./components/LandingField";
import EyeFade from "./components/EyeFade";
import Toast from "./components/Toast";

export function ProductShell({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? "/";
  const landing = pathname === "/";

  return (
    <RouterProvider>
      {landing ? <LandingField /> : <EyeFade tone="site" />}
      <div className="grain" aria-hidden="true" />
      <div className="vignette" aria-hidden="true" />
      <div className="relative z-[1]">{children}</div>
      <Toast />
    </RouterProvider>
  );
}
