import { randomBytes } from 'node:crypto'
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import path from 'node:path'

export type InventoryRow = {
  id: string
  centreId: string
  productCode: 'UREA' | 'DAP' | 'NPK' | 'MOP'
  physicalStockBags: number
  reservedStockBags: number
  bagWeightKg: number
}
export type ReportRecord = {
  id: string
  farmerId: string
  farmerName: string
  fileName: string
  extractedText: string
  readings: Record<string, string>
  crop: string
  areaAcres: number
  createdAt: string
  status: 'awaiting-operator-review' | 'recommendation-ready'
  recommendation?: {
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
}
export type BookingStatus = 'RESERVED' | 'WAITLISTED' | 'CONFIRMED' | 'CLAIMED' | 'EXPIRED' | 'CANCELLED'
export type BookingRecord = {
  id: number
  tokenCode: string
  farmerId: string
  farmerName: string
  reportId: string
  centreId: string
  centreName: string
  productCode: InventoryRow['productCode']
  quantityBags: number
  bagWeightKg: number
  status: BookingStatus
  position: number | null
  otpCode: string | null
  idempotencyKey: string
  createdAt: string
  expiresAt: string | null
  confirmedAt: string | null
  claimedAt: string | null
  claimedBy: string | null
  audit: Array<{ event: string; actorId: string; at: string; details?: Record<string, unknown> }>
}
export type StoreState = {
  version: 1
  nextBookingId: number
  inventories: InventoryRow[]
  reports: ReportRecord[]
  bookings: BookingRecord[]
  inventoryAudit: Array<{ centreId: string; productCode: string; oldPhysical: number; newPhysical: number; reserved: number; actorId: string; at: string; note: string }>
}

const centres = [
  { id: 'centre-hr-knl', code: 'HR-KNL-01', name: 'Karnal Demonstration Depot', district: 'Karnal', state: 'Haryana' },
  { id: 'centre-mp-gwl', code: 'MP-GWL-01', name: 'Gwalior Demonstration Depot', district: 'Gwalior', state: 'Madhya Pradesh' },
  { id: 'centre-dl-north', code: 'DL-NTH-01', name: 'North Delhi Demonstration Depot', district: 'North Delhi', state: 'Delhi' },
]
const initialRows: Array<[string, InventoryRow['productCode'], number, number, number]> = [
  ['centre-hr-knl', 'UREA', 1400, 0, 45], ['centre-hr-knl', 'DAP', 620, 0, 50], ['centre-hr-knl', 'NPK', 410, 0, 50], ['centre-hr-knl', 'MOP', 180, 0, 50],
  ['centre-mp-gwl', 'UREA', 1120, 0, 45], ['centre-mp-gwl', 'DAP', 540, 0, 50], ['centre-mp-gwl', 'NPK', 360, 0, 50], ['centre-mp-gwl', 'MOP', 140, 0, 50],
  ['centre-dl-north', 'UREA', 980, 0, 45], ['centre-dl-north', 'DAP', 470, 0, 50], ['centre-dl-north', 'NPK', 290, 0, 50], ['centre-dl-north', 'MOP', 100, 0, 50],
]

export const demoCentres = centres
function initialState(): StoreState {
  return {
    version: 1,
    nextBookingId: 1,
    inventories: initialRows.map(([centreId, productCode, physicalStockBags, reservedStockBags, bagWeightKg], index) => ({
      id: `demo-inventory-${index + 1}`, centreId, productCode, physicalStockBags, reservedStockBags, bagWeightKg,
    })),
    reports: [],
    bookings: [],
    inventoryAudit: [],
  }
}

function dataFile() {
  return process.env.KHADSETU_DATA_FILE || path.join(process.cwd(), 'data', 'khadsetu-demo-store.json')
}

async function loadState(): Promise<StoreState> {
  const file = dataFile()
  try {
    const raw = JSON.parse(await readFile(file, 'utf8')) as StoreState
    if (raw.version === 1 && Array.isArray(raw.inventories) && Array.isArray(raw.bookings) && Array.isArray(raw.reports)) return { ...initialState(), ...raw, inventoryAudit: Array.isArray(raw.inventoryAudit) ? raw.inventoryAudit : [] }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
  }
  return initialState()
}

let queue: Promise<void> = Promise.resolve()
async function locked<T>(task: () => Promise<T>): Promise<T> {
  let release!: () => void
  const previous = queue
  queue = new Promise<void>((resolve) => { release = resolve })
  await previous
  try { return await task() } finally { release() }
}

async function saveState(state: StoreState) {
  const file = dataFile()
  const folder = path.dirname(file)
  await mkdir(folder, { recursive: true })
  const temp = `${file}.${process.pid}.${randomBytes(4).toString('hex')}.tmp`
  await writeFile(temp, JSON.stringify(state, null, 2), { encoding: 'utf8', mode: 0o600 })
  await rename(temp, file)
}

export async function readStore<T>(reader: (state: StoreState) => T | Promise<T>): Promise<T> {
  return locked(async () => {
    const state = await loadState()
    await saveState(state)
    return reader(structuredClone(state))
  })
}

export async function updateStore<T>(updater: (state: StoreState) => T | Promise<T>): Promise<T> {
  return locked(async () => {
    const state = await loadState()
    const result = await updater(state)
    await saveState(state)
    return structuredClone(result)
  })
}

export function inventoryWithAvailability(state: StoreState) {
  return state.inventories.map((row) => {
    const centre = centres.find((candidate) => candidate.id === row.centreId)!
    return {
      ...row,
      centre,
      availableBags: Math.max(0, row.physicalStockBags - row.reservedStockBags),
      demoOnly: true,
    }
  })
}

function makeOtp() {
  const alphabet = '3456789ABCDEFGHJKMNPQRSTUVWXYZ'
  const bytes = randomBytes(6)
  return Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join('')
}
function makeTokenCode(id: number) {
  return `KS-${new Date().getFullYear()}-${String(id).padStart(6, '0')}`
}
function pushAudit(booking: BookingRecord, event: string, actorId: string, details?: Record<string, unknown>) {
  booking.audit.push({ event, actorId, at: new Date().toISOString(), ...(details ? { details } : {}) })
}
function renumberWaitlist(state: StoreState, centreId: string, productCode: string) {
  state.bookings
    .filter((booking) => booking.centreId === centreId && booking.productCode === productCode && booking.status === 'WAITLISTED')
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id - b.id)
    .forEach((booking, index) => { booking.position = index + 1 })
}
function promoteWaitlist(state: StoreState, centreId: string, productCode: InventoryRow['productCode']) {
  const inventory = state.inventories.find((row) => row.centreId === centreId && row.productCode === productCode)
  if (!inventory) return
  const queueRows = state.bookings
    .filter((booking) => booking.centreId === centreId && booking.productCode === productCode && booking.status === 'WAITLISTED')
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id - b.id)
  for (const booking of queueRows) {
    const available = inventory.physicalStockBags - inventory.reservedStockBags
    if (available < booking.quantityBags) break // strict FIFO; do not skip the head request
    inventory.reservedStockBags += booking.quantityBags
    booking.status = 'RESERVED'
    booking.position = null
    booking.otpCode = makeOtp()
    booking.expiresAt = new Date(Date.now() + 20 * 60_000).toISOString()
    pushAudit(booking, 'TOKEN_PROMOTED_FROM_WAITLIST', 'SYSTEM', { quantityBags: booking.quantityBags })
  }
  renumberWaitlist(state, centreId, productCode)
}
function releaseReservation(state: StoreState, booking: BookingRecord, nextStatus: 'EXPIRED' | 'CANCELLED', actorId: string) {
  const inventory = state.inventories.find((row) => row.centreId === booking.centreId && row.productCode === booking.productCode)
  if (inventory && ['RESERVED', 'CONFIRMED'].includes(booking.status)) {
    inventory.reservedStockBags = Math.max(0, inventory.reservedStockBags - booking.quantityBags)
  }
  booking.status = nextStatus
  booking.otpCode = null
  booking.position = null
  pushAudit(booking, `TOKEN_${nextStatus}`, actorId, { quantityBags: booking.quantityBags })
  promoteWaitlist(state, booking.centreId, booking.productCode)
}
export function recoverExpiredReservations(state: StoreState) {
  const now = Date.now()
  for (const booking of state.bookings) {
    if (['RESERVED', 'CONFIRMED'].includes(booking.status) && booking.expiresAt && Date.parse(booking.expiresAt) <= now) {
      releaseReservation(state, booking, 'EXPIRED', 'SYSTEM')
    }
  }
}

