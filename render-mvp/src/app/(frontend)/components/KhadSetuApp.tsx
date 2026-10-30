'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { extractSoilReportText, type SoilOCRProgress } from '@/lib/soil-report-ocr'
import type { DemoIdentity } from '@/lib/demo-auth'
import { emptySoilReadings, parseSoilReadings, type FarmerReport, type SoilReadings } from '@/lib/farmer-workflow'

type View = 'home' | 'farmer' | 'operator' | 'console' | 'forecast' | 'model-b'
type Centre = { id: string; code: string; name: string; district: string; state: string }
type Inventory = {
  id: string
  centre: string | Centre
  productCode: string
  physicalStockBags: number
  reservedStockBags: number
  bagWeightKg: number
}
type BookingView = {
  id: number; tokenCode: string; farmerId: string; farmerName: string; reportId: string; centreId: string; centreName: string
  productCode: string; quantityBags: number; bagWeightKg: number; status: 'RESERVED' | 'WAITLISTED' | 'CONFIRMED' | 'CLAIMED' | 'EXPIRED' | 'CANCELLED'
  position: number | null; otpCode: string | null; expiresAt: string | null; createdAt: string; confirmedAt: string | null; claimedAt: string | null
}

const nav: { id: View; label: string; href: string; mark: string }[] = [
  { id: 'home', label: 'Overview', href: '/', mark: '01' },
  { id: 'farmer', label: 'Farmer', href: '/farmer', mark: '02' },
  { id: 'operator', label: 'Operator', href: '/operator', mark: '03' },
  { id: 'console', label: 'Constraint console', href: '/console', mark: '04' },
  { id: 'forecast', label: 'Demand forecast', href: '/forecast', mark: '05' },
  { id: 'model-b', label: 'Model B', href: '/model-b', mark: '06' },
]

const inputClass =
  'w-full rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10'
const labelClass = 'mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-500'
const cardClass =
  'rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm shadow-slate-200/40'

