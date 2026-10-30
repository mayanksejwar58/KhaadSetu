import { getDemoIdentity } from '@/lib/server-auth'
import { createBooking, listBookingsForFarmer, listBookingsForOperator, serializeBooking, updateStore } from '@/lib/demo-store'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const identity = getDemoIdentity(request)
  if (!identity) return Response.json({ error: 'Sign in is required.' }, { status: 401 })
  const bookings = await updateStore((state) => identity.role === 'farmer'
    ? listBookingsForFarmer(state, identity.id).map((item) => serializeBooking(item, true))
    : listBookingsForOperator(state, identity.centreId ?? '').map((item) => serializeBooking(item, false)))
  return Response.json({ docs: bookings }, { headers: { 'Cache-Control': 'no-store' } })
}

export async function POST(request: Request) {
  const identity = getDemoIdentity(request)
  if (!identity || identity.role !== 'farmer') return Response.json({ error: 'Farmer sign-in is required.' }, { status: 403 })
  const body = await request.json().catch(() => null) as { reportId?: string; centreId?: string; productCode?: string; quantityBags?: number; idempotencyKey?: string } | null
  if (!body?.reportId || !body.centreId || !body.productCode) return Response.json({ error: 'Report, depot and fertilizer product are required.' }, { status: 400 })
  if (!['UREA', 'DAP', 'NPK', 'MOP'].includes(body.productCode)) return Response.json({ error: 'Unsupported fertilizer product.' }, { status: 400 })
  try {
    const booking = await updateStore((state) => createBooking(state, {
      farmerId: identity.id,
      farmerName: identity.name,
      reportId: body.reportId!,
      centreId: body.centreId!,
      productCode: body.productCode as 'UREA' | 'DAP' | 'NPK' | 'MOP',
      quantityBags: Number(body.quantityBags),
      idempotencyKey: String(body.idempotencyKey ?? '').slice(0, 100) || `auto-${identity.id}-${body.reportId}`,
    }))
    return Response.json({ booking: serializeBooking(booking, true) }, { status: 201, headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : 'Could not create booking.' }, { status: 400 })
  }
}
