import { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getAllPosts, getPostBySlug, markdownToHtml } from '@/lib/posts'
import NewsletterForm from '@/components/NewsletterForm'

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
    author: {
      '@type': 'Person',
      name: post.author,
      url: post.authorSocial ? `https://twitter.com/${post.authorSocial.replace('@', '')}` : undefined,
    },
    datePublished: post.date,
    dateModified: post.lastModified || post.date,
    publisher: {
      '@type': 'Organization',
      name: 'Gear Lab',
      logo: { '@type': 'ImageObject', url: 'https://gearlab.space/favicon.svg' },
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
      { '@type': 'ListItem', position: 2, name: 'Guides', item: 'https://gearlab.space/blog/' },
      { '@type': 'ListItem', position: 3, name: post.title, item: `https://gearlab.space/blog/${slug}/` },
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
        {/* Back link — minimal breadcrumb */}
        <nav className="mb-10" aria-label="Breadcrumb">
          <ol className="flex items-center gap-2 font-mono text-xs text-text-muted">
            <li><a href="/" className="hover:text-accent transition-colors">home</a></li>
            <li>/</li>
            <li><a href="/blog/" className="hover:text-accent transition-colors">guides</a></li>
          </ol>
        </nav>

        {/* Cover Image */}
        {post.coverImage && (
          <div className="mb-10 rounded overflow-hidden border border-border">
            <img
              src={post.coverImage}
              alt={post.title}
              className="w-full h-64 md:h-72 object-cover"
            />
          </div>
        )}

        {/* Header */}
        <header className="mb-12">
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-text-muted mb-5">
            {post.category || 'guide'}
          </p>
          <h1 className="font-serif text-4xl md:text-5xl font-semibold text-text-primary tracking-tight mb-6 leading-[1.1]">
            {post.title}
          </h1>
          <div className="font-mono text-xs text-text-muted flex flex-wrap gap-x-4 gap-y-1">
            <time dateTime={post.date} className="tabular-nums">
              {new Date(post.date).toISOString().slice(0, 10)}
            </time>
            {post.lastModified && post.lastModified !== post.date && (
              <>
                <span className="text-text-muted/50">·</span>
                <span className="tabular-nums">updated {new Date(post.lastModified).toISOString().slice(0, 10)}</span>
              </>
            )}
            <span className="text-text-muted/50">·</span>
            <span>by {post.author}</span>
          </div>
          {post.tags.length > 0 && (
            <p className="mt-4 font-mono text-[11px] text-text-muted">
              {post.tags.map((tag, i) => (
                <span key={tag}>
                  {tag}
                  {i < post.tags.length - 1 && <span className="text-text-muted/40 mx-1.5">·</span>}
                </span>
              ))}
            </p>
          )}
        </header>

        {/* Content */}
        <div
          className="prose prose-lg max-w-none"
          dangerouslySetInnerHTML={{ __html: contentHtml }}
        />

        {/* Affiliate Disclosure */}
        <div className="affiliate-disclosure">
          <strong>Affiliate Disclosure:</strong> Gear Lab is reader-supported. When you buy through links on our site, we may earn an affiliate commission at no extra cost to you. We independently research and test products. Our opinions are our own.
        </div>

        {/* Author Bio */}
        {post.author && post.authorBio && (
          <div className="author-bio">
            <div className="avatar">
              {post.author.split(' ').map(n => n[0]).join('')}
            </div>
            <div>
              <p className="font-serif text-text-primary font-semibold text-base">{post.author}</p>
              <p className="text-text-secondary text-sm mt-1 leading-relaxed">{post.authorBio}</p>
              {post.authorSocial && (
                <a
                  href={`https://twitter.com/${post.authorSocial.replace('@', '')}`}
                  className="font-mono text-xs text-accent hover:underline mt-2 inline-block"
                >
                  {post.authorSocial}
                </a>
              )}
            </div>
          </div>
        )}

        {/* Newsletter CTA */}
        <div className="mt-12">
          <NewsletterForm />
        </div>
      </article>
    </>
  )
}
