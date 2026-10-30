import type { CollectionConfig } from 'payload'

const adminOnly = ({ req }: { req: { user?: { collection?: string } | null } }) =>
  req.user?.collection === 'admins'

export const Centres: CollectionConfig = {
  slug: 'centres',
  admin: { group: 'KhadSetu Operations', useAsTitle: 'name' },
  access: {
    create: adminOnly,
    delete: adminOnly,
    read: () => true,
    update: adminOnly,
  },
  fields: [
    { name: 'code', type: 'text', required: true, unique: true, index: true },
    { name: 'name', type: 'text', required: true },
    { name: 'district', type: 'text', required: true },
    { name: 'state', type: 'text', required: true },
    { name: 'active', type: 'checkbox', defaultValue: true },
  ],
}
