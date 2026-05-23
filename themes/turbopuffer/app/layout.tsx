import type { Metadata } from 'next'
import Script from 'next/script'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import './globals.css'

export const metadata: Metadata = {
  title: {
    default: 'Gear Lab - Expert Gear Reviews & Buying Guides',
    template: '%s | Gear Lab',
  },
  description: 'Independent reviews, hands-on testing, and no-BS buying guides.',
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
    locale: 'en_US',
    siteName: 'Gear Lab',
    images: ['/og-image.svg'],
  },
  twitter: {
    card: 'summary_large_image',
    images: ['/og-image.svg'],
  },
  icons: {
    icon: [
      { url: '/favicon.svg', type: 'image/svg+xml' },
      { url: '/favicon.ico', sizes: 'any' },
    ],
    shortcut: '/favicon.svg',
    apple: '/favicon.svg',
  },
  alternates: {
    types: {
      'application/rss+xml': '/rss.xml',
    },
  },
}

const themeScript = `
  (function() {
    // Default to light; honour explicit user toggle stored in localStorage.
    const theme = localStorage.getItem('site-theme') || 'light';
    document.documentElement.setAttribute('data-theme', theme);
  })();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" data-theme="light">
      <head>
        <Script id="theme-init" strategy="beforeInteractive">
          {themeScript}
        </Script>
      </head>
      <body className="antialiased min-h-screen flex flex-col">
        <Header />
        <main className="flex-1">{children}</main>
        <Footer />

        <Script
          strategy="afterInteractive"
          src={`https://www.googletagmanager.com/gtag/js?id=${process.env.NEXT_PUBLIC_GA_ID || 'G-XXXXXXXXXX'}`}
        />
        <Script id="ga-init" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', '${process.env.NEXT_PUBLIC_GA_ID || 'G-XXXXXXXXXX'}');
          `}
        </Script>
      </body>
    </html>
  )
}
