import { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getAllPosts, getPostBySlug, markdownToHtml } from '@/lib/posts'

interface Props {
  params: Promise<{ slug: string }>
}

export async function generateStaticParams() {
  const posts = getAllPosts()
  return posts.map((post) => ({ slug: post.slug }))
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const post = getPostBySlug(slug)
  if (!post) return {}

  return {
    title: { absolute: post.metaTitle || post.title },
    description: post.metaDescription || post.excerpt,
    robots: post.noindex ? 'noindex, nofollow' : post.robots,
    alternates: {
      canonical: post.canonicalUrl || `/blog/${slug}/`,
    },
    openGraph: {
      title: post.ogTitle || post.title,
      description: post.ogDescription || post.excerpt,
      type: 'article',
      publishedTime: post.date,
      modifiedTime: post.lastModified || post.date,
      authors: [post.author],
      tags: post.tags,
      images: post.ogImage ? [{ url: post.ogImage }] : undefined,
    },
    twitter: {
      card: 'summary_large_image',
      title: post.ogTitle || post.title,
      description: post.ogDescription || post.excerpt,
      images: post.ogImage ? [post.ogImage] : undefined,
    },
  }
}

export default async function BlogPostPage({ params }: Props) {
  const { slug } = await params
  const post = getPostBySlug(slug)
  if (!post) notFound()

  const contentHtml = await markdownToHtml(post.content)

  const articleSchema = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: post.title,
    description: post.excerpt,
    author: { '@type': 'Person', name: post.author },
    datePublished: post.date,
    dateModified: post.lastModified || post.date,
    publisher: {
      '@type': 'Organization',
      name: 'Gear Lab',
      logo: { '@type': 'ImageObject', url: 'https://gearlab.space/logo.png' },
    },
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': `https://gearlab.space/blog/${slug}/`,
    },
    ...(post.coverImage && {
      image: { '@type': 'ImageObject', url: post.coverImage },
    }),
    keywords: post.keywords?.join(', ') || post.tags.join(', '),
  }

  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://gearlab.space/' },
      { '@type': 'ListItem', position: 2, name: post.title, item: `https://gearlab.space/blog/${slug}/` },
    ],
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />

      <article className="max-w-2xl mx-auto px-6 py-16">
        {/* Back link */}
        <nav className="mb-12" aria-label="Breadcrumb">
          <a
            href="/blog/"
            className="font-mono text-xs text-gray-500 hover:text-primary transition-colors"
          >
            ← all guides
          </a>
        </nav>

        {/* Header */}
        <header className="mb-12">
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-gray-500 mb-5">
            {post.category || 'guide'}
          </p>
          <h1 className="font-serif text-4xl md:text-5xl font-semibold text-dark tracking-tight mb-6 leading-[1.1]">
            {post.title}
          </h1>
          <div className="font-mono text-xs text-gray-500 flex flex-wrap gap-x-4 gap-y-1">
            <time dateTime={post.date} className="tabular-nums">
              {new Date(post.date).toISOString().slice(0, 10)}
            </time>
            <span className="text-gray-300">·</span>
            <span>by {post.author}</span>
            {post.tags.length > 0 && (
              <>
                <span className="text-gray-300">·</span>
                <span>
                  {post.tags.slice(0, 4).map((tag, i) => (
                    <span key={tag}>
                      {tag}
                      {i < Math.min(post.tags.length, 4) - 1 && <span className="text-gray-300 mx-1">,</span>}
                    </span>
                  ))}
                </span>
              </>
            )}
          </div>
        </header>

        {/* Content */}
        <div
          className="prose prose-lg max-w-none"
          dangerouslySetInnerHTML={{ __html: contentHtml }}
        />

        {/* Affiliate disclosure */}
        <div className="affiliate-disclosure mt-16">
          contains affiliate links — we independently research and test products.
          when you purchase through our links, we may earn a commission at no
          extra cost to you.
        </div>

        {post.lastModified && post.lastModified !== post.date && (
          <p className="font-mono text-xs text-gray-400 mt-8 tabular-nums">
            last updated · {new Date(post.lastModified).toISOString().slice(0, 10)}
          </p>
        )}
      </article>
    </>
  )
}
