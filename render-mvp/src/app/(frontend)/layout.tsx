import type { Metadata } from 'next'
import './styles.css'

export const metadata: Metadata = {
  title: 'KhadSetu | AI Synergy MVP',
  description: 'A demonstration of soil-report OCR, transparent demand forecasting, and stock-aware fertilizer distribution.',
  robots: { index: true, follow: true },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-50 text-slate-950 antialiased">{children}</body>
    </html>
  )
}
