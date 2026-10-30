import test from 'node:test'
import assert from 'node:assert/strict'

const auth = await import('../src/lib/server-auth.ts')

test('demo farmer credentials authenticate and role is farmer', () => {
  const identity = auth.authenticateServerAccount('FMR-DEMO-1042', '1042')
  assert.equal(identity?.role, 'farmer')
  assert.equal(identity?.farmerId, 'FMR-DEMO-1042')
  assert.equal(auth.authenticateServerAccount('FMR-DEMO-1042', 'wrong'), null)
})

test('all three depot operators map to their respective depot IDs', () => {
  const expected = [
    ['OPS-KNL-01', '2101', 'centre-hr-knl'],
    ['OPS-GWL-01', '2102', 'centre-mp-gwl'],
    ['OPS-DL-01', '2103', 'centre-dl-north'],
  ]
  for (const [id, pin, centreId] of expected) {
    const identity = auth.authenticateServerAccount(id, pin)
    assert.equal(identity?.role, 'operator')
    assert.equal(identity?.centreId, centreId)
  }
})

test('signed HttpOnly session cookie resolves to server-side demo identity', () => {
  const identity = auth.authenticateServerAccount('FMR-DEMO-1043', '1043')
  const cookie = auth.createSessionCookie(identity, false).split(';')[0]
  const request = new Request('http://localhost/api/auth/session', { headers: { cookie } })
  assert.deepEqual(auth.getDemoIdentity(request), identity)
})

test('tampered session cookie is rejected', () => {
  const identity = auth.authenticateServerAccount('OPS-KNL-01', '2101')
  const cookie = auth.createSessionCookie(identity, false).split(';')[0]
  const [name, value] = cookie.split('=')
  const tampered = `${name}=${value.slice(0, -1)}x`
  const request = new Request('http://localhost/api/auth/session', { headers: { cookie: tampered } })
  assert.equal(auth.getDemoIdentity(request), null)
})
