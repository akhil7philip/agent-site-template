import Link from 'next/link'
import ThemeToggle from './ThemeToggle'

export default function Header() {
  return (
    <header className="border-b border-border bg-bg-primary">
      <div className="max-w-5xl mx-auto px-6 py-3 flex items-center justify-between">
        <Link
          href="/"
          className="font-mono text-sm tracking-tight text-text-primary hover:text-accent transition-colors"
        >
          Gear Lab
        </Link>
        <nav className="flex items-center gap-5 text-sm font-mono text-text-muted">
          <Link href="/" className="hover:text-accent transition-colors">home</Link>
          <Link href="/blog/" className="hover:text-accent transition-colors">guides</Link>
          <Link href="/about/" className="hover:text-accent transition-colors">about</Link>
          <Link href="/contact/" className="hover:text-accent transition-colors">contact</Link>
          <ThemeToggle />
        </nav>
      </div>
    </header>
  )
}
