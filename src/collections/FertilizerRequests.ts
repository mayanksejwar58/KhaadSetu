import type { CollectionConfig } from 'payload'

const adminOnly = ({ req }: { req: { user?: { collection?: string } | null } }) =>
  req.user?.collection === 'admins'

export const FertilizerRequests: CollectionConfig = {
  slug: 'fertilizer-requests',
  admin: { group: 'KhadSetu Operations', useAsTitle: 'requestCode' },
  access: {
    create: adminOnly,
    delete: adminOnly,
    read: adminOnly,
    update: adminOnly,
  },
  fields: [
    { name: 'requestCode', type: 'text', required: true, unique: true, index: true },
    { name: 'farmerDemoId', type: 'text', required: true, index: true },
    { name: 'centre', type: 'relationship', relationTo: 'centres', required: true },
    { name: 'productCode', type: 'select', required: true, options: ['UREA', 'DAP', 'NPK'] },
    { name: 'quantityBags', type: 'number', required: true, min: 1, max: 100 },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'REQUESTED',
      options: [
        'REQUESTED',
        'RESERVED',
        'WAITLISTED',
        'CONFIRMED',
        'CLAIMED',
        'EXPIRED',
        'CANCELLED',
      ],
    },
    { name: 'idempotencyKey', type: 'text', required: true, unique: true, index: true },
    { name: 'reservationExpiresAt', type: 'date' },
    { name: 'waitlistPosition', type: 'number', min: 1 },
    { name: 'auditNote', type: 'textarea' },
  ],
}
