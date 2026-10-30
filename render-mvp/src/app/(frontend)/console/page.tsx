import type { Metadata } from 'next'
import { KhadSetuApp } from '../components/KhadSetuApp'

export const metadata: Metadata = {
  title: 'Allocation Console',
  alternates: { canonical: '/console' },
  robots: { index: false, follow: false },
}

export default function ConsolePage() {
  return <KhadSetuApp view="console" />
}
