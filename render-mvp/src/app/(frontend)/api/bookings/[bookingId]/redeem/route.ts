import { getDemoIdentity } from '@/lib/server-auth'
import { redeemBooking, serializeBooking, updateStore } from '@/lib/demo-store'
export const dynamic = 'force-dynamic'
export async function POST(request: Request, context: { params: Promise<{ bookingId: string }> }) {
  const identity = getDemoIdentity(request)
  if (!identity || identity.role !== 'operator' || !identity.centreId) return Response.json({ error: 'Depot operator sign-in is required.' }, { status: 403 })
  const { bookingId } = await context.params
  const body = await request.json().catch(() => null) as { otp?: string } | null
  if (!body?.otp) return Response.json({ error: 'Enter the farmer token OTP.' }, { status: 400 })
  try {
    const booking = await updateStore((state) => redeemBooking(state, Number(bookingId), identity.id, identity.centreId!, body.otp!))
    return Response.json({ booking: serializeBooking(booking, false) }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) { return Response.json({ error: error instanceof Error ? error.message : 'Could not redeem token.' }, { status: 400 }) }
}
