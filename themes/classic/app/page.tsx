import Link from 'next/link'
import { getAllPosts, getAllTags } from '@/lib/posts'

export default function HomePage() {
  const posts = getAllPosts()
  const tags = getAllTags()

  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      {/* Hero */}
      <section className="mb-16">
        <h1 className="text-4xl md:text-5xl font-extrabold text-dark tracking-tight mb-4">
          Expert Reviews & Buying Guides
        </h1>
        <p className="text-lg text-gray-600 max-w-2xl">
          In-depth comparisons, hands-on testing, and honest recommendations to help you make the best purchasing decisions.
        </p>
      </section>

      {/* Tags */}
      {tags.length > 0 && (
        <section className="mb-10">
          <div className="flex flex-wrap gap-2">
            {tags.map((tag) => (
              <span
                key={tag}
                className="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded-full"
              >
                {tag}
              </span>
            ))}
          </div>
        </section>
      )}

      {/* Post Grid */}
      <section>
        <h2 className="text-xl font-bold text-dark mb-6">Latest Guides</h2>
        <div className="grid md:grid-cols-2 gap-6">
          {posts.map((post) => (
            <article
              key={post.slug}
              className="group border border-gray-200 rounded-xl p-5 hover:border-primary hover:shadow-md transition-all"
            >
              <Link href={`/blog/${post.slug}/`}>
                <time className="text-xs text-gray-400 font-medium">
                  {new Date(post.date).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                  })}
                </time>
                <h3 className="text-lg font-bold text-dark mt-2 group-hover:text-primary transition-colors">
                  {post.title}
                </h3>
                <p className="text-sm text-gray-600 mt-2 line-clamp-2">{post.excerpt}</p>
                {post.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-3">
                    {post.tags.slice(0, 3).map((tag) => (
                      <span key={tag} className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded">
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </Link>
            </article>
          ))}
        </div>
      </section>
    </div>
  )
}