function StatusPill({
  tone = 'green',
  children,
}: {
  tone?: 'green' | 'amber' | 'slate'
  children: React.ReactNode
}) {
  const tones = {
    green: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    amber: 'border-amber-200 bg-amber-50 text-amber-700',
    slate: 'border-slate-200 bg-slate-50 text-slate-600',
  }
  return (
    <span
      className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${tones[tone]}`}
    >
      {children}
    </span>
  )
}

function SectionHead({ eyebrow, title, copy }: { eyebrow: string; title: string; copy: string }) {
  return (
    <div className="mb-7 flex flex-col gap-3 border-b border-slate-200 pb-6 lg:flex-row lg:items-end lg:justify-between">
      <div>
        <p className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-emerald-700">
          {eyebrow}
        </p>
        <h1 className="text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
          {title}
        </h1>
      </div>
      <p className="max-w-xl text-sm leading-6 text-slate-600">{copy}</p>
    </div>
  )
}

function Home({ centres, inventory }: { centres: Centre[]; inventory: Inventory[] }) {
  const available = inventory.reduce(
    (sum, item) => sum + item.physicalStockBags - item.reservedStockBags,
    0,
  )
  return (
    <>
      <SectionHead
        eyebrow="Operations overview"
        title="Stock-backed promises, not queue numbers."
        copy="AI Synergy supports decisions. KhadSetu keeps allocation, stock protection, and fulfilment in separate, auditable steps."
      />
      <div className="grid gap-4 md:grid-cols-3">
        {[
          ['Active depots', centres.length || '—', 'Synthetic sample records'],
          [
            'Available inventory',
            inventory.length ? available.toLocaleString('en-IN') : '—',
            'bags across all demo depots',
          ],
          ['Fertilizer planning', 'Operator-reviewed', 'Dose requires a cited guideline'],
        ].map(([label, value, note]) => (
          <article className={cardClass} key={label}>
            <p className="text-sm font-medium text-slate-500">{label}</p>
            <p className="mt-4 text-3xl font-semibold tracking-tight text-slate-950">{value}</p>
            <p className="mt-2 text-xs text-slate-500">{note}</p>
          </article>
        ))}
      </div>
      <div className="mt-5 grid gap-5 lg:grid-cols-[1.5fr_1fr]">
        <article className={`${cardClass} overflow-hidden`}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-slate-950">System boundary</p>
              <p className="mt-1 text-sm text-slate-500">Every decision has a named owner.</p>
            </div>
            <StatusPill>Demo data</StatusPill>
          </div>
          <div className="mt-6 grid gap-3 sm:grid-cols-5">
            {[
              'AI candidate',
              'Reviewed guidance',
              'Quota policy',
              'Inventory check',
              'Operator fulfilment',
            ].map((step, i) => (
              <div className="relative rounded-xl bg-slate-50 p-3" key={step}>
                <p className="text-[11px] font-bold text-emerald-700">0{i + 1}</p>
                <p className="mt-6 text-xs font-semibold leading-5 text-slate-800">{step}</p>
              </div>
            ))}
          </div>
        </article>
        <article className="rounded-2xl bg-slate-950 p-5 text-white shadow-xl shadow-slate-300/30">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-400">
            Readiness
          </p>
          <p className="mt-4 text-xl font-semibold">Hosted MVP demo</p>
          <ul className="mt-5 space-y-3 text-sm text-slate-300">
            <li>Synthetic sample inventory loaded</li>
            <li>Transparent forecast baseline active</li>
            <li>Model B safely unavailable</li>
            <li>Demo farmer and operator IDs enabled</li>
          </ul>
        </article>
      </div>
    </>
  )
}

function Farmer({ session, centres }: { session: DemoIdentity; centres: Centre[] }) {
  const [phase, setPhase] = useState<'upload' | 'readings' | 'submitted'>('upload')
  const [uploaded, setUploaded] = useState('')
  const [ocrText, setOcrText] = useState('')
  const [ocrError, setOcrError] = useState('')
  const [ocrProgress, setOcrProgress] = useState<SoilOCRProgress>({ stage: '', progress: 0 })
  const [ocrBusy, setOcrBusy] = useState(false)
  const [ocrConfidence, setOcrConfidence] = useState<number | null>(null)
  const [ocrUsed, setOcrUsed] = useState(false)
  const [ocrTruncated, setOcrTruncated] = useState(false)
  const [ocrLanguage, setOcrLanguage] = useState<'eng' | 'eng+hin'>('eng')
  const [readings, setReadings] = useState<SoilReadings>(emptySoilReadings)
  const [crop, setCrop] = useState('Wheat')
  const [areaAcres, setAreaAcres] = useState('2.4')
  const [reviewed, setReviewed] = useState(false)
  const [reports, setReports] = useState<FarmerReport[]>([])
  const [submitError, setSubmitError] = useState('')

  const [bookings, setBookings] = useState<BookingView[]>([])
  const [bookingReportId, setBookingReportId] = useState('')
  const [bookingCentreId, setBookingCentreId] = useState('')
  const [bookingBusy, setBookingBusy] = useState(false)
  const [bookingError, setBookingError] = useState('')

  async function refreshFarmerWorkflow() {
    const [reportResponse, bookingResponse] = await Promise.all([fetch('/api/soil-reports', { cache: 'no-store' }), fetch('/api/bookings', { cache: 'no-store' })])
    if (reportResponse.ok) { const data = await reportResponse.json(); setReports(data.docs ?? []) }
    if (bookingResponse.ok) { const data = await bookingResponse.json(); setBookings(data.docs ?? []) }
  }

  useEffect(() => {
    void refreshFarmerWorkflow().catch(() => undefined)
    const timer = window.setInterval(() => { void refreshFarmerWorkflow().catch(() => undefined) }, 5000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    if (!bookingReportId) {
      const first = reports.find((report) => report.recommendation)
      if (first) setBookingReportId(first.id)
    }
  }, [reports, bookingReportId])
  useEffect(() => {
    if (!bookingCentreId && centres.length) setBookingCentreId(centres[0].id)
  }, [centres, bookingCentreId])

  async function handleSoilReport(file?: File) {
    if (!file) return
    setUploaded(file.name)
    setOcrText('')
    setOcrError('')
    setOcrConfidence(null)
    setOcrUsed(false)
    setOcrTruncated(false)
    setReviewed(false)
    setOcrBusy(true)
    setOcrProgress({ stage: 'Preparing report', progress: 0 })
    try {
      const result = await extractSoilReportText(file, setOcrProgress, ocrLanguage)
      setOcrText(result.text)
      setReadings(parseSoilReadings(result.text))
      setOcrConfidence(result.averageConfidence)
      setOcrUsed(result.usedOCR)
      setOcrTruncated(result.truncated)
      setPhase('readings')
      if (!result.text.trim()) {
        setOcrError('No readable text was found. You can still enter the laboratory readings manually below.')
      }
    } catch (error) {
      setOcrError(error instanceof Error ? error.message : 'Could not read this soil report.')
    } finally {
      setOcrBusy(false)
      setOcrProgress({ stage: '', progress: 0 })
    }
  }

  async function submitForReview() {
    setSubmitError('')
    const n = Number(readings.nitrogen)
    const p = Number(readings.phosphorus)
    const k = Number(readings.potassium)
    const acres = Number(areaAcres)
    if (![n, p, k, acres].every((value) => Number.isFinite(value) && value > 0)) {
      setSubmitError('Enter positive N, P and K values plus a valid land area before submitting.')
      return
    }
    if (!reviewed) {
      setSubmitError('Confirm that you checked the readings against the original laboratory report.')
      return
    }
    const report = {
      id: `SOIL-${Date.now().toString(36).toUpperCase()}`,
      fileName: uploaded || 'Manual soil readings',
      extractedText: ocrText.slice(0, 24000), readings, crop, areaAcres: acres,
    }
    try {
      const response = await fetch('/api/soil-reports', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(report) })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Could not submit soil report.')
      await refreshFarmerWorkflow()
      setPhase('submitted')
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'Could not submit soil report.')
    }
  }

  async function bookRecommendedAllocation() {
    const report = reports.find((item) => item.id === bookingReportId)
    if (!report?.recommendation) { setBookingError('Select a report with an operator-approved recommendation.'); return }
    if (!bookingCentreId) { setBookingError('Select a depot.'); return }
    setBookingError('')
    setBookingBusy(true)
    try {
      const response = await fetch('/api/bookings', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ reportId: report.id, centreId: bookingCentreId, productCode: report.recommendation.product, quantityBags: report.recommendation.bagsToBook, idempotencyKey: `BOOK-${report.id}-${bookingCentreId}-${report.recommendation.product}` }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Could not book allocation.')
      await refreshFarmerWorkflow()
    } catch (error) {
      setBookingError(error instanceof Error ? error.message : 'Could not book allocation.')
    } finally { setBookingBusy(false) }
  }

  async function updateFarmerBooking(booking: BookingView, action: 'confirm' | 'cancel') {
    setBookingError('')
    const response = await fetch(`/api/bookings/${booking.id}/${action}`, { method: 'POST' })
    const data = await response.json()
    if (!response.ok) setBookingError(data.error || `Could not ${action} booking.`)
    await refreshFarmerWorkflow()
  }


  const readingFields: { key: keyof SoilReadings; label: string; unit: string }[] = [
    { key: 'nitrogen', label: 'Available nitrogen', unit: 'kg/ha' },
    { key: 'phosphorus', label: 'Available phosphorus', unit: 'kg/ha' },
    { key: 'potassium', label: 'Available potassium', unit: 'kg/ha' },
    { key: 'organicCarbon', label: 'Organic carbon', unit: '%' },
    { key: 'ph', label: 'Soil pH', unit: '' },
    { key: 'ec', label: 'Electrical conductivity', unit: 'dS/m' },
  ]

  return (
    <>
      <SectionHead
        eyebrow="Farmer workspace · document to recommendation"
        title="Your soil report moves through a review workflow."
        copy={`Signed in as ${session.name} (${session.id}). Upload a laboratory report, verify OCR readings, and send them to the depot operator for a guideline-backed quantity calculation.`}
      />
      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        {[
          ['01', 'Document + OCR', 'Extract report text'],
          ['02', 'Reading verification', 'Farmer checks N, P, K and soil values'],
          ['03', 'Operator review', 'Guideline rate and quantity are approved'],
        ].map(([number, title, copy], index) => (
          <div className={`rounded-xl border p-4 ${phase === (index === 0 ? 'upload' : index === 1 ? 'readings' : 'submitted') ? 'border-emerald-300 bg-emerald-50' : 'border-slate-200 bg-white'}`} key={number}>
            <p className="text-xs font-bold text-emerald-700">PHASE {number}</p>
            <p className="mt-2 text-sm font-semibold text-slate-900">{title}</p>
            <p className="mt-1 text-xs leading-5 text-slate-500">{copy}</p>
          </div>
        ))}
      </div>

      {phase !== 'submitted' && (
        <div className="grid gap-5 lg:grid-cols-[1.05fr_.95fr]">
          <div className={cardClass}>
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-slate-950">1. Soil document reading</h2>
              <StatusPill tone="slate">Private browser OCR</StatusPill>
            </div>
            <p className="mt-2 text-sm leading-6 text-slate-500">Upload a Soil Health Card or laboratory result. Selectable PDF text is extracted directly; scanned PDF pages and images use OCR.</p>
            <label className="mt-4 block">
              <span className={labelClass}>OCR language</span>
              <select className={inputClass} disabled={ocrBusy} value={ocrLanguage} onChange={(event) => setOcrLanguage(event.target.value as 'eng' | 'eng+hin')}>
                <option value="eng">English</option>
                <option value="eng+hin">English + Hindi</option>
              </select>
            </label>
            <label className="mt-4 flex cursor-pointer flex-col items-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-5 py-8 text-center transition hover:border-emerald-400 hover:bg-emerald-50/40">
              <span className="grid size-10 place-items-center rounded-xl bg-white text-lg font-semibold text-emerald-700 shadow-sm">+</span>
              <span className="mt-3 text-sm font-semibold text-slate-800">{uploaded || 'Choose soil report'}</span>
              <span className="mt-1 text-xs text-slate-500">PDF, PNG, JPG, WEBP · up to 20 MB · max 12 PDF pages</span>
              <input accept="application/pdf,image/png,image/jpeg,image/webp,.pdf,.png,.jpg,.jpeg,.webp" className="sr-only" disabled={ocrBusy} type="file" onChange={(event) => { const file = event.target.files?.[0]; event.currentTarget.value = ''; void handleSoilReport(file) }} />
            </label>
            {ocrBusy && <div className="mt-4 rounded-xl border border-sky-200 bg-sky-50 p-4" role="status" aria-live="polite">
              <div className="flex items-center justify-between gap-3 text-sm font-semibold text-sky-900"><span>{ocrProgress.stage || 'Processing soil report'}</span><span>{Math.round(ocrProgress.progress * 100)}%</span></div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-sky-100"><div className="h-full rounded-full bg-sky-600 transition-all" style={{ width: `${Math.max(4, Math.min(100, ocrProgress.progress * 100))}%` }} /></div>
              <p className="mt-2 text-xs text-sky-800">Keep this page open while OCR processes the document.</p>
            </div>}
            {ocrError && <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800" role="alert">{ocrError}</div>}
            {ocrText && <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm font-semibold text-emerald-950">Document text extracted</p><StatusPill tone={ocrConfidence !== null && ocrConfidence < 65 ? 'amber' : 'green'}>{ocrConfidence === null ? (ocrUsed ? 'OCR complete' : 'Digital text') : `OCR confidence ${Math.round(ocrConfidence)}%`}</StatusPill></div>
              <p className="mt-2 text-xs leading-5 text-emerald-900">{ocrUsed ? 'OCR processed scanned pages.' : 'Selectable PDF text was found.'} Verify every reading and unit against the original report. OCR is not a laboratory validation.</p>
              {ocrTruncated && <p className="mt-2 text-xs font-semibold text-amber-800">Only the first 12 pages were read.</p>}
              <textarea aria-label="Extracted soil report text" className={`${inputClass} mt-3 min-h-40 font-mono text-xs leading-5`} readOnly value={ocrText} />
            </div>}
            <p className="mt-4 text-xs leading-5 text-slate-500">The file is OCR-processed in this browser. The verified readings are then saved to the shared KhadSetu demo service so the depot operator can review them from a separate login/device.</p>
          </div>

          <div className={cardClass}>
            <h2 className="text-lg font-semibold text-slate-950">2. Verify measured readings</h2>
            <p className="mt-1 text-sm text-slate-500">Values are prefilled only when OCR finds a recognizable label. Correct them using the source report.</p>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              {readingFields.map((field) => <label key={field.key}>
                <span className={labelClass}>{field.label} {field.unit ? `(${field.unit})` : ''}</span>
                <input className={inputClass} inputMode="decimal" placeholder="Enter verified value" value={readings[field.key]} onChange={(event) => setReadings((current) => ({ ...current, [field.key]: event.target.value }))} />
              </label>)}
            </div>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <label><span className={labelClass}>Crop</span><select className={inputClass} value={crop} onChange={(event) => setCrop(event.target.value)}>{['Wheat', 'Rice', 'Maize', 'Cotton', 'Mustard', 'Soybean', 'Other'].map((name) => <option key={name}>{name}</option>)}</select></label>
              <label><span className={labelClass}>Farm area (acres)</span><input className={inputClass} inputMode="decimal" type="number" min="0.01" max="500" step="0.01" value={areaAcres} onChange={(event) => setAreaAcres(event.target.value)} /></label>
            </div>
            <label className="mt-5 flex items-start gap-3 rounded-xl bg-slate-50 p-4">
              <input className="mt-1 size-4 accent-emerald-600" type="checkbox" checked={reviewed} onChange={(event) => setReviewed(event.target.checked)} />
              <span className="text-sm leading-6 text-slate-600">I have checked N, P, K values and units against the original soil report. I understand that OCR values can be wrong.</span>
            </label>
            {submitError && <p className="mt-3 rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{submitError}</p>}
            <button className="mt-4 w-full rounded-xl bg-emerald-700 px-4 py-3 text-sm font-semibold text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-40" disabled={!reviewed || !readings.nitrogen || !readings.phosphorus || !readings.potassium} type="button" onClick={() => void submitForReview()}>Submit readings to operator review</button>
            <p className="mt-3 text-xs leading-5 text-slate-500">No fertilizer or dose is predicted from OCR alone. The operator must enter a dose from a verified agronomic guideline before the app calculates quantity.</p>
          </div>
        </div>
      )}

      {phase === 'submitted' && <div className={`${cardClass} text-center`}>
        <StatusPill>Submitted for review</StatusPill>
        <h2 className="mt-4 text-2xl font-semibold">Your soil readings are in the operator queue.</h2>
        <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-slate-500">Report saved in the shared demo service. A depot operator can now review it from the operator login.</p>
        <button className="mt-5 rounded-xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white" onClick={() => { setPhase('upload'); setUploaded(''); setOcrText(''); setReadings(emptySoilReadings); setReviewed(false) }}>Upload another report</button>
      </div>}

      <div className="mt-6">
        <SectionHead eyebrow="Farmer report history" title="Review status" copy="Recommendations and booking tokens are stored centrally for the demo and follow the request from review to depot fulfilment." />
        <div className="space-y-3">
          {reports.length === 0 && <div className={cardClass}><p className="text-sm text-slate-500">No soil reports submitted yet.</p></div>}
          {reports.map((report) => <article className={cardClass} key={report.id}>
            <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-semibold text-slate-950">{report.fileName}</p><p className="mt-1 text-xs text-slate-500">{report.id} · {report.crop} · {report.areaAcres} acres · {new Date(report.createdAt).toLocaleString()}</p></div><StatusPill tone={report.recommendation ? 'green' : 'amber'}>{report.recommendation ? 'Recommendation ready' : 'Awaiting operator review'}</StatusPill></div>
            <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-6">{readingFields.map((field) => <div className="rounded-lg bg-slate-50 p-2" key={field.key}><p className="text-[10px] text-slate-500">{field.key.toUpperCase()}</p><p className="mt-1 text-sm font-semibold">{report.readings[field.key] || '—'}</p></div>)}</div>
            {report.recommendation && <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4"><div className="flex flex-wrap justify-between gap-2"><p className="font-semibold text-emerald-950">{report.recommendation.product} · operator-approved application plan</p><StatusPill>{report.recommendation.bagsToBook} retail bags to allot</StatusPill></div><p className="mt-2 text-sm text-emerald-900">{report.recommendation.totalQuantityKg} kg total at {report.recommendation.rateKgPerHa} kg/ha for {report.areaAcres} acres. Bag size: {report.recommendation.bagWeightKg} kg.</p><p className="mt-2 text-xs text-emerald-800">Source: {report.recommendation.sourceReference}</p><p className="mt-2 text-xs text-emerald-800">{report.recommendation.disclaimer}</p></div>}
          </article>)}
        </div>
      </div>

      <div className="mt-7 grid gap-5 lg:grid-cols-[.9fr_1.1fr]">
        <article className={cardClass}>
          <SectionHead eyebrow="Allotment booking" title="Book approved fertilizer bags" copy="A booking reserves the complete bag quantity or places the farmer in a FIFO waitlist. No partial stock promise is issued." />
          {reports.filter((report) => report.recommendation).length === 0 ? <p className="text-sm text-slate-500">An operator-approved fertilizer plan is required before booking.</p> : <>
            <label className="mb-4 block"><span className={labelClass}>Approved soil report</span><select className={inputClass} value={bookingReportId} onChange={(event) => setBookingReportId(event.target.value)}>{reports.filter((report) => report.recommendation).map((report) => <option key={report.id} value={report.id}>{report.id} · {report.recommendation!.product} · {report.recommendation!.bagsToBook} bags</option>)}</select></label>
            <label className="mb-4 block"><span className={labelClass}>Collection depot</span><select className={inputClass} value={bookingCentreId} onChange={(event) => setBookingCentreId(event.target.value)}>{centres.map((centre) => <option key={centre.id} value={centre.id}>{centre.name}</option>)}</select></label>
            {(() => { const selectedReport = reports.find((report) => report.id === bookingReportId); const recommendation = selectedReport?.recommendation; return recommendation ? <div className="mb-4 rounded-xl bg-emerald-50 p-4 text-sm text-emerald-950"><p className="font-semibold">{recommendation.product}: {recommendation.totalQuantityKg} kg</p><p className="mt-1">Book {recommendation.bagsToBook} × {recommendation.bagWeightKg} kg bags (rounded up to full retail bags).</p></div> : null })()}
            {bookingError && <p className="mb-3 rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{bookingError}</p>}
            <button className="w-full rounded-xl bg-emerald-700 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50" disabled={bookingBusy} onClick={() => void bookRecommendedAllocation()}>{bookingBusy ? 'Checking stock…' : 'Create allotment booking + token'}</button>
          </>}
        </article>
        <article className={cardClass}>
          <SectionHead eyebrow="Farmer token wallet" title="Track allotment status" copy="Show the active OTP at the selected depot after confirming your reserved token. Waitlisted bookings receive a token code and position, but no OTP until stock is available." />
          {bookings.length === 0 ? <p className="text-sm text-slate-500">No allotment tokens yet.</p> : <div className="space-y-3">{bookings.map((booking) => <div key={booking.id} className="rounded-xl border border-slate-200 p-4"><div className="flex flex-wrap items-start justify-between gap-2"><div><p className="font-semibold text-slate-950">{booking.tokenCode}</p><p className="mt-1 text-xs text-slate-500">{booking.centreName} · {booking.productCode} · {booking.quantityBags} bags</p></div><StatusPill tone={booking.status === 'CLAIMED' ? 'green' : booking.status === 'WAITLISTED' ? 'amber' : 'slate'}>{booking.status}</StatusPill></div>
            {booking.status === 'WAITLISTED' && <p className="mt-2 text-sm text-amber-800">Waitlist position #{booking.position}. No bags have been reserved yet.</p>}
            {booking.otpCode && ['RESERVED', 'CONFIRMED'].includes(booking.status) && <div className="mt-3 rounded-lg bg-emerald-50 p-3"><p className="text-xs text-emerald-800">Depot OTP · keep private until collection</p><p className="mt-1 font-mono text-2xl font-bold tracking-[0.2em] text-emerald-950">{booking.otpCode}</p><p className="mt-1 text-xs text-emerald-800">Reservation expires {booking.expiresAt ? new Date(booking.expiresAt).toLocaleString() : 'as per depot window'}.</p></div>}
            {booking.status === 'RESERVED' && <button className="mt-3 rounded-lg bg-slate-950 px-3 py-2 text-xs font-semibold text-white" onClick={() => void updateFarmerBooking(booking, 'confirm')}>Confirm token</button>}
            {['RESERVED', 'CONFIRMED', 'WAITLISTED'].includes(booking.status) && <button className="ml-2 mt-3 rounded-lg border border-rose-200 px-3 py-2 text-xs font-semibold text-rose-700" onClick={() => void updateFarmerBooking(booking, 'cancel')}>Cancel booking</button>}
            {booking.status === 'CLAIMED' && <p className="mt-2 text-sm font-semibold text-emerald-700">Collected successfully on {booking.claimedAt ? new Date(booking.claimedAt).toLocaleString() : 'the depot'}.</p>}
            {booking.status === 'EXPIRED' && <p className="mt-2 text-sm text-rose-700">Reservation expired and stock was released.</p>}
          </div>)}</div>}
        </article>
      </div>
    </>
  )
}

function Operator({ centres, inventory, session }: { centres: Centre[]; inventory: Inventory[]; session: DemoIdentity }) {
  const [reports, setReports] = useState<FarmerReport[]>([])
  const [bookings, setBookings] = useState<BookingView[]>([])
  const [liveInventory, setLiveInventory] = useState<Inventory[]>(inventory)
  const [selectedTokenId, setSelectedTokenId] = useState('')
  const [tokenOtp, setTokenOtp] = useState('')
  const [tokenError, setTokenError] = useState('')
  const [redeeming, setRedeeming] = useState(false)
  const [restockProduct, setRestockProduct] = useState('UREA')
  const [restockCount, setRestockCount] = useState('1400')
  const [restockNote, setRestockNote] = useState('New delivery / physical stock count')
  const [restockError, setRestockError] = useState('')
  const [restocking, setRestocking] = useState(false)
  const [selectedId, setSelectedId] = useState('')
  const [product, setProduct] = useState<'UREA' | 'DAP' | 'NPK' | 'MOP'>('UREA')
  const [rate, setRate] = useState('100')
  const [bagWeight, setBagWeight] = useState('45')
  const [sourceReference, setSourceReference] = useState('')
  const [guidelineChecked, setGuidelineChecked] = useState(false)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [centreId, setCentreId] = useState(session.centreId ?? centres[0]?.id ?? '')

  async function refreshOperatorWorkspace() {
    const [reportResponse, bookingResponse, inventoryResponse] = await Promise.all([
      fetch('/api/soil-reports', { cache: 'no-store' }), fetch('/api/bookings', { cache: 'no-store' }), fetch('/api/inventories', { cache: 'no-store' }),
    ])
    if (reportResponse.ok) {
      const data = await reportResponse.json()
      const nextReports = data.docs ?? []
      setReports(nextReports)
      setSelectedId((current) => current && nextReports.some((report: FarmerReport) => report.id === current) ? current : nextReports[0]?.id ?? '')
    }
    if (bookingResponse.ok) { const data = await bookingResponse.json(); setBookings(data.docs ?? []) }
    if (inventoryResponse.ok) { const data = await inventoryResponse.json(); setLiveInventory(data.docs ?? []) }
  }
  useEffect(() => {
    void refreshOperatorWorkspace().catch(() => undefined)
    const timer = window.setInterval(() => { void refreshOperatorWorkspace().catch(() => undefined) }, 5000)
    return () => window.clearInterval(timer)
  }, [])
  useEffect(() => {
    if (!centreId && centres[0]) setCentreId(centres[0].id)
  }, [centres, centreId])

  const selected = reports.find((report) => report.id === selectedId)
  const rows = liveInventory.filter((item) => (typeof item.centre === 'string' ? item.centre : item.centre.id) === centreId)

  async function approveRecommendation(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!selected) return
    setError('')
    setResult(null)
    setSaving(true)
    try {
      const response = await fetch('/api/recommendations/calculate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ reportId: selected.id, areaAcres: selected.areaAcres, rateKgPerHa: Number(rate), bagWeightKg: Number(bagWeight), product, sourceReference, guidelineChecked }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Could not calculate quantity.')
      const recommendation = data.recommendation
      await refreshOperatorWorkspace()
      setResult({ ...data, recommendation })
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not calculate quantity.')
    } finally {
      setSaving(false)
    }
  }


  async function redeemSelectedToken(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setTokenError('')
    if (!selectedTokenId || !tokenOtp.trim()) { setTokenError('Choose a confirmed token and enter the farmer OTP.'); return }
    setRedeeming(true)
    try {
      const response = await fetch(`/api/bookings/${selectedTokenId}/redeem`, {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ otp: tokenOtp.trim() }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Token redemption failed.')
      setTokenOtp('')
      setSelectedTokenId('')
      await refreshOperatorWorkspace()
    } catch (error) {
      setTokenError(error instanceof Error ? error.message : 'Token redemption failed.')
    } finally { setRedeeming(false) }
  }

  async function reconcileDepotStock(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setRestockError('')
    setRestocking(true)
    try {
      const response = await fetch(`/api/inventory/${centreId}/reconcile`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ productCode: restockProduct, physicalCount: Number(restockCount), note: restockNote }) })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Stock reconciliation failed.')
      await refreshOperatorWorkspace()
    } catch (error) {
      setRestockError(error instanceof Error ? error.message : 'Stock reconciliation failed.')
    } finally { setRestocking(false) }
  }

  return (
    <>
      <SectionHead eyebrow="Depot operations · operator workspace" title="Review farmer readings before releasing a quantity." copy={`Signed in as ${session.name} (${session.id}). Farmer reports, bookings and stock are shared through the demo service. Sample inventory starts synthetic but is reserved and decremented by the booking lifecycle.`} />
      <div className="mb-5 flex flex-col gap-3 rounded-2xl bg-slate-950 p-4 text-white sm:flex-row sm:items-center sm:justify-between"><div><p className="text-xs uppercase tracking-wider text-slate-400">Working depot</p><p className="mt-1 text-sm font-semibold">{session.centreName ?? 'Demonstration depot'}</p></div><select className="rounded-xl border border-slate-700 bg-slate-900 px-4 py-2.5 text-sm" value={centreId} onChange={(event) => setCentreId(event.target.value)} disabled>{centres.map((centre) => <option value={centre.id} key={centre.id}>{centre.name}</option>)}</select></div>
      <div className="grid gap-5 lg:grid-cols-[.8fr_1.2fr]">
        <article className={cardClass}>
          <div className="flex items-center justify-between gap-2"><h2 className="text-lg font-semibold">Farmer soil-report queue</h2><StatusPill>{reports.filter((report) => !report.recommendation).length} pending</StatusPill></div>
          <div className="mt-4 space-y-2">
            {reports.length === 0 && <p className="rounded-xl bg-slate-50 p-4 text-sm leading-6 text-slate-500">No soil reports yet. A farmer can submit a verified OCR soil report from a separate login/device; it will appear here automatically.</p>}
            {reports.map((report) => <button type="button" key={report.id} onClick={() => { setSelectedId(report.id); setResult(null); setError(''); setGuidelineChecked(false) }} className={`w-full rounded-xl border p-4 text-left transition ${selectedId === report.id ? 'border-emerald-400 bg-emerald-50' : 'border-slate-200 hover:border-slate-300'}`}><div className="flex items-start justify-between gap-2"><span className="text-sm font-semibold text-slate-900">{report.farmerName}</span><StatusPill tone={report.recommendation ? 'green' : 'amber'}>{report.recommendation ? 'Ready' : 'Pending'}</StatusPill></div><p className="mt-1 text-xs text-slate-500">{report.id} · {report.crop} · {report.areaAcres} acres</p><p className="mt-1 truncate text-xs text-slate-500">{report.fileName}</p></button>)}
          </div>
        </article>
        <article className={cardClass}>
          {!selected ? <div className="grid min-h-64 place-items-center text-center text-sm text-slate-500">Select a farmer report to view readings and prepare the reviewed dose calculation.</div> : <>
            <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-wider text-emerald-700">Reading verification · {selected.id}</p><h2 className="mt-1 text-xl font-semibold">{selected.farmerName}</h2><p className="mt-1 text-sm text-slate-500">{selected.crop} · {selected.areaAcres} acres · {selected.fileName}</p></div><StatusPill tone={selected.recommendation ? 'green' : 'amber'}>{selected.recommendation ? 'Recommendation ready' : 'Needs review'}</StatusPill></div>
            <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">{[
              ['N · kg/ha', selected.readings.nitrogen], ['P · kg/ha', selected.readings.phosphorus], ['K · kg/ha', selected.readings.potassium], ['Organic carbon · %', selected.readings.organicCarbon], ['pH', selected.readings.ph], ['EC · dS/m', selected.readings.ec],
            ].map(([label, value]) => <div className="rounded-xl bg-slate-50 p-3" key={label}><p className="text-[11px] text-slate-500">{label}</p><p className="mt-1 text-lg font-semibold text-slate-900">{value || 'Not supplied'}</p></div>)}</div>
            {selected.extractedText && <details className="mt-4 rounded-xl border border-slate-200 p-3"><summary className="cursor-pointer text-sm font-semibold">View OCR source text</summary><pre className="mt-3 max-h-48 overflow-auto whitespace-pre-wrap text-xs leading-5 text-slate-600">{selected.extractedText}</pre></details>}
            <form className="mt-5 border-t border-slate-100 pt-5" onSubmit={approveRecommendation}>
              <h3 className="text-base font-semibold">3. Enter approved fertilizer plan</h3>
              <p className="mt-1 text-sm leading-6 text-slate-500">The Model B artifact is not trained in this demo. Do not invent a dose. Enter the product rate only after checking an approved crop/region guideline or agronomist instruction. The app calculates total quantity from that rate and farm area; it does not independently validate the cited source.</p>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <label><span className={labelClass}>Fertilizer product</span><select className={inputClass} value={product} onChange={(event) => { const nextProduct = event.target.value as typeof product; setProduct(nextProduct); setBagWeight(nextProduct === 'UREA' ? '45' : '50') }}>{['UREA', 'DAP', 'NPK', 'MOP'].map((name) => <option key={name}>{name}</option>)}</select></label>
                <label><span className={labelClass}>Approved fertilizer-product rate (kg product/ha)</span><input className={inputClass} type="number" min="0.1" max="5000" step="0.1" value={rate} onChange={(event) => setRate(event.target.value)} /></label>
                <label><span className={labelClass}>Bag weight (kg) · match depot pack</span><select className={inputClass} value={bagWeight} onChange={(event) => setBagWeight(event.target.value)}><option value="45">45 kg</option><option value="50">50 kg</option></select></label>
                <label className="sm:col-span-2"><span className={labelClass}>Guideline / agronomist source reference (required)</span><input className={inputClass} placeholder="e.g. State agriculture university package of practices, crop + season + year" value={sourceReference} onChange={(event) => { setSourceReference(event.target.value); setGuidelineChecked(false) }} /></label>
              </div>
              <label className="mt-4 flex items-start gap-3 rounded-xl bg-amber-50 p-3 text-sm leading-5 text-amber-900"><input type="checkbox" className="mt-1 size-4 accent-emerald-600" checked={guidelineChecked} onChange={(event) => setGuidelineChecked(event.target.checked)} /><span>I checked that this is the correct product rate for this crop, region, season and soil report, using the cited guideline or agronomist instruction.</span></label>
              {error && <p className="mt-3 rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
              <button className="mt-4 w-full rounded-xl bg-emerald-700 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-50" disabled={saving || sourceReference.trim().length < 5 || !guidelineChecked}>{saving ? 'Calculating…' : 'Calculate quantity and approve for farmer'}</button>
            </form>
            {(result || selected.recommendation) && <div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4"><p className="font-semibold text-emerald-950">Quantity calculation</p><div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">{[["Product", result?.product ?? selected.recommendation?.product], ["Total quantity", `${result?.totalQuantityKg ?? selected.recommendation?.totalQuantityKg} kg`], ["Full bags", result?.wholeBags ?? selected.recommendation?.wholeBags], ["Bags to allot", result?.bagsToBook ?? selected.recommendation?.bagsToBook], ["Remaining", `${result?.remainingKg ?? selected.recommendation?.remainingKg} kg`]].map(([label, value]) => <div className="rounded-lg bg-white/80 p-3" key={label}><p className="text-[11px] text-slate-500">{label}</p><p className="mt-1 text-lg font-semibold text-slate-950">{value}</p></div>)}</div><p className="mt-2 text-sm font-bold text-emerald-950">Farmer allotment suggestion: book {result?.bagsToBook ?? selected.recommendation?.bagsToBook} complete bags. The depot will reserve the full bag count or place the request in the waitlist.</p><p className="mt-3 text-xs leading-5 text-emerald-900">Calculation is based on the operator-entered rate, the converted farm area (acres to hectares), and bag weight. It is not a model prediction or independent agronomic validation.</p><p className="mt-2 text-xs text-emerald-800">Source: {result?.sourceReference ?? selected.recommendation?.sourceReference}</p></div>}
          </>}
        </article>
      </div>
      <div className="mt-7 grid gap-5 lg:grid-cols-[1fr_1fr]">
        <article className={cardClass}>
          <SectionHead eyebrow="Depot inventory" title="Live stock and reserved bags" copy="Stock changes when bookings reserve bags and when confirmed tokens are redeemed. A waitlisted request does not lock stock." />
          <div className="space-y-3">{rows.map((item) => <div className="rounded-xl border border-slate-200 p-4" key={item.id}><div className="flex justify-between gap-2"><p className="font-semibold">{item.productCode}</p><p className="text-xs text-slate-500">{item.bagWeightKg} kg/bag</p></div><div className="mt-3 grid grid-cols-3 gap-2 text-sm"><div><p className="text-xs text-slate-500">Physical</p><p className="font-semibold">{item.physicalStockBags}</p></div><div><p className="text-xs text-slate-500">Reserved</p><p className="font-semibold">{item.reservedStockBags}</p></div><div><p className="text-xs text-slate-500">Available</p><p className="font-semibold text-emerald-700">{item.physicalStockBags - item.reservedStockBags}</p></div></div></div>)}</div>
          <form className="mt-5 space-y-3 border-t border-slate-100 pt-4" onSubmit={reconcileDepotStock}>
            <h3 className="font-semibold">Reconcile / receive stock</h3>
            <p className="text-xs leading-5 text-slate-500">Enter the newly counted physical bag total for a product. The server rejects counts below active reservations and promotes complete FIFO waitlist requests when stock becomes available.</p>
            <div className="grid grid-cols-2 gap-3"><label><span className={labelClass}>Product</span><select className={inputClass} value={restockProduct} onChange={(event) => setRestockProduct(event.target.value)}>{['UREA', 'DAP', 'NPK', 'MOP'].map((value) => <option key={value}>{value}</option>)}</select></label><label><span className={labelClass}>New physical bags</span><input className={inputClass} type="number" min="0" step="1" value={restockCount} onChange={(event) => setRestockCount(event.target.value)} /></label></div>
            <input className={inputClass} value={restockNote} onChange={(event) => setRestockNote(event.target.value)} aria-label="Stock reconciliation note" />
            {restockError && <p className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{restockError}</p>}
            <button className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-800 disabled:opacity-50" disabled={restocking}>{restocking ? 'Updating stock…' : 'Save physical count + process waitlist'}</button>
          </form>
        </article>
        <article className={cardClass}>
          <SectionHead eyebrow="Token counter" title="Redeem confirmed farmer tokens" copy="Operator enters the token ID and the OTP shown by the farmer. Only CONFIRMED tokens at this operator's assigned depot can be redeemed." />
          <div className="mb-4 space-y-2">{bookings.map((booking) => <div key={booking.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-50 p-3 text-sm"><div><p className="font-semibold">{booking.tokenCode} · {booking.farmerName}</p><p className="text-xs text-slate-500">{booking.productCode} · {booking.quantityBags} bags · {booking.status}{booking.position ? ` · queue #${booking.position}` : ''}</p></div><StatusPill tone={booking.status === 'CONFIRMED' ? 'green' : booking.status === 'WAITLISTED' ? 'amber' : 'slate'}>{booking.status}</StatusPill></div>)}</div>
          <form className="space-y-3 border-t border-slate-100 pt-4" onSubmit={redeemSelectedToken}>
            <label className="block"><span className={labelClass}>Confirmed token</span><select className={inputClass} value={selectedTokenId} onChange={(event) => setSelectedTokenId(event.target.value)}><option value="">Select confirmed token</option>{bookings.filter((booking) => booking.status === 'CONFIRMED').map((booking) => <option key={booking.id} value={booking.id}>{booking.tokenCode} · {booking.farmerName} · {booking.quantityBags} bags</option>)}</select></label>
            <label className="block"><span className={labelClass}>Farmer OTP</span><input className={inputClass} value={tokenOtp} onChange={(event) => setTokenOtp(event.target.value.toUpperCase())} maxLength={8} placeholder="Enter 6-character OTP" /></label>
            {tokenError && <p className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{tokenError}</p>}
            <button className="w-full rounded-xl bg-emerald-700 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50" disabled={redeeming || !selectedTokenId || !tokenOtp.trim()}>{redeeming ? 'Redeeming…' : 'Verify OTP and mark bags collected'}</button>
          </form>
        </article>
      </div>
      <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs leading-5 text-amber-900">The depot stock is seeded synthetic demo inventory, not live government stock. This demo stores workflow state in a single server-side JSON file. For durable hosted use, attach a persistent disk to the Render service; without it Render may reset the demo records during a redeploy/restart.</p>
    </>
  )
}

