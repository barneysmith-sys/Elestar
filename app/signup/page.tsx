import { Suspense } from "react"
import Access from "../../web/src/pages/Access"

export const dynamic = "force-dynamic"

export default function SignupPage() {
  return (
    <Suspense>
      <Access />
    </Suspense>
  )
}