export function createBooking(state: StoreState, input: {
  farmerId: string; farmerName: string; reportId: string; centreId: string; productCode: InventoryRow['productCode']; quantityBags: number; idempotencyKey: string
}) {
  recoverExpiredReservations(state)
  const { farmerId, farmerName, reportId, centreId, productCode, quantityBags, idempotencyKey } = input
  const existing = state.bookings.find((booking) => booking.idempotencyKey === idempotencyKey)
  if (existing) {
    const same = existing.farmerId === farmerId && existing.centreId === centreId && existing.productCode === productCode && existing.quantityBags === quantityBags && existing.reportId === reportId
    if (!same) throw new Error('This booking key was already used for a different request. Refresh and try again.')
    return existing
  }
  if (!Number.isInteger(quantityBags) || quantityBags < 1 || quantityBags > 5000) throw new Error('Bag quantity must be a whole number between 1 and 5,000.')
  const inventory = state.inventories.find((row) => row.centreId === centreId && row.productCode === productCode)
  const centre = centres.find((candidate) => candidate.id === centreId)
  if (!inventory || !centre) throw new Error('Selected depot does not stock this fertilizer product.')
  const report = state.reports.find((item) => item.id === reportId && item.farmerId === farmerId)
  if (!report?.recommendation) throw new Error('An operator-approved recommendation is required before booking.')
  const existingLiveBooking = state.bookings.find((item) => item.reportId === reportId && ['RESERVED', 'WAITLISTED', 'CONFIRMED'].includes(item.status))
  if (existingLiveBooking) throw new Error(`This soil report already has an active allotment token: ${existingLiveBooking.tokenCode} (${existingLiveBooking.status}).`)
  if (report.recommendation.product !== productCode) throw new Error('Booking product must match the operator-approved recommendation.')
  if (report.recommendation.bagWeightKg !== inventory.bagWeightKg) throw new Error(`This depot issues ${inventory.bagWeightKg} kg ${productCode} bags; the operator-approved plan uses ${report.recommendation.bagWeightKg} kg bags. Ask the operator to revise the bag size before booking.`)
  if (quantityBags !== report.recommendation.bagsToBook) throw new Error('Booking bag quantity must match the approved recommendation.')

  const id = state.nextBookingId++
  const available = inventory.physicalStockBags - inventory.reservedStockBags
  const isReserved = available >= quantityBags
  const booking: BookingRecord = {
    id, tokenCode: makeTokenCode(id), farmerId, farmerName, reportId, centreId, centreName: centre.name,
    productCode, quantityBags, bagWeightKg: inventory.bagWeightKg,
    status: isReserved ? 'RESERVED' : 'WAITLISTED',
    position: isReserved ? null : 1 + state.bookings.filter((item) => item.centreId === centreId && item.productCode === productCode && item.status === 'WAITLISTED').length,
    otpCode: isReserved ? makeOtp() : null,
    idempotencyKey, createdAt: new Date().toISOString(),
    expiresAt: isReserved ? new Date(Date.now() + 20 * 60_000).toISOString() : null,
    confirmedAt: null, claimedAt: null, claimedBy: null, audit: [],
  }
  if (isReserved) inventory.reservedStockBags += quantityBags
  pushAudit(booking, isReserved ? 'TOKEN_RESERVED' : 'TOKEN_WAITLISTED', farmerId, { quantityBags, position: booking.position })
  state.bookings.push(booking)
  return booking
}

