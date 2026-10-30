export const dynamic = 'force-dynamic'
export function GET() {
  return Response.json({
    ok: true,
    service: 'AI Synergy / KhadSetu',
    runtime: 'Next.js hosted MVP',
    version: '0.5.0-allotment-token-workflow',
    mode: 'demo',
    persistence: 'server-side JSON store; single-instance demo; configure a persistent Render disk for restart durability',
    data: 'synthetic demo inventory',
    ocr: 'browser-local-pdfjs-tesseract',
    auth: 'signed HttpOnly demo session cookie',
    booking: 'stock-backed reservations; FIFO waitlist; OTP token; confirmation; redemption; audit history',
  }, { headers: { 'Cache-Control': 'no-store' } })
}
