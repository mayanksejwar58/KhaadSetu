import type { CollectionConfig } from 'payload'

const adminOnly = ({ req }: { req: { user?: { collection?: string } | null } }) =>
  req.user?.collection === 'admins'

export const Inventories: CollectionConfig = {
  slug: 'inventories',
  admin: { group: 'KhadSetu Operations', useAsTitle: 'productCode' },
  access: {
    create: adminOnly,
    delete: adminOnly,
    read: () => true,
    update: adminOnly,
  },
  fields: [
    { name: 'centre', type: 'relationship', relationTo: 'centres', required: true, index: true },
    {
      name: 'productCode',
      type: 'select',
      required: true,
      options: ['UREA', 'DAP', 'NPK'],
    },
    { name: 'physicalStockBags', type: 'number', required: true, min: 0 },
    { name: 'reservedStockBags', type: 'number', required: true, min: 0, defaultValue: 0 },
    { name: 'bagWeightKg', type: 'number', required: true, min: 1 },
    { name: 'lastReconciledAt', type: 'date' },
    { name: 'reconciliationNote', type: 'textarea' },
  ],
}
