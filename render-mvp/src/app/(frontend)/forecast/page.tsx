import type { Metadata } from 'next'
import { KhadSetuApp } from '../components/KhadSetuApp'

export const metadata: Metadata = {
  title: 'Demand Forecast',
  alternates: { canonical: '/forecast' },
  robots: { index: false, follow: false },
}

export default function ForecastPage() {
  return <KhadSetuApp view="forecast" />
}
