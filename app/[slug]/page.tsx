import { notFound } from "next/navigation"
import Info from "../../web/src/pages/Info"
import { INFO_SLUGS } from "../../web/src/site-paths"

export const dynamic = "force-dynamic"

export default async function InfoSlugPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  if (!INFO_SLUGS.has(slug)) notFound()
  return <Info />
}
