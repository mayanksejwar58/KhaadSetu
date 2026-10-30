'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { extractSoilReportText, type SoilOCRProgress } from '@/lib/soil-report-ocr'

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
          ['Active depots', centres.length || '—', 'Payload-managed records'],
          [
            'Available inventory',
            inventory.length ? available.toLocaleString('en-IN') : '—',
            'bags across all demo depots',
          ],
          ['Guidance registry', '0 approved', 'Fail-closed until reviewed sources exist'],
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
            <StatusPill>Connected</StatusPill>
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
          <p className="mt-4 text-xl font-semibold">Local demo foundation</p>
          <ul className="mt-5 space-y-3 text-sm text-slate-300">
            <li>Payload operational schema connected</li>
            <li>Transparent forecast baseline active</li>
            <li>Model B safely unavailable</li>
            <li>Production identity remains a launch blocker</li>
          </ul>
        </article>
      </div>
    </>
  )
}

function Farmer() {
  const [uploaded, setUploaded] = useState('')
  const [checked, setChecked] = useState(false)
  const [ocrText, setOcrText] = useState('')
  const [ocrError, setOcrError] = useState('')
  const [ocrProgress, setOcrProgress] = useState<SoilOCRProgress>({ stage: '', progress: 0 })
  const [ocrBusy, setOcrBusy] = useState(false)
  const [ocrConfidence, setOcrConfidence] = useState<number | null>(null)
  const [ocrUsed, setOcrUsed] = useState(false)
  const [ocrTruncated, setOcrTruncated] = useState(false)
  const [ocrLanguage, setOcrLanguage] = useState<'eng' | 'eng+hin'>('eng')

  async function handleSoilReport(file?: File) {
    if (!file) return
    setUploaded(file.name)
    setChecked(false)
    setOcrText('')
    setOcrError('')
    setOcrConfidence(null)
    setOcrUsed(false)
    setOcrTruncated(false)
    setOcrBusy(true)
    setOcrProgress({ stage: 'Preparing report', progress: 0 })
    try {
      const result = await extractSoilReportText(file, setOcrProgress, ocrLanguage)
      setOcrText(result.text)
      setOcrConfidence(result.averageConfidence)
      setOcrUsed(result.usedOCR)
      setOcrTruncated(result.truncated)
      if (!result.text.trim()) {
        setOcrError('No readable text was found. Try a clearer scan or enter the laboratory values manually.')
      }
    } catch (error) {
      setOcrError(error instanceof Error ? error.message : 'Could not read this soil report.')
    } finally {
      setOcrBusy(false)
      setOcrProgress({ stage: '', progress: 0 })
    }
  }

  return (
    <>
      <SectionHead
        eyebrow="Farmer workspace"
        title="Review soil context before requesting stock."
        copy="This local workflow uses synthetic identities only. It never asks for or stores an Aadhaar number."
      />
      <div className="grid gap-5 lg:grid-cols-[1.05fr_.95fr]">
        <div className={cardClass}>
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-950">1. Demo farmer & parcel</h2>
            <StatusPill tone="slate">Synthetic identity</StatusPill>
          </div>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <label>
              <span className={labelClass}>Demo farmer</span>
              <select className={inputClass} defaultValue="FMR-DEMO-1042">
                <option>FMR-DEMO-1042 — Meera Devi</option>
              </select>
            </label>
            <label>
              <span className={labelClass}>Land parcel</span>
              <select className={inputClass}>
                <option>Parcel HR-KNL-04 · 2.4 acres</option>
              </select>
            </label>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              ['Soil', 'Loam'],
              ['pH', '7.2'],
              ['N status', 'Not verified'],
              ['Crop', 'Wheat'],
            ].map(([key, value]) => (
              <div className="rounded-xl bg-slate-50 p-3" key={key}>
                <p className="text-[11px] uppercase tracking-wider text-slate-400">{key}</p>
                <p className="mt-1 text-sm font-semibold text-slate-800">{value}</p>
              </div>
            ))}
          </div>
          <div className="mt-7 border-t border-slate-100 pt-6">
            <h2 className="text-lg font-semibold text-slate-950">2. Soil report review</h2>
            <label className="mt-4 block">
              <span className={labelClass}>OCR language</span>
              <select
                className={inputClass}
                disabled={ocrBusy}
                value={ocrLanguage}
                onChange={(event) => setOcrLanguage(event.target.value as 'eng' | 'eng+hin')}
              >
                <option value="eng">English</option>
                <option value="eng+hin">English + Hindi</option>
              </select>
            </label>
            <label className="mt-4 flex cursor-pointer flex-col items-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-5 py-8 text-center transition hover:border-emerald-400 hover:bg-emerald-50/40">
              <span className="grid size-10 place-items-center rounded-xl bg-white text-lg font-semibold text-emerald-700 shadow-sm">
                +
              </span>
              <span className="mt-3 text-sm font-semibold text-slate-800">
                {uploaded || 'Choose soil report'}
              </span>
              <span className="mt-1 text-xs text-slate-500">
                PDF, PNG, JPG, WEBP · up to 20 MB · OCR runs in this browser
              </span>
              <input
                accept="application/pdf,image/png,image/jpeg,image/webp,.pdf,.png,.jpg,.jpeg,.webp"
                className="sr-only"
                disabled={ocrBusy}
                type="file"
                onChange={(event) => {
                  const file = event.target.files?.[0]
                  event.currentTarget.value = ''
                  void handleSoilReport(file)
                }}
              />
            </label>
            {ocrBusy && (
              <div className="mt-4 rounded-xl border border-sky-200 bg-sky-50 p-4" role="status" aria-live="polite">
                <div className="flex items-center justify-between gap-3 text-sm font-semibold text-sky-900">
                  <span>{ocrProgress.stage || 'Processing soil report'}</span>
                  <span>{Math.round(ocrProgress.progress * 100)}%</span>
                </div>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-sky-100">
                  <div className="h-full rounded-full bg-sky-600 transition-all" style={{ width: `${Math.max(4, Math.min(100, ocrProgress.progress * 100))}%` }} />
                </div>
                <p className="mt-2 text-xs text-sky-800">First use downloads the OCR language engine. Keep this page open while it processes.</p>
              </div>
            )}
            {ocrError && (
              <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800" role="alert">
                {ocrError}
              </div>
            )}
            {ocrText && (
              <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-emerald-950">Text extracted successfully</p>
                  <StatusPill tone={ocrConfidence !== null && ocrConfidence < 65 ? 'amber' : 'green'}>
                    {ocrConfidence === null ? (ocrUsed ? 'OCR complete' : 'Digital text') : `OCR confidence ${Math.round(ocrConfidence)}%`}
                  </StatusPill>
                </div>
                <p className="mt-2 text-xs leading-5 text-emerald-900">
                  {ocrUsed ? 'OCR was used on this image or scanned PDF pages; searchable PDF pages use their embedded text.' : 'This PDF already contained selectable text, so OCR was not needed.'}
                  {' '}Verify every measurement and unit against the original report before entering values.
                </p>
                {ocrTruncated && <p className="mt-2 text-xs font-semibold text-amber-800">Only the first 12 PDF pages were processed. Upload smaller sections for the remaining pages.</p>}
                <textarea
                  aria-label="Extracted soil report text"
                  className={`${inputClass} mt-3 min-h-48 font-mono text-xs leading-5`}
                  readOnly
                  value={ocrText}
                />
                <p className="mt-2 text-[11px] leading-5 text-emerald-800">Privacy: the report is processed in your browser and is not uploaded or saved by this OCR feature.</p>
              </div>
            )}
          </div>
        </div>
        <div className={cardClass}>
          <h2 className="text-lg font-semibold text-slate-950">3. Confirm measured values</h2>
          <p className="mt-1 text-sm text-slate-500">
            Original units and laboratory method must be preserved.
          </p>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            {[
              'Available N (kg/ha)',
              'Available P (kg/ha)',
              'Available K (kg/ha)',
              'Organic carbon (%)',
              'pH',
              'EC (dS/m)',
            ].map((field) => (
              <label key={field}>
                <span className={labelClass}>{field}</span>
                <input className={inputClass} inputMode="decimal" placeholder="Not provided" />
              </label>
            ))}
          </div>
          <label className="mt-5 flex items-start gap-3 rounded-xl bg-slate-50 p-4">
            <input
              className="mt-1 size-4 accent-emerald-600"
              type="checkbox"
              checked={checked}
              onChange={(e) => setChecked(e.target.checked)}
            />
            <span className="text-sm leading-6 text-slate-600">
              I reviewed these values against the report and understand they are not yet a
              fertilizer recommendation.
            </span>
          </label>
          <button
            className="mt-4 w-full rounded-xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition enabled:hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-40"
            disabled={!checked}
            type="button"
          >
            Check reviewed guidance
          </button>
          {checked && (
            <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4">
              <p className="text-sm font-semibold text-amber-900">Guidance unavailable</p>
              <p className="mt-1 text-xs leading-5 text-amber-800">
                No approved agronomic guideline or quota policy is installed. No product, dose, bag
                count, or booking has been guessed.
              </p>
            </div>
          )}
        </div>
      </div>
    </>
  )
}

