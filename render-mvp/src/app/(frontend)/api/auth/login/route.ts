import { authenticateServerAccount, createSessionCookie } from '@/lib/server-auth'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as { id?: string; pin?: string } | null
  if (!body?.id || !body.pin) return Response.json({ error: 'Enter your account ID and PIN.' }, { status: 400 })
  let identity
  try { identity = authenticateServerAccount(body.id, body.pin) } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : 'Authentication is not configured.' }, { status: 503 })
  }
  if (!identity) return Response.json({ error: 'Account ID or PIN is incorrect.' }, { status: 401 })
  const secure = process.env.NODE_ENV === 'production'
  return Response.json({ identity }, { headers: { 'Set-Cookie': createSessionCookie(identity, secure), 'Cache-Control': 'no-store' } })
}
