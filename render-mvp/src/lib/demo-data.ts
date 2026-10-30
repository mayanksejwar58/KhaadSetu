export const demoCentres = [
  { id: 'centre-hr-knl', code: 'HR-KNL-01', name: 'Karnal Demonstration Depot', district: 'Karnal', state: 'Haryana', active: true },
  { id: 'centre-mp-gwl', code: 'MP-GWL-01', name: 'Gwalior Demonstration Depot', district: 'Gwalior', state: 'Madhya Pradesh', active: true },
  { id: 'centre-dl-north', code: 'DL-NTH-01', name: 'North Delhi Demonstration Depot', district: 'North Delhi', state: 'Delhi', active: true },
]

const stockRows = [
  ['centre-hr-knl', 'UREA', 1400, 120, 45],
  ['centre-hr-knl', 'DAP', 620, 45, 50],
  ['centre-hr-knl', 'NPK', 410, 30, 50],
  ['centre-mp-gwl', 'UREA', 1120, 80, 45],
  ['centre-mp-gwl', 'DAP', 540, 60, 50],
  ['centre-mp-gwl', 'NPK', 360, 20, 50],
  ['centre-dl-north', 'UREA', 980, 75, 45],
  ['centre-dl-north', 'DAP', 470, 40, 50],
  ['centre-dl-north', 'NPK', 290, 15, 50],
] as const

export const demoInventories = stockRows.map(([centreId, productCode, physicalStockBags, reservedStockBags, bagWeightKg], index) => ({
  id: `demo-inventory-${index + 1}`,
  centre: demoCentres.find((centre) => centre.id === centreId)!,
  productCode,
  physicalStockBags,
  reservedStockBags,
  bagWeightKg,
  demoOnly: true,
}))
