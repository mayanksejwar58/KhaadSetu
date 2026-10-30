import { getDemoIdentity } from '@/lib/server-auth'
import { updateStore, type ReportRecord } from '@/lib/demo-store'
import { calculateFertilizerQuantity } from '@/lib/fertilizer-quantity'

const allowedProducts = new Set(['UREA', 'DAP', 'NPK', 'MOP'])
export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const identity = getDemoIdentity(request)
  if (!identity || identity.role !== 'operator') return Response.json({ error: 'Depot operator sign-in is required.' }, { status: 403 })
  const body = await request.json().catch(() => null) as Record<string, unknown> | null
  if (!body) return Response.json({ error: 'A JSON request body is required.' }, { status: 400 })

  const reportId = String(body.reportId ?? '')
  const areaAcres = Number(body.areaAcres)
  const rateKgPerHa = Number(body.rateKgPerHa)
  const bagWeightKg = Number(body.bagWeightKg)
  const product = String(body.product ?? '').toUpperCase()
  const sourceReference = String(body.sourceReference ?? '').trim()
  if (!allowedProducts.has(product)) return Response.json({ error: 'Choose UREA, DAP, NPK, or MOP.' }, { status: 400 })
  if (sourceReference.length < 5 || sourceReference.length > 300) return Response.json({ error: 'Enter the agronomist-approved guideline or source reference.' }, { status: 400 })
  if (body.guidelineChecked !== true) return Response.json({ error: 'Confirm that the source guideline was checked.' }, { status: 400 })
  if (!reportId) return Response.json({ error: 'A soil report ID is required.' }, { status: 400 })

  let quantity
  try { quantity = calculateFertilizerQuantity(areaAcres, rateKgPerHa, bagWeightKg) }
  catch (error) { return Response.json({ error: error instanceof Error ? error.message : 'Invalid fertilizer quantity inputs.' }, { status: 400 }) }
  const { areaHectares, totalQuantityKg, wholeBags, remainingKg, bagsToBook } = quantity
  try {
    const recommendation = await updateStore((state) => {
      const report = state.reports.find((item) => item.id === reportId)
      if (!report) throw new Error('Soil report not found. Ask the farmer to submit it again.')
      const value: NonNullable<ReportRecord['recommendation']> = {
        product: product as NonNullable<ReportRecord['recommendation']>['product'],
        rateKgPerHa: Number(rateKgPerHa.toFixed(2)), sourceReference, bagWeightKg,
        totalQuantityKg: Number(totalQuantityKg.toFixed(2)), wholeBags, remainingKg, bagsToBook,
        approvedBy: identity.id, approvedAt: new Date().toISOString(),
        disclaimer: 'Quantity is arithmetic based on an operator-entered, externally approved rate. This is not an ML prediction or independent agronomic validation.',
      }
      report.recommendation = value
      report.status = 'recommendation-ready'
      return value
    })
    return Response.json({ product, areaHectares: Number(areaHectares.toFixed(4)), rateKgPerHa: Number(rateKgPerHa.toFixed(2)), totalQuantityKg: Number(totalQuantityKg.toFixed(2)), bagWeightKg, wholeBags, remainingKg, bagsRoundedUp: bagsToBook, bagsToBook, sourceReference, recommendation, disclaimer: recommendation.disclaimer }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : 'Could not save recommendation.' }, { status: 400 })
  }
}

