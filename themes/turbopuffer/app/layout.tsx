import type { Metadata } from 'next'
import Script from 'next/script'
import './globals.css'

export const metadata: Metadata = {
  title: {
    default: 'Site Title - Your Niche Authority',
    template: '%s | Site Title',
  },
  description: 'Expert reviews, comparisons, and buying guides to help you make informed decisions.',
  metadataBase: new URL('https://gearlab.space'),
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  openGraph: {
    type: 'website',
    siteName: 'Site Title',
    locale: 'en_US',
  },
  twitter: {
    card: 'summary_large_image',
  },
  alternates: {
    types: {
      'application/rss+xml': '/rss.xml',
    },
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <Script
        src="https://www.googletagmanager.com/gtag/js?id=G-XXXXXXXXXX"
        strategy="afterInteractive"
      />
      <Script id="google-analytics" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', 'G-XXXXXXXXXX');
        `}
      </Script>
      <body className="min-h-screen flex flex-col bg-white">
        {/* Top announcement strip — turbopuffer-style */}
        <div className="border-b border-gray-200/70">
          <div className="max-w-5xl mx-auto px-6 py-2 flex items-center gap-3">
            <span className="font-mono text-[10px] uppercase tracking-[0.15em] px-1.5 py-0.5 bg-primary/10 text-primary border border-primary/20">
              new
            </span>
            <p className="font-mono text-xs text-gray-600 truncate">
              independent product testing — no sponsored placements, ever.
            </p>
          </div>
        </div>

        <header className="border-b border-gray-200/70">
          <div className="max-w-5xl mx-auto px-6 py-3 flex items-center justify-between">
            <a
              href="/"
              className="font-mono text-sm tracking-tight text-dark hover:text-primary transition-colors"
            >
              site title
            </a>
            <nav className="flex items-center gap-5 text-sm font-mono text-gray-600">
              <a href="/" className="hover:text-primary transition-colors">home</a>
              <a href="/blog/" className="hover:text-primary transition-colors">guides</a>
              <a href="/rss.xml" className="hover:text-primary transition-colors">rss</a>
            </nav>
          </div>
        </header>

        <main className="flex-1">{children}</main>

        <footer className="border-t border-gray-200/70 mt-24">
          <div className="max-w-5xl mx-auto px-6 py-8 text-xs font-mono text-gray-500 flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
            <p>&copy; {new Date().getFullYear()} site title · all rights reserved</p>
            <p className="italic">
              contains affiliate links — we may earn commission at no extra cost to you.
            </p>
          </div>
        </footer>
      </body>
    </html>
  )
}
