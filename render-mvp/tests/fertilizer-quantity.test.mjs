import test from 'node:test'
import assert from 'node:assert/strict'
import { calculateFertilizerQuantity } from '../src/lib/fertilizer-quantity.ts'

test('acres convert to hectares and recommend enough full retail bags', () => {
  const result = calculateFertilizerQuantity(2.4, 100, 45)
  assert.equal(result.areaHectares, 0.9712)
  assert.equal(result.totalQuantityKg, 97.12)
  assert.equal(result.wholeBags, 2)
  assert.equal(result.remainingKg, 7.12)
  assert.equal(result.bagsToBook, 3)
})

test('exact bag multiple does not add an unnecessary extra bag', () => {
  // 1 acre at 111.197... kg/ha yields about 45 kg of product.
  const result = calculateFertilizerQuantity(1, 111.197, 45)
  assert.equal(result.bagsToBook, 1)
  assert.ok(result.totalQuantityKg <= 45)
})

test('rejects invalid and out-of-range quantity inputs', () => {
  assert.throws(() => calculateFertilizerQuantity(0, 100, 45), /positive finite numbers/)
  assert.throws(() => calculateFertilizerQuantity(501, 100, 45), /safety limits/)
})
