import type { CollectionConfig } from 'payload'

const adminOnly = ({ req }: { req: { user?: { collection?: string } | null } }) =>
  req.user?.collection === 'admins'

export const QuotaPolicies: CollectionConfig = {
  slug: 'quota-policies',
  admin: { group: 'Governance', useAsTitle: 'policyCode' },
  access: { create: adminOnly, delete: adminOnly, read: adminOnly, update: adminOnly },
  fields: [
    { name: 'policyCode', type: 'text', required: true, unique: true },
    { name: 'version', type: 'text', required: true },
    { name: 'jurisdiction', type: 'text', required: true },
    { name: 'productCode', type: 'text', required: true },
    { name: 'maximumBags', type: 'number', required: true, min: 1 },
    { name: 'effectiveFrom', type: 'date', required: true },
    { name: 'effectiveUntil', type: 'date' },
    { name: 'sourceReference', type: 'text', required: true },
    { name: 'approvedBy', type: 'text', required: true },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'draft',
      options: ['draft', 'reviewed', 'approved', 'retired'],
    },
  ],
}
