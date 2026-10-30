import type { Metadata } from 'next'
import './styles.css'

const siteUrl = 'https://khadsetu-mvp.onrender.com'
const siteTitle = 'KhadSetu | Soil Insights & Fertilizer Allotment'
const siteDescription =
  'KhadSetu helps farmers submit soil-health reports, review extracted soil readings, and follow transparent fertilizer recommendation, bag allotment, depot booking and token workflows.'

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: siteTitle,
    template: '%s | KhadSetu',
  },
  applicationName: 'KhadSetu',
  description: siteDescription,
  alternates: {
    canonical: '/',
  },
  openGraph: {
    type: 'website',
    locale: 'en_IN',
    url: siteUrl,
    siteName: 'KhadSetu',
    title: siteTitle,
    description: siteDescription,
    images: [
      {
        url: '/og-khadsetu.svg',
        width: 1200,
        height: 630,
        alt: 'KhadSetu soil insights and fertilizer allotment platform',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: siteTitle,
    description: siteDescription,
    images: ['/og-khadsetu.svg'],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
      'max-snippet': -1,
      'max-video-preview': -1,
    },
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-IN">
      <body className="min-h-screen bg-slate-50 text-slate-950 antialiased">{children}</body>
    </html>
  )
}
