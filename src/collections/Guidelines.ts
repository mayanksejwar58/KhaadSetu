import type { CollectionConfig } from 'payload'

const adminOnly = ({ req }: { req: { user?: { collection?: string } | null } }) =>
  req.user?.collection === 'admins'

export const Guidelines: CollectionConfig = {
  slug: 'agronomic-guidelines',
  admin: { group: 'Governance', useAsTitle: 'ruleCode' },
  access: { create: adminOnly, delete: adminOnly, read: adminOnly, update: adminOnly },
  fields: [
    { name: 'ruleCode', type: 'text', required: true, unique: true },
    { name: 'version', type: 'text', required: true },
    { name: 'crop', type: 'text', required: true, index: true },
    { name: 'productCode', type: 'text', required: true },
    { name: 'jurisdiction', type: 'text', required: true },
    { name: 'season', type: 'text', required: true },
    { name: 'commercialRateKgHa', type: 'number', required: true, min: 0 },
    { name: 'sourceTitle', type: 'text', required: true },
    { name: 'sourceReference', type: 'text', required: true },
    { name: 'reviewerNameAndRole', type: 'text', required: true },
    { name: 'approvedAt', type: 'date', required: true },
    { name: 'activeFrom', type: 'date', required: true },
    { name: 'activeUntil', type: 'date' },
    { name: 'limitations', type: 'textarea', required: true },
    { name: 'approved', type: 'checkbox', defaultValue: false },
  ],
}
