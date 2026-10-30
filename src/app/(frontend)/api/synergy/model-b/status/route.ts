export const dynamic = 'force-static'

export function GET() {
  return Response.json({
    available: false,
    status: 'model_not_trained',
    reason: 'No source-backed, human-reviewed training labels or trusted artifact are installed.',
    task: 'candidate_product_classifier',
    dosePredictionSupported: false,
  })
}
