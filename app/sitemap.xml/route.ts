import { getAllPosts } from '@/lib/posts'

export const dynamic = 'force-static'

const BASE_URL = 'https://example.com'

export async function GET() {
  const posts = getAllPosts()

  const routes = [
    { url: `${BASE_URL}/`, lastModified: new Date().toISOString(), priority: '1.0' },
    ...posts.map((post) => ({
      url: `${BASE_URL}/blog/${post.slug}/`,
      lastModified: post.lastModified || post.date,
      priority: '0.8',
    })),
  ]

  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${routes
  .map(
    (route) => `  <url>
    <loc>${route.url}</loc>
    <lastmod>${route.lastModified}</lastmod>
    <priority>${route.priority}</priority>
  </url>`
  )
  .join('\n')}
</urlset>`

  return new Response(sitemap, {
    headers: {
      'Content-Type': 'application/xml',
    },
  })
}