function ConsoleView() {
  const [result, setResult] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  async function run(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    const data = new FormData(event.currentTarget)
    const response = await fetch('/api/simulation/run', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(Object.fromEntries([...data].map(([k, v]) => [k, Number(v)]))),
    })
    setResult(await response.json())
    setLoading(false)
  }
  return (
    <>
      <SectionHead
        eyebrow="Constraint console"
        title="Make the race condition visible."
        copy="A deterministic simulation compares naive promises with full-quantity stock-backed reservations. It never modifies live inventory."
      />
      <div className="grid gap-5 lg:grid-cols-[.8fr_1.2fr]">
        <form className={cardClass} onSubmit={run}>
          <h2 className="text-lg font-semibold">Scenario</h2>
          <div className="mt-5 space-y-4">
            {[
              ['stock', 'Available stock (bags)', '100'],
              ['requestSize', 'Bags per request', '10'],
              ['farmers', 'Simultaneous farmers', '18'],
              ['seed', 'Simulation seed', '42'],
            ].map(([name, label, value]) => (
              <label key={name}>
                <span className={labelClass}>{label}</span>
                <input
                  className={inputClass}
                  name={name}
                  type="number"
                  min="1"
                  defaultValue={value}
                />
              </label>
            ))}
          </div>
          <button
            className="mt-5 w-full rounded-xl bg-emerald-700 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-50"
            disabled={loading}
          >
            {loading ? 'Running…' : 'Run simulation'}
          </button>
        </form>
        <article className={`${cardClass} min-h-80`}>
          {!result ? (
            <div className="grid h-full min-h-64 place-items-center text-center text-sm text-slate-400">
              Run a scenario to compare allocation strategies.
            </div>
          ) : (
            <div>
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">Result</h2>
                <StatusPill tone="slate">Seed {result.seed}</StatusPill>
              </div>
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl bg-rose-50 p-5">
                  <p className="text-xs font-bold uppercase text-rose-600">Naive baseline</p>
                  <p className="mt-4 text-3xl font-semibold text-rose-950">
                    {result.naive.overbookedBags}
                  </p>
                  <p className="text-xs text-rose-700">bags overbooked</p>
                </div>
                <div className="rounded-xl bg-emerald-50 p-5">
                  <p className="text-xs font-bold uppercase text-emerald-700">KhadSetu</p>
                  <p className="mt-4 text-3xl font-semibold text-emerald-950">
                    {result.khadSetu.overbookedBags}
                  </p>
                  <p className="text-xs text-emerald-700">bags overbooked</p>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-xl border border-slate-200 p-4">
                  <p className="text-slate-500">Reserved</p>
                  <p className="mt-1 font-semibold">{result.khadSetu.reservedRequests} requests</p>
                </div>
                <div className="rounded-xl border border-slate-200 p-4">
                  <p className="text-slate-500">Waitlisted</p>
                  <p className="mt-1 font-semibold">
                    {result.khadSetu.waitlistedRequests} requests
                  </p>
                </div>
              </div>
            </div>
          )}
        </article>
      </div>
    </>
  )
}

