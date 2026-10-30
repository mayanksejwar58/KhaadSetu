type SimulationInput = { stock?: number; requestSize?: number; farmers?: number; seed?: number }

export async function POST(request: Request) {
  const body = (await request.json()) as SimulationInput
  const stock = Math.max(0, Math.trunc(body.stock ?? 100))
  const requestSize = Math.max(1, Math.trunc(body.requestSize ?? 10))
  const farmers = Math.min(500, Math.max(1, Math.trunc(body.farmers ?? 18)))
  const fulfilled = Math.min(farmers, Math.floor(stock / requestSize))
  const naivePromises = farmers
  return Response.json({
    seed: Math.trunc(body.seed ?? 42),
    input: { stock, requestSize, farmers },
    naive: {
      promises: naivePromises,
      overbookedBags: Math.max(0, naivePromises * requestSize - stock),
    },
    khadSetu: {
      reservedRequests: fulfilled,
      waitlistedRequests: farmers - fulfilled,
      overbookedBags: 0,
      queuePositionsValid: true,
    },
    modifiesLiveInventory: false,
  })
}
