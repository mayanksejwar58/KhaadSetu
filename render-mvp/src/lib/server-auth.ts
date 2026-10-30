import { createHmac, timingSafeEqual } from 'node:crypto'
import type { DemoIdentity } from './demo-auth'

const COOKIE_NAME = 'khadsetu_demo_session'
const SESSION_TTL_SECONDS = 8 * 60 * 60

const accounts: Array<DemoIdentity & { pin: string }> = [
  { id: 'FMR-DEMO-1042', name: 'Meera Devi', role: 'farmer', farmerId: 'FMR-DEMO-1042', pin: '1042' },
  { id: 'FMR-DEMO-1043', name: 'Rajesh Kumar', role: 'farmer', farmerId: 'FMR-DEMO-1043', pin: '1043' },
  { id: 'OPS-KNL-01', name: 'Anita Sharma', role: 'operator', centreId: 'centre-hr-knl', centreName: 'Karnal Demonstration Depot', pin: '2101' },
  { id: 'OPS-GWL-01', name: 'Rakesh Singh', role: 'operator', centreId: 'centre-mp-gwl', centreName: 'Gwalior Demonstration Depot', pin: '2102' },
  { id: 'OPS-DL-01', name: 'Neha Verma', role: 'operator', centreId: 'centre-dl-north', centreName: 'North Delhi Demonstration Depot', pin: '2103' },
]

type SessionPayload = { identity: DemoIdentity; exp: number }

function getSecret() {
  const secret = process.env.KHADSETU_SESSION_SECRET
  if (secret) return secret
  if (process.env.NODE_ENV === 'production') {
    throw new Error('KHADSETU_SESSION_SECRET must be configured in production.')
  }
  return 'local-only-khadsetu-demo-secret-change-for-production'
}

function signature(value: string) {
  return createHmac('sha256', getSecret()).update(value).digest('base64url')
}

export function authenticateServerAccount(id: string, pin: string): DemoIdentity | null {
  const account = accounts.find((item) => item.id.toLowerCase() === id.trim().toLowerCase() && item.pin === pin)
  if (!account) return null
  const { pin: _pin, ...identity } = account
  return identity
}

export function createSessionCookie(identity: DemoIdentity, secure: boolean) {
  const payload: SessionPayload = { identity, exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS }
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url')
  const value = `${encoded}.${signature(encoded)}`
  return `${COOKIE_NAME}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_TTL_SECONDS}${secure ? '; Secure' : ''}`
}

export function clearSessionCookie(secure: boolean) {
  return `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure ? '; Secure' : ''}`
}

export function getDemoIdentity(request: Request): DemoIdentity | null {
  try {
    const cookie = request.headers.get('cookie') ?? ''
    const match = cookie.split(';').map((part) => part.trim()).find((part) => part.startsWith(`${COOKIE_NAME}=`))
    if (!match) return null
    const token = match.slice(COOKIE_NAME.length + 1)
    const [encoded, supplied] = token.split('.')
    if (!encoded || !supplied) return null
    const expected = signature(encoded)
    const left = Buffer.from(supplied)
    const right = Buffer.from(expected)
    if (left.length !== right.length || !timingSafeEqual(left, right)) return null
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as SessionPayload
    if (!payload.identity?.id || payload.exp <= Math.floor(Date.now() / 1000)) return null
    const account = accounts.find((item) => item.id === payload.identity.id)
    if (!account || account.role !== payload.identity.role) return null
    const { pin: _pin, ...identity } = account
    return identity
  } catch {
    return null
  }
}

export const demoAccountReference = accounts.map(({ pin: _pin, ...identity }) => identity)
