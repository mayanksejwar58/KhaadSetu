'use client'

import * as pdfjs from 'pdfjs-dist'
import { createWorker } from 'tesseract.js'

type OCRWorker = Awaited<ReturnType<typeof createWorker>>

export type SoilOCRPage = {
  page: number
  text: string
  method: 'embedded-text' | 'ocr'
  confidence: number | null
}

export type SoilOCRResult = {
  fileName: string
  pages: SoilOCRPage[]
  text: string
  averageConfidence: number | null
  usedOCR: boolean
  truncated: boolean
}

export type SoilOCRProgress = {
  stage: string
  progress: number
}

const MAX_FILE_BYTES = 20 * 1024 * 1024
const MAX_PDF_PAGES = 12
const MIN_EMBEDDED_TEXT = 35
const PDF_RENDER_SCALE = 1.6

function isSupportedFile(file: File) {
  const extension = file.name.toLowerCase().split('.').pop()
  return (
    file.type === 'application/pdf' ||
    file.type === 'image/png' ||
    file.type === 'image/jpeg' ||
    file.type === 'image/webp' ||
    ['pdf', 'png', 'jpg', 'jpeg', 'webp'].includes(extension ?? '')
  )
}

function textFromPdfItems(items: unknown[]) {
  return items
    .map((item) => {
      if (item && typeof item === 'object' && 'str' in item) {
        return String((item as { str?: unknown }).str ?? '')
      }
      return ''
    })
    .join(' ')
    .replace(/[\t ]+/g, ' ')
    .trim()
}

function getPdfWorkerUrl() {
  // Keep the worker version aligned with the imported PDF.js package.
  return new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString()
}

async function makeOCRWorker(
  language: 'eng' | 'eng+hin',
  onProgress?: (progress: SoilOCRProgress) => void,
): Promise<OCRWorker> {
  return createWorker(language, 1, {
    logger: (message) => {
      if (message.status === 'recognizing text' && typeof message.progress === 'number') {
        onProgress?.({ stage: 'Recognizing text', progress: message.progress })
      } else if (message.status) {
        onProgress?.({ stage: message.status, progress: 0 })
      }
    },
  })
}

async function recognizeImage(
  file: File,
  worker: OCRWorker,
  onProgress?: (progress: SoilOCRProgress) => void,
): Promise<SoilOCRPage> {
  onProgress?.({ stage: 'Reading image', progress: 0 })
  const result = await worker.recognize(file)
  return {
    page: 1,
    text: result.data.text.trim(),
    method: 'ocr',
    confidence: Number.isFinite(result.data.confidence) ? result.data.confidence : null,
  }
}

async function recognizePdf(
  file: File,
  getWorker: () => Promise<OCRWorker>,
  onProgress?: (progress: SoilOCRProgress) => void,
): Promise<{ pages: SoilOCRPage[]; truncated: boolean }> {
  pdfjs.GlobalWorkerOptions.workerSrc = getPdfWorkerUrl()
  const buffer = await file.arrayBuffer()
  const loadingTask = pdfjs.getDocument({ data: new Uint8Array(buffer) })
  const document = await loadingTask.promise
  const pageCount = document.numPages
  const pagesToProcess = Math.min(pageCount, MAX_PDF_PAGES)
  const pages: SoilOCRPage[] = []

  try {
    for (let pageNumber = 1; pageNumber <= pagesToProcess; pageNumber += 1) {
      onProgress?.({
        stage: `Reading PDF page ${pageNumber} of ${pagesToProcess}`,
        progress: (pageNumber - 1) / pagesToProcess,
      })
      const page = await document.getPage(pageNumber)
      const content = await page.getTextContent()
      const embeddedText = textFromPdfItems(content.items as unknown[])

      if (embeddedText.replace(/\s/g, '').length >= MIN_EMBEDDED_TEXT) {
        pages.push({
          page: pageNumber,
          text: embeddedText,
          method: 'embedded-text',
          confidence: null,
        })
        continue
      }

      const viewport = page.getViewport({ scale: PDF_RENDER_SCALE })
      const canvas = window.document.createElement('canvas')
      canvas.width = Math.ceil(viewport.width)
      canvas.height = Math.ceil(viewport.height)
      onProgress?.({ stage: `Rendering scanned page ${pageNumber}`, progress: 0 })
      await page.render({ canvas, viewport }).promise
      onProgress?.({ stage: `OCR on page ${pageNumber} of ${pagesToProcess}`, progress: 0 })
      const worker = await getWorker()
      const result = await worker.recognize(canvas)
      pages.push({
        page: pageNumber,
        text: result.data.text.trim(),
        method: 'ocr',
        confidence: Number.isFinite(result.data.confidence) ? result.data.confidence : null,
      })
      canvas.width = 0
      canvas.height = 0
      page.cleanup()
    }
  } finally {
    await loadingTask.destroy()
  }

  return { pages, truncated: pageCount > pagesToProcess }
}

/**
 * Extract text locally in the user's browser. Digital PDF pages use their embedded
 * text layer; scanned pages and raster images use Tesseract OCR.
 */
export async function extractSoilReportText(
  file: File,
  onProgress?: (progress: SoilOCRProgress) => void,
  language: 'eng' | 'eng+hin' = 'eng',
): Promise<SoilOCRResult> {
  if (typeof window === 'undefined') throw new Error('OCR is available in the browser only.')
  if (!isSupportedFile(file)) {
    throw new Error('Choose a PDF, PNG, JPG, or WEBP soil report.')
  }
  if (file.size > MAX_FILE_BYTES) {
    throw new Error('The report is larger than 20 MB. Compress it or upload fewer pages.')
  }
  if (file.size === 0) throw new Error('The selected file is empty.')

  let worker: OCRWorker | undefined
  const getWorker = async () => {
    if (!worker) {
      onProgress?.({ stage: 'Starting OCR engine', progress: 0 })
      worker = await makeOCRWorker(language, onProgress)
    }
    return worker
  }

  try {
    let pages: SoilOCRPage[]
    let truncated = false

    if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
      const result = await recognizePdf(file, getWorker, onProgress)
      pages = result.pages
      truncated = result.truncated
    } else {
      pages = [await recognizeImage(file, await getWorker(), onProgress)]
    }

    const text = pages
      .map((page) => `--- Page ${page.page} (${page.method === 'ocr' ? 'OCR' : 'embedded text'}) ---\n${page.text}`)
      .join('\n\n')
    const confidenceValues = pages
      .map((page) => page.confidence)
      .filter((value): value is number => value !== null)
    const averageConfidence = confidenceValues.length
      ? confidenceValues.reduce((sum, value) => sum + value, 0) / confidenceValues.length
      : null

    return {
      fileName: file.name,
      pages,
      text,
      averageConfidence,
      usedOCR: pages.some((page) => page.method === 'ocr'),
      truncated,
    }
  } finally {
    if (worker) await worker.terminate()
  }
}

