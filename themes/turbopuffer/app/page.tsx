import Link from 'next/link'
import { getAllPosts, getAllTags } from '@/lib/posts'
import NewsletterForm from '@/components/NewsletterForm'

export default function HomePage() {
  const posts = getAllPosts()
  const tags = getAllTags()

  return (
    <div className="max-w-5xl mx-auto px-6 py-20">
      {/* Hero */}
      <section className="mb-20 max-w-3xl">
        <p className="font-mono text-xs uppercase tracking-[0.18em] text-text-muted mb-5">
          independent · hands-on · honest
        </p>
        <h1 className="font-serif text-5xl md:text-6xl font-semibold text-text-primary tracking-tight mb-6 leading-[1.05] lowercase">
          gear research,<br />without the noise.
        </h1>
        <p className="text-lg text-text-secondary leading-relaxed">
          in-depth comparisons, hands-on testing, and honest recommendations. we
          buy what we review, measure what we claim, and tell you what we&rsquo;d
          actually keep.
        </p>
      </section>

      {/* Process flow diagram */}
      <section className="mb-20">
        <svg
          viewBox="0 0 720 130"
          xmlns="http://www.w3.org/2000/svg"
          className="w-full max-w-3xl mx-auto block"
          role="img"
          aria-label="Our process: research, then testing, then review"
        >
          <title>Our process: research → testing → review</title>

          {/* Step numbers */}
          <text x="110" y="18" textAnchor="middle" fontFamily="var(--font-mono)" fontSize="10" fill="var(--color-text-muted)" opacity="0.6">01</text>
          <text x="360" y="18" textAnchor="middle" fontFamily="var(--font-mono)" fontSize="10" fill="var(--color-text-muted)" opacity="0.6">02</text>
          <text x="610" y="18" textAnchor="middle" fontFamily="var(--font-mono)" fontSize="10" fill="var(--color-text-muted)" opacity="0.6">03</text>

          {/* Boxes */}
          <rect x="20" y="30" width="180" height="50" rx="3"
                fill="var(--color-bg-secondary)" stroke="var(--color-border)" strokeWidth="1" />
          <rect x="270" y="30" width="180" height="50" rx="3"
                fill="var(--color-bg-secondary)" stroke="var(--color-border)" strokeWidth="1" />
          <rect x="520" y="30" width="180" height="50" rx="3"
                fill="var(--color-bg-secondary)" stroke="var(--color-border)" strokeWidth="1" />

          {/* Box labels */}
          <text x="110" y="62" textAnchor="middle" fontFamily="var(--font-mono)" fontSize="15"
                fontWeight="500" fill="var(--color-text-primary)" letterSpacing="0.02em">research</text>
          <text x="360" y="62" textAnchor="middle" fontFamily="var(--font-mono)" fontSize="15"
                fontWeight="500" fill="var(--color-text-primary)" letterSpacing="0.02em">testing</text>
          <text x="610" y="62" textAnchor="middle" fontFamily="var(--font-mono)" fontSize="15"
                fontWeight="500" fill="var(--color-text-primary)" letterSpacing="0.02em">review</text>

          {/* Sublabels */}
          <text x="110" y="110" textAnchor="middle" fontFamily="var(--font-mono)" fontSize="11"
                fill="var(--color-text-muted)">shortlist</text>
          <text x="360" y="110" textAnchor="middle" fontFamily="var(--font-mono)" fontSize="11"
                fill="var(--color-text-muted)">47+ cycles</text>
          <text x="610" y="110" textAnchor="middle" fontFamily="var(--font-mono)" fontSize="11"
                fill="var(--color-text-muted)">verdict</text>

          {/* Arrows */}
          <g stroke="var(--color-accent)" strokeWidth="1.5" fill="var(--color-accent)">
            <line x1="208" y1="55" x2="258" y2="55" />
            <polygon points="258,49 268,55 258,61" />
            <line x1="458" y1="55" x2="508" y2="55" />
            <polygon points="508,49 518,55 508,61" />
          </g>
        </svg>
      </section>

      {/* Topics */}
      {tags.length > 0 && (
        <section className="mb-16">
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-text-muted mb-4">
            topics
          </p>
          <p className="font-mono text-sm text-text-secondary leading-relaxed">
            {tags.map((tag, i) => (
              <span key={tag}>
                {tag}
                {i < tags.length - 1 && <span className="text-text-muted/40 mx-2">·</span>}
              </span>
            ))}
          </p>
        </section>
      )}

      {/* Articles — tabular list */}
      <section>
        <div className="flex items-baseline justify-between mb-6">
          <h2 className="font-serif text-2xl font-semibold text-text-primary">latest guides</h2>
          <p className="font-mono text-xs text-text-muted tabular-nums">
            {posts.length.toString().padStart(2, '0')} entries
          </p>
        </div>
        {posts.length === 0 ? (
          <p className="font-mono text-sm text-text-muted py-8 border-t border-b border-border">
            no entries yet — check back soon.
          </p>
        ) : (
          <ol className="border-t border-b border-border">
            {posts.map((post, idx) => (
              <li key={post.slug} className="border-b border-border last:border-b-0">
                <Link
                  href={`/blog/${post.slug}/`}
                  className="group grid grid-cols-[2.5rem_6.5rem_1fr] gap-4 py-5 items-baseline hover:bg-bg-secondary -mx-4 px-4 transition-colors"
                >
                  <span className="font-mono text-xs text-text-muted tabular-nums">
                    {String(idx + 1).padStart(2, '0')}
                  </span>
                  <time className="font-mono text-xs text-text-muted tabular-nums">
                    {new Date(post.date).toISOString().slice(0, 10)}
                  </time>
                  <div>
                    <h3 className="font-serif text-lg text-text-primary group-hover:text-accent transition-colors leading-snug">
                      {post.title}
                    </h3>
                    <p className="text-sm text-text-secondary mt-1 line-clamp-2 leading-relaxed">
                      {post.excerpt}
                    </p>
                    {post.tags.length > 0 && (
                      <p className="mt-2 font-mono text-[11px] text-text-muted">
                        {post.tags.slice(0, 4).map((tag, i) => (
                          <span key={tag}>
                            {tag}
                            {i < Math.min(post.tags.length, 4) - 1 && <span className="text-text-muted/40 mx-1.5">·</span>}
                          </span>
                        ))}
                      </p>
                    )}
                  </div>
                </Link>
              </li>
            ))}
          </ol>
        )}
      </section>

      {/* Newsletter Signup */}
      <section className="mt-16">
        <NewsletterForm />
      </section>
    </div>
  )
}
