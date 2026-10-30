import { getDemoIdentity } from '@/lib/server-auth'
import { confirmBooking, serializeBooking, updateStore } from '@/lib/demo-store'
export const dynamic = 'force-dynamic'
export async function POST(request: Request, context: { params: Promise<{ bookingId: string }> }) {
  const identity = getDemoIdentity(request)
  if (!identity || identity.role !== 'farmer') return Response.json({ error: 'Farmer sign-in is required.' }, { status: 403 })
  const { bookingId } = await context.params
  try {
    const booking = await updateStore((state) => confirmBooking(state, Number(bookingId), identity.id))
    return Response.json({ booking: serializeBooking(booking, true) }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) { return Response.json({ error: error instanceof Error ? error.message : 'Could not confirm booking.' }, { status: 400 }) }
}
