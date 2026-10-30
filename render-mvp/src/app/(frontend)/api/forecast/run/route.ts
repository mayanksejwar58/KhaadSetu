type ForecastInput = {
  history?: number[]
  horizon?: number
  currentStockKg?: number
  incomingStockKg?: number
  incomingWeek?: number
}

export async function POST(request: Request) {
  const body = (await request.json()) as ForecastInput
  const history = body.history
  const horizon = Math.trunc(body.horizon ?? 4)
  if (!Array.isArray(history) || history.length < 4 || history.length > 104) {
    return Response.json({ error: 'Provide 4–104 weekly demand values.' }, { status: 422 })
  }
  if (history.some((value) => !Number.isFinite(value) || value < 0) || horizon < 1 || horizon > 4) {
    return Response.json(
      { error: 'History must be non-negative and horizon must be 1–4.' },
      { status: 422 },
    )
  }

  const recent = history.slice(-4)
  const level =
    (recent.reduce((sum, value) => sum + value, 0) / recent.length + history.at(-1)!) / 2
  const differences = history.slice(1).map((value, index) => value - history[index])
  const sorted = [...differences].sort((a, b) => a - b)
  const trend = sorted[Math.floor(sorted.length / 2)] ?? 0
  let stock = Math.max(0, body.currentStockKg ?? 0)
  const incoming = Math.max(0, body.incomingStockKg ?? 0)
  const arrival = Math.min(4, Math.max(1, Math.trunc(body.incomingWeek ?? 1)))

  const weeks = Array.from({ length: horizon }, (_, index) => {
    const week = index + 1
    const openingStockKg = stock
    const incomingKg = week === arrival ? incoming : 0
    stock += incomingKg
    const predictedDemandKg = Math.max(0, Math.round(level + trend * (1 - index * 0.2) * week))
    const expectedFulfilledKg = Math.min(stock, predictedDemandKg)
    const shortfallKg = Math.max(0, predictedDemandKg - stock)
    stock = Math.max(0, stock - predictedDemandKg)
    return {
      week,
      predictedDemandKg,
      openingStockKg,
      incomingKg,
      expectedFulfilledKg,
      shortfallKg,
      closingStockKg: stock,
      stockoutRisk: shortfallKg > 0 ? 'high' : stock < predictedDemandKg ? 'medium' : 'low',
    }
  })

  return Response.json({
    status: 'ok',
    method: 'damped_trend_history_baseline',
    provenance: 'manual_or_synthetic_demo_input',
    productionReady: false,
    weeks,
  })
}