function Forecast() {
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState('')
  async function run(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    const data = new FormData(event.currentTarget)
    const history = String(data.get('history'))
      .split(',')
      .map((v) => Number(v.trim()))
    const response = await fetch('/api/forecast/run', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        history,
        horizon: Number(data.get('horizon')),
        currentStockKg: Number(data.get('stock')),
        incomingStockKg: Number(data.get('incoming')),
        incomingWeek: Number(data.get('arrival')),
      }),
    })
    const json = await response.json()
    if (!response.ok) setError(json.error)
    else setResult(json)
  }
  return (
    <>
      <SectionHead
        eyebrow="Demand forecast"
        title="Plan stock with a transparent baseline."
        copy="This feature forecasts demand history, not agronomic need. Demo inputs and outputs are not suitable for procurement or allocation."
      />
      <div className="mb-5 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm font-semibold text-amber-900">
        SYNTHETIC DEMO FORECAST — NOT FOR PROCUREMENT OR REAL ALLOCATION
      </div>
      <form className={`${cardClass} grid gap-4 lg:grid-cols-5`} onSubmit={run}>
        <label className="lg:col-span-2">
          <span className={labelClass}>Weekly demand kg · oldest to newest</span>
          <input
            className={inputClass}
            name="history"
            defaultValue="8200, 8700, 8450, 9100, 9400, 9250, 9800, 10100, 9900, 10300, 10600, 10900"
          />
        </label>
        <label>
          <span className={labelClass}>Current stock kg</span>
          <input className={inputClass} name="stock" type="number" defaultValue="28000" />
        </label>
        <label>
          <span className={labelClass}>Incoming kg</span>
          <input className={inputClass} name="incoming" type="number" defaultValue="12000" />
        </label>
        <label>
          <span className={labelClass}>Arrival week</span>
          <select className={inputClass} name="arrival" defaultValue="2">
            <option value="1">Week 1</option>
            <option value="2">Week 2</option>
            <option value="3">Week 3</option>
            <option value="4">Week 4</option>
          </select>
        </label>
        <label>
          <span className={labelClass}>Horizon</span>
          <select className={inputClass} name="horizon" defaultValue="4">
            <option value="1">1 week</option>
            <option value="2">2 weeks</option>
            <option value="3">3 weeks</option>
            <option value="4">4 weeks</option>
          </select>
        </label>
        <button className="rounded-xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white hover:bg-emerald-700 lg:col-span-4 lg:mt-5">
          Run baseline forecast
        </button>
      </form>
      {error && <p className="mt-4 rounded-xl bg-rose-50 p-4 text-sm text-rose-700">{error}</p>}
      {result && (
        <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
            <div>
              <p className="font-semibold">Stock sufficiency</p>
              <p className="text-xs text-slate-500">{result.method}</p>
            </div>
            <StatusPill tone="amber">Demo input</StatusPill>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-3xl text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
                <tr>
                  {[
                    'Week',
                    'Demand kg',
                    'Opening kg',
                    'Incoming kg',
                    'Fulfilled kg',
                    'Shortfall kg',
                    'Closing kg',
                    'Risk',
                  ].map((h) => (
                    <th className="px-5 py-3" key={h}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {result.weeks.map((week: any) => (
                  <tr key={week.week}>
                    <td className="px-5 py-4 font-semibold">W{week.week}</td>
                    <td className="px-5 py-4">{week.predictedDemandKg.toLocaleString()}</td>
                    <td className="px-5 py-4">{week.openingStockKg.toLocaleString()}</td>
                    <td className="px-5 py-4">{week.incomingKg.toLocaleString()}</td>
                    <td className="px-5 py-4">{week.expectedFulfilledKg.toLocaleString()}</td>
                    <td className="px-5 py-4 text-rose-700">{week.shortfallKg.toLocaleString()}</td>
                    <td className="px-5 py-4">{week.closingStockKg.toLocaleString()}</td>
                    <td className="px-5 py-4">
                      <StatusPill tone={week.stockoutRisk === 'high' ? 'amber' : 'green'}>
                        {week.stockoutRisk}
                      </StatusPill>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  )
}

function ModelB() {
  const fields = [
    'Available N (kg/ha)',
    'Available P (kg/ha)',
    'Available K (kg/ha)',
    'Soil pH',
    'Organic carbon (%)',
    'EC (dS/m)',
    'Crop',
    'State',
    'District',
    'Season',
    'Crop stage',
    'Soil texture',
    'Irrigation type',
    'Previous crop',
  ]
  return (
    <>
      <SectionHead
        eyebrow="Model B"
        title="Candidate product classifier."
        copy="Model B is not a dose calculator, quota engine, forecast model, or official approval path."
      />
      <div className="grid gap-5 lg:grid-cols-[1fr_.75fr]">
        <article className={cardClass}>
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">14-feature input</h2>
            <StatusPill tone="slate">Schema ready</StatusPill>
          </div>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            {fields.map((field, i) => (
              <label key={field}>
                <span className={labelClass}>{field}</span>
                <input
                  className={inputClass}
                  disabled
                  placeholder={i < 6 ? 'Measured value' : 'Context value'}
                />
              </label>
            ))}
          </div>
          <button
            className="mt-5 w-full rounded-xl bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-400"
            disabled
          >
            Prediction unavailable
          </button>
        </article>
        <aside className="space-y-5">
          <article className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
            <StatusPill tone="amber">model_not_trained</StatusPill>
            <h2 className="mt-4 text-xl font-semibold text-amber-950">
              No trusted artifact installed
            </h2>
            <p className="mt-3 text-sm leading-6 text-amber-800">
              The repository contains no source-backed, human-reviewed training labels. Prediction
              fails closed instead of inventing an agronomic candidate.
            </p>
          </article>
          <article className={cardClass}>
            <h2 className="font-semibold">Required before training</h2>
            <ul className="mt-4 space-y-3 text-sm leading-6 text-slate-600">
              <li>100+ reviewed records</li>
              <li>20+ independent field IDs</li>
              <li>5+ fields per product class</li>
              <li>Source reference for every label</li>
              <li>Grouped, leakage-safe validation</li>
            </ul>
          </article>
        </aside>
      </div>
    </>
  )
}

function LoginScreen({ onLogin }: { onLogin: (identity: DemoIdentity) => void }) {
  const [accountId, setAccountId] = useState('FMR-DEMO-1042')
  const [pin, setPin] = useState('1042')
  const [error, setError] = useState('')
  async function signIn(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    try {
      const response = await fetch('/api/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: accountId, pin }) })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Sign-in failed.')
      onLogin(data.identity as DemoIdentity)
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Sign-in failed. Check the ID and PIN.')
    }
  }
  return <main className="grid min-h-screen place-items-center bg-[#f4f7f5] px-4 py-10">
    <div className="w-full max-w-4xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl shadow-slate-200/60">
      <div className="grid lg:grid-cols-[1fr_1.1fr]">
        <div className="bg-slate-950 p-7 text-white sm:p-10"><div className="flex items-center gap-3"><span className="grid size-11 place-items-center rounded-xl bg-emerald-500 text-xl font-bold text-slate-950">K</span><div><p className="font-semibold">KhadSetu</p><p className="text-[10px] uppercase tracking-[0.2em] text-slate-400">AI Synergy · MVP</p></div></div><p className="mt-12 text-xs font-bold uppercase tracking-[0.18em] text-emerald-400">Secure workflow demo</p><h1 className="mt-3 text-3xl font-semibold leading-tight">From soil document to reviewed fertilizer quantity.</h1><p className="mt-4 text-sm leading-6 text-slate-300">Farmers submit soil readings. Depot operators verify the source guideline and calculate the required quantity. Every phase has a human review step.</p><div className="mt-8 space-y-3 text-sm text-slate-300"><p>01 · Document OCR and text extraction</p><p>02 · Farmer confirms laboratory readings</p><p>03 · Operator enters approved rate and verifies quantity</p></div></div>
        <div className="p-7 sm:p-10"><p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-700">Demo sign in</p><h2 className="mt-2 text-2xl font-semibold text-slate-950">Welcome to KhadSetu</h2><form className="mt-7 space-y-4" onSubmit={signIn}><label className="block"><span className={labelClass}>Farmer / operator ID</span><input className={inputClass} autoComplete="username" value={accountId} onChange={(event) => setAccountId(event.target.value)} placeholder="FMR-DEMO-1042 or OPS-KNL-01" /></label><label className="block"><span className={labelClass}>Demo PIN</span><input className={inputClass} autoComplete="current-password" inputMode="numeric" type="password" value={pin} onChange={(event) => setPin(event.target.value)} /></label>{error && <p className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}<button className="w-full rounded-xl bg-emerald-700 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-800">Sign in</button></form><div className="mt-7 rounded-xl border border-amber-200 bg-amber-50 p-4"><p className="text-xs font-bold uppercase tracking-wider text-amber-900">Demo credentials · not real accounts</p><div className="mt-3 space-y-3 text-xs text-amber-950"><div><p className="font-semibold">Farmers</p><p>FMR-DEMO-1042 · PIN 1042 · Meera Devi</p><p>FMR-DEMO-1043 · PIN 1043 · Rajesh Kumar</p></div><div><p className="font-semibold">Operators</p><p>OPS-KNL-01 · PIN 2101 · Anita Sharma</p><p>OPS-GWL-01 · PIN 2102 · Rakesh Singh</p><p>OPS-DL-01 · PIN 2103 · Neha Verma</p></div></div></div><p className="mt-4 text-[11px] leading-5 text-slate-500">Demo accounts use a signed HttpOnly session cookie. These public IDs and PINs are still demo credentials, not real government identities. Do not use real personal or Aadhaar data.</p></div>
      </div>
    </div>
  </main>
}

export function KhadSetuApp({ view }: { view: View }) {
  const [centres, setCentres] = useState<Centre[]>([])
  const [inventory, setInventory] = useState<Inventory[]>([])
  const [connected, setConnected] = useState<boolean | null>(null)
  const [session, setSession] = useState<DemoIdentity | null>(null)
  const [sessionLoaded, setSessionLoaded] = useState(false)
  useEffect(() => {
    fetch('/api/auth/session', { cache: 'no-store' })
      .then((response) => response.json())
      .then((data) => setSession(data.identity ?? null))
      .catch(() => setSession(null))
      .finally(() => setSessionLoaded(true))
  }, [])
  useEffect(() => {
    Promise.all([
      fetch('/api/health').then((r) => r.ok),
      fetch('/api/centres?limit=20&sort=code').then((r) => r.json()),
      fetch('/api/inventories?limit=100&depth=1').then((r) => r.json()),
    ])
      .then(([health, centreData, inventoryData]) => {
        setConnected(health)
        setCentres(centreData.docs ?? [])
        setInventory(inventoryData.docs ?? [])
      })
      .catch(() => setConnected(false))
  }, [])
  const title = useMemo(() => nav.find((item) => item.id === view)?.label ?? 'Overview', [view])
  if (!sessionLoaded) return <main className="grid min-h-screen place-items-center text-sm text-slate-500">Loading KhadSetu demo session…</main>
  if (!session) return <LoginScreen onLogin={setSession} />

  const allowed = view === 'home' || (view === 'farmer' && session.role === 'farmer') || (view === 'operator' && session.role === 'operator') || (session.role === 'operator' && ['console', 'forecast', 'model-b'].includes(view))
  const visibleNav = nav.filter((item) => item.id === 'home' || (session.role === 'farmer' && item.id === 'farmer') || (session.role === 'operator' && item.id !== 'farmer'))
  const logout = () => { void fetch('/api/auth/logout', { method: 'POST' }).finally(() => setSession(null)) }

  return (
    <div className="min-h-screen bg-[#f4f7f5] text-slate-950">
      <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-[#f4f7f5]/95 backdrop-blur-xl lg:hidden">
        <div className="flex h-16 items-center justify-between px-4"><Link className="font-semibold" href="/">KhadSetu</Link><button className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold" onClick={logout}>Sign out</button></div>
        <nav className="flex gap-1 overflow-x-auto px-3 pb-3">{visibleNav.map((item) => <Link className={`whitespace-nowrap rounded-lg px-3 py-2 text-xs font-semibold ${view === item.id ? 'bg-slate-950 text-white' : 'text-slate-500'}`} href={item.href} key={item.id}>{item.label}</Link>)}</nav>
      </header>
      <aside className="fixed inset-y-0 left-0 hidden w-64 flex-col bg-slate-950 p-5 text-white lg:flex">
        <Link className="flex items-center gap-3" href="/"><span className="grid size-10 place-items-center rounded-xl bg-emerald-500 font-bold text-slate-950">K</span><span><span className="block text-base font-semibold">KhadSetu</span><span className="block text-[10px] uppercase tracking-[0.2em] text-slate-400">AI Synergy</span></span></Link>
        <nav className="mt-10 space-y-1">{visibleNav.map((item) => <Link className={`flex items-center gap-3 rounded-xl px-3 py-3 text-sm transition ${view === item.id ? 'bg-white text-slate-950' : 'text-slate-400 hover:bg-slate-900 hover:text-white'}`} href={item.href} key={item.id}><span className={`text-[10px] font-bold ${view === item.id ? 'text-emerald-700' : 'text-slate-600'}`}>{item.mark}</span><span className="font-medium">{item.label}</span></Link>)}</nav>
        <div className="mt-auto rounded-xl border border-slate-800 bg-slate-900 p-4"><div className="flex items-center gap-2"><span className={`size-2 rounded-full ${connected ? 'bg-emerald-400' : 'bg-amber-400'}`} /><p className="text-xs font-semibold">{connected === null ? 'Checking backend' : connected ? 'Demo API ready' : 'Backend unavailable'}</p></div><p className="mt-2 text-xs font-semibold text-white">{session.name}</p><p className="text-[11px] text-slate-400">{session.id} · {session.role}</p><button className="mt-3 w-full rounded-lg border border-slate-700 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-800" onClick={logout}>Sign out</button><p className="mt-3 text-[11px] leading-5 text-slate-500">Next.js · Render demo · synthetic sample data</p></div>
      </aside>
      <main className="min-h-screen px-4 py-7 sm:px-7 lg:ml-64 lg:px-10 lg:py-9"><div className="mx-auto max-w-7xl"><div className="mb-7 hidden items-center justify-between lg:flex"><p className="text-sm text-slate-500">AI Synergy / {title}</p><div className="flex items-center gap-3"><StatusPill tone="amber">Hosted demo</StatusPill><span className="text-xs text-slate-500">{session.name} · {session.id}</span></div></div>
        {!allowed && <div className={`${cardClass} mx-auto max-w-xl`}><StatusPill tone="amber">Role restricted</StatusPill><h1 className="mt-4 text-xl font-semibold">This workspace is not available to your demo role.</h1><p className="mt-2 text-sm leading-6 text-slate-500">Signed in as {session.role}. Use the navigation for your role or sign out to change demo accounts.</p><button className="mt-4 rounded-xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white" onClick={logout}>Sign out and switch account</button></div>}
        {allowed && view === 'home' && <Home centres={centres} inventory={inventory} />}
        {allowed && view === 'farmer' && <Farmer session={session} centres={centres} />}
        {allowed && view === 'operator' && <Operator centres={centres} inventory={inventory} session={session} />}
        {allowed && view === 'console' && <ConsoleView />}
        {allowed && view === 'forecast' && <Forecast />}
        {allowed && view === 'model-b' && <ModelB />}
      </div></main>
    </div>
  )
}
