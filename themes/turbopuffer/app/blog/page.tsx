import Link from 'next/link'
import { getAllPosts } from '@/lib/posts'

export const metadata = {
  title: 'All Guides',
  description: 'Browse every review and buying guide.',
}

export default function BlogIndexPage() {
  const posts = getAllPosts()

  return (
    <div className="max-w-5xl mx-auto px-6 py-20">
      <header className="mb-12">
        <p className="font-mono text-xs uppercase tracking-[0.18em] text-text-muted mb-4">
          archive
        </p>
        <h1 className="font-serif text-4xl md:text-5xl font-semibold text-text-primary tracking-tight mb-2 lowercase">
          all guides
        </h1>
        <p className="font-mono text-sm text-text-muted tabular-nums">
          {posts.length.toString().padStart(2, '0')} entries
        </p>
      </header>

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
                  <h2 className="font-serif text-lg text-text-primary group-hover:text-accent transition-colors leading-snug">
                    {post.title}
                  </h2>
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
    </div>
  )
}
