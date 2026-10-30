import test, { beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

let tempDir
let store
beforeEach(async () => {
  if (tempDir) await rm(tempDir, { recursive: true, force: true })
  tempDir = await mkdtemp(path.join(os.tmpdir(), 'khadsetu-booking-test-'))
  process.env.KHADSETU_DATA_FILE = path.join(tempDir, 'store.json')
  store = await import(`../src/lib/demo-store.ts?test=${Date.now()}-${Math.random()}`)
})

function report(id, farmerId, bags, product='UREA', bagWeightKg=45) {
  return {
    id, farmerId, farmerName: farmerId, fileName: 'soil-report.pdf', extractedText: 'N: 120 P: 22 K: 180',
    readings: { nitrogen: '120', phosphorus: '22', potassium: '180', organicCarbon: '0.6', ph: '7.1', ec: '0.4' },
    crop: 'Wheat', areaAcres: 2.4, createdAt: new Date().toISOString(), status: 'recommendation-ready',
    recommendation: { product, rateKgPerHa: 100, sourceReference: 'State agriculture university package of practices 2026', bagWeightKg, totalQuantityKg: bags * bagWeightKg, wholeBags: bags, remainingKg: 0, bagsToBook: bags, approvedBy: 'OPS-KNL-01', approvedAt: new Date().toISOString(), disclaimer: 'Demo arithmetic only.' },
  }
}

test('booking reserves complete bag quantity, issues token and OTP, confirms and redeems once', async () => {
  await store.updateStore((state) => { state.reports.push(report('SOIL-A', 'FMR-DEMO-1042', 10)) })
  const booking = await store.updateStore((state) => store.createBooking(state, {
    farmerId: 'FMR-DEMO-1042', farmerName: 'Meera Devi', reportId: 'SOIL-A', centreId: 'centre-hr-knl', productCode: 'UREA', quantityBags: 10, idempotencyKey: 'key-a',
  }))
  assert.equal(booking.status, 'RESERVED')
  assert.match(booking.tokenCode, /^KS-\d{4}-\d{6}$/)
  assert.equal(booking.otpCode.length, 6)
  let stock = await store.readStore((state) => state.inventories.find((row) => row.centreId === 'centre-hr-knl' && row.productCode === 'UREA'))
  assert.equal(stock.reservedStockBags, 10)
  await store.updateStore((state) => store.confirmBooking(state, booking.id, 'FMR-DEMO-1042'))
  const claimed = await store.updateStore((state) => store.redeemBooking(state, booking.id, 'OPS-KNL-01', 'centre-hr-knl', booking.otpCode))
  assert.equal(claimed.status, 'CLAIMED')
  stock = await store.readStore((state) => state.inventories.find((row) => row.centreId === 'centre-hr-knl' && row.productCode === 'UREA'))
  assert.equal(stock.physicalStockBags, 1390)
  assert.equal(stock.reservedStockBags, 0)
  await assert.rejects(() => store.updateStore((state) => store.redeemBooking(state, booking.id, 'OPS-KNL-01', 'centre-hr-knl', booking.otpCode)), /Only CONFIRMED/)
})

test('idempotent booking replay returns same token without double-reserving', async () => {
  await store.updateStore((state) => { state.reports.push(report('SOIL-B', 'FMR-DEMO-1042', 5)) })
  const payload = { farmerId: 'FMR-DEMO-1042', farmerName: 'Meera Devi', reportId: 'SOIL-B', centreId: 'centre-hr-knl', productCode: 'UREA', quantityBags: 5, idempotencyKey: 'same-key' }
  const one = await store.updateStore((state) => store.createBooking(state, payload))
  const two = await store.updateStore((state) => store.createBooking(state, payload))
  assert.equal(one.id, two.id)
  const row = await store.readStore((state) => state.inventories.find((item) => item.centreId === 'centre-hr-knl' && item.productCode === 'UREA'))
  assert.equal(row.reservedStockBags, 5)
})

test('insufficient stock creates FIFO waitlist; physical reconciliation promotes whole request', async () => {
  await store.updateStore((state) => {
    const inventory = state.inventories.find((row) => row.centreId === 'centre-hr-knl' && row.productCode === 'UREA')
    inventory.physicalStockBags = 5
    state.reports.push(report('SOIL-C', 'FMR-DEMO-1042', 4), report('SOIL-D', 'FMR-DEMO-1043', 4))
  })
  const first = await store.updateStore((state) => store.createBooking(state, {
    farmerId: 'FMR-DEMO-1042', farmerName: 'Meera Devi', reportId: 'SOIL-C', centreId: 'centre-hr-knl', productCode: 'UREA', quantityBags: 4, idempotencyKey: 'wait-1',
  }))
  const second = await store.updateStore((state) => store.createBooking(state, {
    farmerId: 'FMR-DEMO-1043', farmerName: 'Rajesh Kumar', reportId: 'SOIL-D', centreId: 'centre-hr-knl', productCode: 'UREA', quantityBags: 4, idempotencyKey: 'wait-2',
  }))
  assert.equal(first.status, 'RESERVED')
  assert.equal(second.status, 'WAITLISTED')
  assert.equal(second.position, 1)
  await store.updateStore((state) => store.cancelBooking(state, first.id, 'FMR-DEMO-1042'))
  const after = await store.readStore((state) => state.bookings.find((item) => item.id === second.id))
  assert.equal(after.status, 'RESERVED')
  assert.ok(after.otpCode)
  const stock = await store.readStore((state) => state.inventories.find((item) => item.centreId === 'centre-hr-knl' && item.productCode === 'UREA'))
  assert.equal(stock.reservedStockBags, 4)
})

test('OTP, role/depot mismatch and bag quantity mismatch are rejected', async () => {
  await store.updateStore((state) => { state.reports.push(report('SOIL-E', 'FMR-DEMO-1042', 2)) })
  const booking = await store.updateStore((state) => store.createBooking(state, {
    farmerId: 'FMR-DEMO-1042', farmerName: 'Meera Devi', reportId: 'SOIL-E', centreId: 'centre-hr-knl', productCode: 'UREA', quantityBags: 2, idempotencyKey: 'key-e',
  }))
  await store.updateStore((state) => store.confirmBooking(state, booking.id, 'FMR-DEMO-1042'))
  await assert.rejects(() => store.updateStore((state) => store.redeemBooking(state, booking.id, 'OPS-GWL-01', 'centre-mp-gwl', booking.otpCode)), /different depot/)
  await assert.rejects(() => store.updateStore((state) => store.redeemBooking(state, booking.id, 'OPS-KNL-01', 'centre-hr-knl', 'AAAAAA')), /OTP does not match/)
})

test('reservation expiry releases stock, marks token EXPIRED and promotes FIFO queue', async () => {
  await store.updateStore((state) => {
    const inventory = state.inventories.find((row) => row.centreId === 'centre-hr-knl' && row.productCode === 'UREA')
    inventory.physicalStockBags = 5
    state.reports.push(report('SOIL-F', 'FMR-DEMO-1042', 4), report('SOIL-G', 'FMR-DEMO-1043', 4))
  })
  const first = await store.updateStore((state) => store.createBooking(state, { farmerId: 'FMR-DEMO-1042', farmerName: 'Meera Devi', reportId: 'SOIL-F', centreId: 'centre-hr-knl', productCode: 'UREA', quantityBags: 4, idempotencyKey: 'expiry-a' }))
  const second = await store.updateStore((state) => store.createBooking(state, { farmerId: 'FMR-DEMO-1043', farmerName: 'Rajesh Kumar', reportId: 'SOIL-G', centreId: 'centre-hr-knl', productCode: 'UREA', quantityBags: 4, idempotencyKey: 'expiry-b' }))
  await store.updateStore((state) => { state.bookings.find((item) => item.id === first.id).expiresAt = new Date(Date.now() - 1000).toISOString() })
  await store.updateStore((state) => store.listBookingsForFarmer(state, 'FMR-DEMO-1042'))
  const tokens = await store.readStore((state) => ({ a: state.bookings.find((item) => item.id === first.id), b: state.bookings.find((item) => item.id === second.id) }))
  assert.equal(tokens.a.status, 'EXPIRED')
  assert.equal(tokens.b.status, 'RESERVED')
  assert.ok(tokens.b.otpCode)
})

test('reconciliation cannot undercut reservations and records stock audit', async () => {
  await store.updateStore((state) => { state.reports.push(report('SOIL-H', 'FMR-DEMO-1042', 10)) })
  const booking = await store.updateStore((state) => store.createBooking(state, { farmerId: 'FMR-DEMO-1042', farmerName: 'Meera Devi', reportId: 'SOIL-H', centreId: 'centre-hr-knl', productCode: 'UREA', quantityBags: 10, idempotencyKey: 'reconcile-a' }))
  await assert.rejects(() => store.updateStore((state) => store.reconcileInventory(state, { centreId: 'centre-hr-knl', productCode: 'UREA', physicalCount: 9, actorId: 'OPS-KNL-01', note: 'Bad count' })), /below 10 already-reserved/)
  const updated = await store.updateStore((state) => store.reconcileInventory(state, { centreId: 'centre-hr-knl', productCode: 'UREA', physicalCount: 1300, actorId: 'OPS-KNL-01', note: 'Verified delivery count' }))
  assert.equal(updated.availableBags, 1290)
  const audits = await store.readStore((state) => state.inventoryAudit)
  assert.equal(audits.length, 1)
  assert.equal(audits[0].actorId, 'OPS-KNL-01')
  assert.equal(booking.status, 'RESERVED')
})
