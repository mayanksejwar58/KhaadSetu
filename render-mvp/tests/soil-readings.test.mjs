import test from 'node:test'
import assert from 'node:assert/strict'
import { parseSoilReadings } from '../src/lib/farmer-workflow.ts'

test('soil report parser extracts only values adjacent to recognized labels', () => {
  const text = 'Available Nitrogen (kg/ha): 120  Available Phosphorus: 22  Available Potassium: 180  Organic Carbon (%): 0.62  pH: 7.1  Electrical Conductivity (dS/m): 0.4'
  assert.deepEqual(parseSoilReadings(text), {
    nitrogen: '120', phosphorus: '22', potassium: '180', organicCarbon: '0.62', ph: '7.1', ec: '0.4',
  })
})

test('unrecognized or absent soil readings remain blank instead of being invented', () => {
  const result = parseSoilReadings('Farmer name: Example Person. Crop: Wheat. Report number: 1234.')
  assert.deepEqual(result, {
    nitrogen: '', phosphorus: '', potassium: '', organicCarbon: '', ph: '', ec: '',
  })
})

test('parser accepts comma decimal separators without assuming unit conversion', () => {
  const result = parseSoilReadings('N: 120,5 P: 20,2 K: 190 OC (%): 0,55 pH: 6,8 EC: 0,7')
  assert.equal(result.nitrogen, '120.5')
  assert.equal(result.phosphorus, '20.2')
  assert.equal(result.potassium, '190')
  assert.equal(result.organicCarbon, '0.55')
  assert.equal(result.ph, '6.8')
  assert.equal(result.ec, '0.7')
})