export function listBookingsForFarmer(state: StoreState, farmerId: string) {
  recoverExpiredReservations(state)
  return state.bookings.filter((booking) => booking.farmerId === farmerId).sort((a, b) => b.id - a.id)
}
export function listBookingsForOperator(state: StoreState, centreId: string) {
  recoverExpiredReservations(state)
  return state.bookings.filter((booking) => booking.centreId === centreId).sort((a, b) => a.id - b.id)
}
export function confirmBooking(state: StoreState, bookingId: number, farmerId: string) {
  recoverExpiredReservations(state)
  const booking = state.bookings.find((item) => item.id === bookingId && item.farmerId === farmerId)
  if (!booking) throw new Error('Booking token was not found for this farmer.')
  if (booking.status !== 'RESERVED') throw new Error(`Only RESERVED tokens can be confirmed. Current status: ${booking.status}.`)
  booking.status = 'CONFIRMED'
  booking.confirmedAt = new Date().toISOString()
  pushAudit(booking, 'TOKEN_CONFIRMED', farmerId)
  return booking
}
export function cancelBooking(state: StoreState, bookingId: number, farmerId: string) {
  recoverExpiredReservations(state)
  const booking = state.bookings.find((item) => item.id === bookingId && item.farmerId === farmerId)
  if (!booking) throw new Error('Booking token was not found for this farmer.')
  if (!['RESERVED', 'CONFIRMED', 'WAITLISTED'].includes(booking.status)) throw new Error(`Booking in ${booking.status} state cannot be cancelled.`)
  releaseReservation(state, booking, 'CANCELLED', farmerId)
  return booking
}
export function redeemBooking(state: StoreState, bookingId: number, operatorId: string, operatorCentreId: string, otp: string) {
  recoverExpiredReservations(state)
  const booking = state.bookings.find((item) => item.id === bookingId)
  if (!booking) throw new Error('Booking token was not found.')
  if (booking.centreId !== operatorCentreId) throw new Error('This token belongs to a different depot.')
  if (booking.status !== 'CONFIRMED') throw new Error(`Only CONFIRMED tokens can be redeemed. Current status: ${booking.status}.`)
  if (!booking.otpCode || booking.otpCode !== otp.trim().toUpperCase()) throw new Error('OTP does not match. Ask the farmer to show the active token.')
  const inventory = state.inventories.find((row) => row.centreId === booking.centreId && row.productCode === booking.productCode)
  if (!inventory || inventory.physicalStockBags < booking.quantityBags || inventory.reservedStockBags < booking.quantityBags) throw new Error('Inventory reservation is inconsistent. Stop fulfilment and reconcile depot stock.')
  inventory.physicalStockBags -= booking.quantityBags
  inventory.reservedStockBags -= booking.quantityBags
  booking.status = 'CLAIMED'
  booking.claimedAt = new Date().toISOString()
  booking.claimedBy = operatorId
  booking.otpCode = null
  pushAudit(booking, 'TOKEN_CLAIMED', operatorId, { quantityBags: booking.quantityBags })
  promoteWaitlist(state, booking.centreId, booking.productCode)
  return booking
}
export function reconcileInventory(state: StoreState, input: { centreId: string; productCode: InventoryRow['productCode']; physicalCount: number; actorId: string; note: string }) {
  if (!Number.isInteger(input.physicalCount) || input.physicalCount < 0 || input.physicalCount > 1_000_000) throw new Error('Physical stock count must be a whole number from 0 to 1,000,000 bags.')
  const inventory = state.inventories.find((row) => row.centreId === input.centreId && row.productCode === input.productCode)
  if (!inventory) throw new Error('No matching inventory record exists at this depot.')
  if (input.physicalCount < inventory.reservedStockBags) throw new Error(`Physical count cannot be below ${inventory.reservedStockBags} already-reserved bags.`)
  const oldPhysical = inventory.physicalStockBags
  inventory.physicalStockBags = input.physicalCount
  state.inventoryAudit.push({ centreId: input.centreId, productCode: input.productCode, oldPhysical, newPhysical: input.physicalCount, reserved: inventory.reservedStockBags, actorId: input.actorId, at: new Date().toISOString(), note: input.note.slice(0, 300) })
  promoteWaitlist(state, input.centreId, input.productCode)
  return { ...inventory, availableBags: inventory.physicalStockBags - inventory.reservedStockBags, oldPhysical }
}

export function serializeBooking(booking: BookingRecord, revealOtp: boolean) {
  return {
    ...booking,
    otpCode: revealOtp && ['RESERVED', 'CONFIRMED'].includes(booking.status) ? booking.otpCode : null,
    audit: booking.audit,
  }
}
