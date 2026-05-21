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
      <body className="min-h-screen flex flex-col">
        <header className="border-b border-gray-200 bg-white">
          <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
            <a href="/" className="text-xl font-bold text-dark tracking-tight">
              Site Title
            </a>
            <nav className="flex gap-6 text-sm font-medium text-gray-600">
              <a href="/" className="hover:text-primary transition-colors">Home</a>
              <a href="/blog/" className="hover:text-primary transition-colors">All Guides</a>
            </nav>
          </div>
        </header>
        <main className="flex-1">{children}</main>
        <footer className="border-t border-gray-200 bg-gray-50 mt-16">
          <div className="max-w-4xl mx-auto px-4 py-8 text-sm text-gray-500">
            <p className="mb-2">&copy; {new Date().getFullYear()} Site Title. All rights reserved.</p>
            <p className="text-xs">
              This site contains affiliate links. We may earn a commission when you purchase through our links — at no extra cost to you.
            </p>
          </div>
        </footer>
      </body>
    </html>
  )
}
