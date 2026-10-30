import { inventoryWithAvailability, readStore } from '@/lib/demo-store'
export const dynamic = 'force-dynamic'
export async function GET() {
  const docs = await readStore((state) => inventoryWithAvailability(state))
  return Response.json({ docs, totalDocs: docs.length, limit: docs.length, page: 1, totalPages: 1, hasNextPage: false }, { headers: { 'Cache-Control': 'no-store' } })
}
