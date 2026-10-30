import { clearSessionCookie } from '@/lib/server-auth'
export const dynamic = 'force-dynamic'
export function POST() {
  const secure = process.env.NODE_ENV === 'production'
  return Response.json({ ok: true }, { headers: { 'Set-Cookie': clearSessionCookie(secure), 'Cache-Control': 'no-store' } })
}
