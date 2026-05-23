import Link from 'next/link'

export default function Footer() {
  return (
    <footer className="border-t border-border bg-bg-primary mt-24">
      <div className="max-w-5xl mx-auto px-6 py-10 font-mono text-xs text-text-muted">
        <div className="grid md:grid-cols-3 gap-8 mb-8">
          <div>
            <p className="font-serif text-base font-semibold text-text-primary mb-2 normal-case">Gear Lab</p>
            <p className="text-text-muted font-sans leading-relaxed">
              Independent reviews and buying guides. We buy what we test.
            </p>
          </div>
          <div>
            <p className="uppercase tracking-[0.15em] text-text-muted mb-3">site</p>
            <div className="flex flex-col gap-1.5">
              <Link href="/" className="hover:text-accent transition-colors">home</Link>
              <Link href="/blog/" className="hover:text-accent transition-colors">guides</Link>
              <Link href="/about/" className="hover:text-accent transition-colors">about</Link>
              <Link href="/contact/" className="hover:text-accent transition-colors">contact</Link>
            </div>
          </div>
          <div>
            <p className="uppercase tracking-[0.15em] text-text-muted mb-3">legal</p>
            <div className="flex flex-col gap-1.5">
              <Link href="/privacy/" className="hover:text-accent transition-colors">privacy policy</Link>
              <Link href="/terms/" className="hover:text-accent transition-colors">terms of service</Link>
              <Link href="/rss.xml" className="hover:text-accent transition-colors">rss</Link>
            </div>
          </div>
        </div>
        <div className="border-t border-border pt-5 flex flex-col md:flex-row md:items-center md:justify-between gap-2">
          <p>&copy; {new Date().getFullYear()} Gear Lab · all rights reserved</p>
          <p className="italic text-text-muted">
            contains affiliate links — we may earn commission at no extra cost to you.
          </p>
        </div>
      </div>
    </footer>
  )
}
