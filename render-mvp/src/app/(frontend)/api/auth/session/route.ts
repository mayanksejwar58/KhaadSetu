import { getDemoIdentity } from '@/lib/server-auth'
export const dynamic = 'force-dynamic'
export function GET(request: Request) {
  return Response.json({ identity: getDemoIdentity(request) }, { headers: { 'Cache-Control': 'no-store' } })
}
