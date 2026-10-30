export type FertilizerQuantity = {
  areaHectares: number
  totalQuantityKg: number
  wholeBags: number
  remainingKg: number
  bagsToBook: number
}

/**
 * Calculate product quantity from an externally approved product application rate.
 * This helper performs unit conversion and retail-pack rounding only; it is not
 * an agronomic recommendation or an ML prediction.
 */
export function calculateFertilizerQuantity(
  areaAcres: number,
  rateKgPerHa: number,
  bagWeightKg: number,
): FertilizerQuantity {
  if (![areaAcres, rateKgPerHa, bagWeightKg].every((value) => Number.isFinite(value) && value > 0)) {
    throw new Error('Area, approved rate, and bag weight must be positive finite numbers.')
  }
  if (areaAcres > 500 || rateKgPerHa > 5000 || bagWeightKg > 1000) {
    throw new Error('One or more values exceed the demo safety limits.')
  }
  const areaHectares = areaAcres * 0.4046856422
  const totalQuantityKg = areaHectares * rateKgPerHa
  const wholeBags = Math.floor(totalQuantityKg / bagWeightKg)
  const remainingKg = Number((totalQuantityKg - wholeBags * bagWeightKg).toFixed(2))
  const bagsToBook = Math.ceil(totalQuantityKg / bagWeightKg)
  return {
    areaHectares: Number(areaHectares.toFixed(4)),
    totalQuantityKg: Number(totalQuantityKg.toFixed(2)),
    wholeBags,
    remainingKg,
    bagsToBook,
  }
}
