export const dynamic = 'force-static'

export function GET() {
  return Response.json({
    ok: true,
    service: 'AI Synergy / KhadSetu',
    runtime: 'Next.js + Payload',
    version: '0.1.0-demo',
    mode: 'local-demonstration',
  })
}