function Operator({ centres, inventory }: { centres: Centre[]; inventory: Inventory[] }) {
  const [centreId, setCentreId] = useState(centres[0]?.id ?? '')
  useEffect(() => {
    if (!centreId && centres[0]) setCentreId(centres[0].id)
  }, [centres, centreId])
  const rows = inventory.filter(
    (item) => (typeof item.centre === 'string' ? item.centre : item.centre.id) === centreId,
  )
  return (
    <>
      <SectionHead
        eyebrow="Depot operations"
        title="Know what is physical, reserved, and available."
        copy="Inventory comes from Payload. Token redemption remains locked until application-level operator authentication is configured."
      />
      <div className="mb-5 flex flex-col gap-3 rounded-2xl bg-slate-950 p-4 text-white sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-wider text-slate-400">Working depot</p>
          <p className="mt-1 text-sm font-semibold">
            Authenticated operator required for mutations
          </p>
        </div>
        <select
          className="rounded-xl border border-slate-700 bg-slate-900 px-4 py-2.5 text-sm"
          value={centreId}
          onChange={(e) => setCentreId(e.target.value)}
        >
          {centres.map((centre) => (
            <option value={centre.id} key={centre.id}>
              {centre.name}
            </option>
          ))}
        </select>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {rows.map((item) => {
          const available = item.physicalStockBags - item.reservedStockBags
          return (
            <article className={cardClass} key={item.id}>
              <div className="flex items-center justify-between">
                <p className="text-sm font-bold text-slate-950">{item.productCode}</p>
                <StatusPill>{item.bagWeightKg} kg bag</StatusPill>
              </div>
              <p className="mt-5 text-3xl font-semibold text-slate-950">
                {available.toLocaleString('en-IN')}
              </p>
              <p className="text-xs text-slate-500">available bags</p>
              <div className="mt-5 grid grid-cols-2 gap-2 border-t border-slate-100 pt-4 text-xs">
                <div>
                  <p className="text-slate-400">Physical</p>
                  <p className="mt-1 font-semibold text-slate-700">{item.physicalStockBags}</p>
                </div>
                <div>
                  <p className="text-slate-400">Reserved</p>
                  <p className="mt-1 font-semibold text-slate-700">{item.reservedStockBags}</p>
                </div>
              </div>
            </article>
          )
        })}
      </div>
      {!rows.length && (
        <div className={`${cardClass} text-sm text-slate-500`}>
          No inventory records are configured for this depot.
        </div>
      )}
      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <article className={cardClass}>
          <h2 className="text-lg font-semibold">Token redemption</h2>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            OTP lookup and redemption are disabled in public demo mode. This prevents active claim
            codes from being exposed.
          </p>
          <button
            className="mt-5 rounded-xl bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-400"
            disabled
          >
            Operator sign-in required
          </button>
        </article>
        <article className={cardClass}>
          <h2 className="text-lg font-semibold">Physical reconciliation</h2>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            Counts below reserved stock must be refused and every adjustment audited. Mutations
            require an authenticated depot operator.
          </p>
          <button
            className="mt-5 rounded-xl bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-400"
            disabled
          >
            Operator sign-in required
          </button>
        </article>
      </div>
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

export function KhadSetuApp({ view }: { view: View }) {
  const [centres, setCentres] = useState<Centre[]>([])
  const [inventory, setInventory] = useState<Inventory[]>([])
  const [connected, setConnected] = useState<boolean | null>(null)
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
  return (
    <div className="min-h-screen bg-[#f4f7f5] text-slate-950">
      <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-[#f4f7f5]/90 backdrop-blur-xl lg:hidden">
        <div className="flex h-16 items-center justify-between px-4">
          <Link className="font-semibold" href="/">
            KhadSetu
          </Link>
          <StatusPill tone={connected ? 'green' : 'amber'}>
            {connected === null ? 'Checking' : connected ? 'API online' : 'API offline'}
          </StatusPill>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-3 pb-3">
          {nav.map((item) => (
            <Link
              className={`whitespace-nowrap rounded-lg px-3 py-2 text-xs font-semibold ${view === item.id ? 'bg-slate-950 text-white' : 'text-slate-500'}`}
              href={item.href}
              key={item.id}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </header>
      <aside className="fixed inset-y-0 left-0 hidden w-64 flex-col bg-slate-950 p-5 text-white lg:flex">
        <Link className="flex items-center gap-3" href="/">
          <span className="grid size-10 place-items-center rounded-xl bg-emerald-500 font-bold text-slate-950">
            K
          </span>
          <span>
            <span className="block text-base font-semibold">KhadSetu</span>
            <span className="block text-[10px] uppercase tracking-[0.2em] text-slate-400">
              AI Synergy
            </span>
          </span>
        </Link>
        <nav className="mt-10 space-y-1">
          {nav.map((item) => (
            <Link
              className={`flex items-center gap-3 rounded-xl px-3 py-3 text-sm transition ${view === item.id ? 'bg-white text-slate-950' : 'text-slate-400 hover:bg-slate-900 hover:text-white'}`}
              href={item.href}
              key={item.id}
            >
              <span
                className={`text-[10px] font-bold ${view === item.id ? 'text-emerald-700' : 'text-slate-600'}`}
              >
                {item.mark}
              </span>
              <span className="font-medium">{item.label}</span>
            </Link>
          ))}
        </nav>
        <div className="mt-auto rounded-xl border border-slate-800 bg-slate-900 p-4">
          <div className="flex items-center gap-2">
            <span
              className={`size-2 rounded-full ${connected ? 'bg-emerald-400' : 'bg-amber-400'}`}
            />
            <p className="text-xs font-semibold">
              {connected === null
                ? 'Checking backend'
                : connected
                  ? 'Backend connected'
                  : 'Backend unavailable'}
            </p>
          </div>
          <p className="mt-2 text-[11px] leading-5 text-slate-500">
            Next.js + Payload · local demo
          </p>
        </div>
      </aside>
      <main className="min-h-screen px-4 py-7 sm:px-7 lg:ml-64 lg:px-10 lg:py-9">
        <div className="mx-auto max-w-7xl">
          <div className="mb-7 hidden items-center justify-between lg:flex">
            <p className="text-sm text-slate-500">AI Synergy / {title}</p>
            <div className="flex items-center gap-3">
              <StatusPill tone="amber">Local demo</StatusPill>
              <Link
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600"
                href="/admin"
              >
                Admin
              </Link>
            </div>
          </div>
          {view === 'home' && <Home centres={centres} inventory={inventory} />}
          {view === 'farmer' && <Farmer />}
          {view === 'operator' && <Operator centres={centres} inventory={inventory} />}
          {view === 'console' && <ConsoleView />}
          {view === 'forecast' && <Forecast />}
          {view === 'model-b' && <ModelB />}
        </div>
      </main>
    </div>
  )
}
