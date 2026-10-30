import type { Metadata } from 'next'
import { KhadSetuApp } from '../components/KhadSetuApp'

export const metadata: Metadata = {
  title: 'Depot Operator Workspace',
  alternates: { canonical: '/operator' },
  robots: { index: false, follow: false },
}

export default function OperatorPage() {
  return <KhadSetuApp view="operator" />
}
