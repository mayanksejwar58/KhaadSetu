import { getDemoIdentity } from '@/lib/server-auth'
import { reconcileInventory, updateStore } from '@/lib/demo-store'
export const dynamic = 'force-dynamic'
export async function POST(request: Request, context: { params: Promise<{ centreId: string }> }) {
  const identity = getDemoIdentity(request)
  if (!identity || identity.role !== 'operator' || !identity.centreId) return Response.json({ error: 'Depot operator sign-in is required.' }, { status: 403 })
  const { centreId } = await context.params
  if (centreId !== identity.centreId) return Response.json({ error: 'You can reconcile only your assigned depot.' }, { status: 403 })
  const body = await request.json().catch(() => null) as { productCode?: string; physicalCount?: number; note?: string } | null
  if (!body || !['UREA', 'DAP', 'NPK', 'MOP'].includes(String(body.productCode))) return Response.json({ error: 'Choose a valid fertilizer product.' }, { status: 400 })
  try {
    const result = await updateStore((state) => reconcileInventory(state, {
      centreId, productCode: body.productCode as 'UREA' | 'DAP' | 'NPK' | 'MOP', physicalCount: Number(body.physicalCount), actorId: identity.id, note: String(body.note ?? 'Operator stock reconciliation'),
    }))
    return Response.json({ inventory: result, message: 'Stock reconciled. Eligible FIFO waitlist requests have been promoted.' }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : 'Could not reconcile stock.' }, { status: 400 })
  }
}
