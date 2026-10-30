import type { Metadata } from 'next'
import { KhadSetuApp } from '../components/KhadSetuApp'

export const metadata: Metadata = {
  title: 'Farmer Workspace',
  alternates: { canonical: '/farmer' },
  robots: { index: false, follow: false },
}

export default function FarmerPage() {
  return <KhadSetuApp view="farmer" />
}
