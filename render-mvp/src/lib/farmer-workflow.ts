export type SoilReadings = {
  nitrogen: string
  phosphorus: string
  potassium: string
  organicCarbon: string
  ph: string
  ec: string
}

export type FarmerRecommendation = {
  product: 'UREA' | 'DAP' | 'NPK' | 'MOP'
  rateKgPerHa: number
  sourceReference: string
  bagWeightKg: number
  totalQuantityKg: number
  wholeBags: number
  remainingKg: number
  bagsToBook: number
  approvedBy: string
  approvedAt: string
  disclaimer: string
}

export type FarmerReport = {
  id: string
  farmerId: string
  farmerName: string
  fileName: string
  extractedText: string
  readings: SoilReadings
  crop: string
  areaAcres: number
  createdAt: string
  status: 'awaiting-operator-review' | 'recommendation-ready'
  recommendation?: FarmerRecommendation
}

const REPORTS_KEY = 'khadsetu.demo.farmer-reports.v1'

export const emptySoilReadings: SoilReadings = {
  nitrogen: '',
  phosphorus: '',
  potassium: '',
  organicCarbon: '',
  ph: '',
  ec: '',
}

function findReading(text: string, patterns: RegExp[]): string {
  for (const pattern of patterns) {
    const match = text.match(pattern)
    if (match?.[1]) return match[1].replace(',', '.')
  }
  return ''
}

/**
 * Conservative OCR parser: it only extracts numbers adjacent to recognizable labels.
 * It does not infer missing values or convert units. A person must verify each value.
 */
export function parseSoilReadings(text: string): SoilReadings {
  return {
    nitrogen: findReading(text, [
      /(?:available\s+nitrogen|nitrogen|available\s+N|\bN\b)(?:\s*\([^)]*\))?\s*[:=\-]\s*(\d+(?:[.,]\d+)?)/i,
      /\bN\s*\(\s*kg\s*\/\s*ha\s*\)\s*[:=\-]?\s*(\d+(?:[.,]\d+)?)/i,
    ]),
    phosphorus: findReading(text, [
      /(?:available\s+phosphorus|phosphorus|available\s+P|\bP\b)(?:\s*\([^)]*\))?\s*[:=\-]\s*(\d+(?:[.,]\d+)?)/i,
      /\bP\s*\(\s*kg\s*\/\s*ha\s*\)\s*[:=\-]?\s*(\d+(?:[.,]\d+)?)/i,
    ]),
    potassium: findReading(text, [
      /(?:available\s+potassium|potassium|available\s+K|\bK\b)(?:\s*\([^)]*\))?\s*[:=\-]\s*(\d+(?:[.,]\d+)?)/i,
      /\bK\s*\(\s*kg\s*\/\s*ha\s*\)\s*[:=\-]?\s*(\d+(?:[.,]\d+)?)/i,
    ]),
    organicCarbon: findReading(text, [
      /organic\s+carbon(?:\s*\(%\))?\s*[:=\-]?\s*(\d+(?:[.,]\d+)?)/i,
      /\bOC\s*\(%\)\s*[:=\-]?\s*(\d+(?:[.,]\d+)?)/i,
    ]),
    ph: findReading(text, [/(?:soil\s*)?pH\s*[:=\-]?\s*(\d+(?:[.,]\d+)?)/i]),
    ec: findReading(text, [/(?:electrical\s+conductivity|\bEC)(?:\s*\(\s*dS\s*\/\s*m\s*\))?\s*[:=\-]?\s*(\d+(?:[.,]\d+)?)/i]),
  }
}

export function readFarmerReports(): FarmerReport[] {
  if (typeof window === 'undefined') return []
  try {
    const parsed = JSON.parse(window.localStorage.getItem(REPORTS_KEY) ?? '[]')
    return Array.isArray(parsed) ? parsed as FarmerReport[] : []
  } catch {
    return []
  }
}

export function writeFarmerReports(reports: FarmerReport[]) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(REPORTS_KEY, JSON.stringify(reports))
  window.dispatchEvent(new Event('khadsetu:reports-updated'))
}
