import fs from 'fs'
import path from 'path'
import matter from 'gray-matter'
import { remark } from 'remark'
import remarkGfm from 'remark-gfm'
import remarkHtml from 'remark-html'

const postsDirectory = path.join(process.cwd(), 'content/posts')

export interface Post {
  slug: string
  title: string
  date: string
  excerpt: string
  content: string
  coverImage?: string
  tags: string[]
  author: string
  metaTitle?: string
  metaDescription?: string
  canonicalUrl?: string
  robots?: string
  ogImage?: string
  ogTitle?: string
  ogDescription?: string
  lastModified?: string
  articleSchema?: boolean
  keywords?: string[]
  noindex?: boolean
  category?: string
}

export function getAllPosts(): Post[] {
  if (!fs.existsSync(postsDirectory)) return []
  
  const fileNames = fs.readdirSync(postsDirectory)
  const allPosts = fileNames
    .filter((name) => name.endsWith('.md'))
    .map((fileName) => {
      const slug = fileName.replace(/\.md$/, '')
      const fullPath = path.join(postsDirectory, fileName)
      const fileContents = fs.readFileSync(fullPath, 'utf8')
      const { data, content } = matter(fileContents)

      return {
        slug,
        title: data.title || '',
        date: data.date || new Date().toISOString().split('T')[0],
        excerpt: data.excerpt || '',
        content,
        coverImage: data.coverImage || '',
        tags: data.tags || [],
        author: data.author || 'Editorial Team',
        metaTitle: data.metaTitle || data.title || '',
        metaDescription: data.metaDescription || data.excerpt || '',
        canonicalUrl: data.canonicalUrl || '',
        robots: data.robots || 'index, follow',
        ogImage: data.ogImage || data.coverImage || '',
        ogTitle: data.ogTitle || data.title || '',
        ogDescription: data.ogDescription || data.excerpt || '',
        lastModified: data.lastModified || data.date,
        articleSchema: data.articleSchema !== false,
        keywords: Array.isArray(data.keywords)
          ? data.keywords
          : data.keywords
            ? String(data.keywords).split(',').map((k) => k.trim())
            : [],
        noindex: data.noindex || false,
        category: data.category || '',
      }
    })

  return allPosts.sort((a, b) => (a.date < b.date ? 1 : -1))
}

export function getPostBySlug(slug: string): Post | null {
  const posts = getAllPosts()
  return posts.find((p) => p.slug === slug) || null
}

export function getAllTags(): string[] {
  const posts = getAllPosts()
  const tags = new Set<string>()
  posts.forEach((post) => post.tags.forEach((tag) => tags.add(tag)))
  return Array.from(tags).sort()
}

export function getPostsByTag(tag: string): Post[] {
  return getAllPosts().filter((post) => post.tags.includes(tag))
}

export async function markdownToHtml(markdown: string): Promise<string> {
  const result = await remark().use(remarkGfm).use(remarkHtml).process(markdown)
  return result.toString()
}
