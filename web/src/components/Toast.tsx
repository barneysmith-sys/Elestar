"use client"

import { useRouter } from "../router"

export default function Toast() {
  const { toast } = useRouter()
  if (!toast) return null
  return (
    <div
      className="fixed bottom-[26px] left-1/2 z-[100] px-[19px] py-[13px] rounded-xl text-[13.5px] text-white flex gap-2 max-w-[90vw] shadow-[0_20px_40px_-16px_rgba(25,26,29,.5)]"
      style={{ background: "var(--foreground)", transform: "translateX(-50%)" }}
      dangerouslySetInnerHTML={{ __html: toast }}
    />
  )
}
