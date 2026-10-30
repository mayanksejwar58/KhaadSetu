import type { Metadata } from 'next'
import { KhadSetuApp } from '../components/KhadSetuApp'

export const metadata: Metadata = {
  title: 'Fertilizer Model Status',
  alternates: { canonical: '/model-b' },
  robots: { index: false, follow: false },
}

export default function ModelBPage() {
  return <KhadSetuApp view="model-b" />
}
