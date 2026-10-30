import { getDemoIdentity } from '@/lib/server-auth'
import { updateStore, type ReportRecord } from '@/lib/demo-store'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const identity = getDemoIdentity(request)
  if (!identity) return Response.json({ error: 'Sign in is required.' }, { status: 401 })
  const reports = await updateStore((state) => state.reports
    .filter((report) => identity.role === 'operator' || report.farmerId === identity.id)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt)))
  return Response.json({ docs: reports }, { headers: { 'Cache-Control': 'no-store' } })
}

export async function POST(request: Request) {
  const identity = getDemoIdentity(request)
  if (!identity || identity.role !== 'farmer') return Response.json({ error: 'Farmer sign-in is required.' }, { status: 403 })
  const body = await request.json().catch(() => null) as Partial<ReportRecord> | null
  if (!body || typeof body.id !== 'string' || typeof body.fileName !== 'string' || !body.readings || typeof body.readings !== 'object') {
    return Response.json({ error: 'Report ID, file name and soil readings are required.' }, { status: 400 })
  }
  const area = Number(body.areaAcres)
  if (!Number.isFinite(area) || area <= 0 || area > 500) return Response.json({ error: 'Farm area must be between 0 and 500 acres.' }, { status: 400 })
  if (['nitrogen', 'phosphorus', 'potassium'].some((key) => !Number.isFinite(Number(body.readings?.[key])) || Number(body.readings?.[key]) <= 0)) {
    return Response.json({ error: 'Verified positive N, P and K readings are required.' }, { status: 400 })
  }
  const report = await updateStore((state) => {
    if (state.reports.some((item) => item.id === body.id)) throw new Error('This report ID already exists.')
    const record: ReportRecord = {
      id: body.id!, farmerId: identity.id, farmerName: identity.name,
      fileName: body.fileName!.slice(0, 180), extractedText: String(body.extractedText ?? '').slice(0, 24000),
      readings: Object.fromEntries(Object.entries(body.readings!).map(([key, value]) => [key, String(value ?? '').slice(0, 40)])),
      crop: String(body.crop ?? 'Other').slice(0, 40), areaAcres: area,
      createdAt: new Date().toISOString(), status: 'awaiting-operator-review',
    }
    state.reports.unshift(record)
    return record
  }).catch((error) => ({ error: error instanceof Error ? error.message : 'Could not save report.' }))
  if ('error' in report) return Response.json({ error: report.error }, { status: 409 })
  return Response.json({ report }, { status: 201, headers: { 'Cache-Control': 'no-store' } })
}
