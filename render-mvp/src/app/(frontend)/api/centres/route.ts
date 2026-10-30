import { demoCentres } from '@/lib/demo-store'
export const dynamic = 'force-dynamic'
export function GET() {
  return Response.json({ docs: demoCentres, totalDocs: demoCentres.length, limit: demoCentres.length, page: 1, totalPages: 1, hasNextPage: false }, { headers: { 'Cache-Control': 'no-store' } })
}
