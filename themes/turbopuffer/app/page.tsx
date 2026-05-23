import Link from 'next/link'
import { getAllPosts, getAllTags } from '@/lib/posts'

export default function HomePage() {
  const posts = getAllPosts()
  const tags = getAllTags()

  return (
    <div className="max-w-5xl mx-auto px-6 py-20">
      {/* Hero */}
      <section className="mb-24 max-w-3xl">
        <p className="font-mono text-xs uppercase tracking-[0.18em] text-gray-500 mb-5">
          independent · hands-on · honest
        </p>
        <h1 className="font-serif text-5xl md:text-6xl font-semibold text-dark tracking-tight mb-6 leading-[1.05] lowercase">
          gear research,<br />without the noise.
        </h1>
        <p className="text-lg text-gray-700 leading-relaxed max-w-2xl">
          in-depth comparisons, hands-on testing, and honest recommendations. we
          buy what we review, measure what we claim, and tell you what we&rsquo;d
          actually keep.
        </p>
      </section>

      {/* ASCII flow — turbopuffer signature */}
      <section className="mb-24">
        <pre className="text-[11px] md:text-xs font-mono text-gray-600 leading-tight overflow-x-auto whitespace-pre">
{`    ┏━━━━━━━━━━━━━━━┓        ┏━━━━━━━━━━━━━━━┓        ┏━━━━━━━━━━━━━━━┓
    ┃    research    ┃  ───▶  ┃     testing    ┃  ───▶  ┃     review     ┃
    ┗━━━━━━━━━━━━━━━┛        ┗━━━━━━━━━━━━━━━┛        ┗━━━━━━━━━━━━━━━┛
         shortlist               47+ cycles                  verdict
`}
        </pre>
      </section>

      {/* Topics — inline monospace strip */}
      {tags.length > 0 && (
        <section className="mb-16">
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-gray-500 mb-4">
            topics
          </p>
          <p className="font-mono text-sm text-gray-700 leading-relaxed">
            {tags.map((tag, i) => (
              <span key={tag}>
                {tag}
                {i < tags.length - 1 && <span className="text-gray-300 mx-2">·</span>}
              </span>
            ))}
          </p>
        </section>
      )}

      {/* Articles — tabular list */}
      <section>
        <div className="flex items-baseline justify-between mb-6">
          <h2 className="font-serif text-2xl font-semibold text-dark">latest guides</h2>
          <p className="font-mono text-xs text-gray-500 tabular-nums">
            {posts.length.toString().padStart(2, '0')} entries
          </p>
        </div>
        {posts.length === 0 ? (
          <p className="font-mono text-sm text-gray-500 py-8 border-t border-b border-gray-200/80">
            no entries yet — check back soon.
          </p>
        ) : (
          <ol className="border-t border-b border-gray-200/80">
            {posts.map((post, idx) => (
              <li key={post.slug} className="border-b border-gray-200/80 last:border-b-0">
                <Link
                  href={`/blog/${post.slug}/`}
                  className="group grid grid-cols-[2.5rem_6.5rem_1fr] gap-4 py-5 items-baseline hover:bg-gray-50/70 -mx-4 px-4 transition-colors"
                >
                  <span className="font-mono text-xs text-gray-400 tabular-nums">
                    {String(idx + 1).padStart(2, '0')}
                  </span>
                  <time className="font-mono text-xs text-gray-500 tabular-nums">
                    {new Date(post.date).toISOString().slice(0, 10)}
                  </time>
                  <div>
                    <h3 className="font-serif text-lg text-dark group-hover:text-primary transition-colors leading-snug">
                      {post.title}
                    </h3>
                    <p className="text-sm text-gray-600 mt-1 line-clamp-2 leading-relaxed">
                      {post.excerpt}
                    </p>
                    {post.tags.length > 0 && (
                      <p className="mt-2 font-mono text-[11px] text-gray-500">
                        {post.tags.slice(0, 4).map((tag, i) => (
                          <span key={tag}>
                            {tag}
                            {i < Math.min(post.tags.length, 4) - 1 && <span className="text-gray-300 mx-1.5">·</span>}
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
    </div>
  )
}
