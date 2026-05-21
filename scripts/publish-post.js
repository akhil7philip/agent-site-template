/**
 * Kimi Claw Publishing Script
 * 
 * This script is executed by Kimi Claw to publish a new article to your site.
 * It creates a markdown file in the content/posts directory and commits it to GitHub.
 * 
 * Usage: The agent generates the article content and calls this script via Kimi Claw's
 * code execution capability, or uses the GitHub API directly.
 * 
 * REQUIRED ENVIRONMENT VARIABLES:
 *   GITHUB_TOKEN    - GitHub personal access token (classic) with repo scope
 *   GITHUB_OWNER    - Your GitHub username
 *   GITHUB_REPO     - Your repository name
 *   GITHUB_BRANCH   - Branch to commit to (default: main)
 */

// ============================================
// CONFIGURATION - Update these for your setup
// ============================================
const CONFIG = {
  owner: process.env.GITHUB_OWNER || 'akhil7philip',
  repo: process.env.GITHUB_REPO || 'agent-content-site',
  branch: process.env.GITHUB_BRANCH || 'main',
  postsPath: 'content/posts',
};

// ============================================
// ARTICLE TEMPLATE
// ============================================
function generateFrontmatter(data) {
  const fm = [
    `---`,
    `title: "${data.title}"`,
    `date: "${data.date}"`,
    `excerpt: "${data.excerpt}"`,
    `author: "${data.author || 'Editorial Team'}"`,
    data.category ? `category: "${data.category}"` : null,
    data.tags?.length ? `tags: [${data.tags.map(t => `"${t}"`).join(', ')}]` : null,
    data.coverImage ? `coverImage: "${data.coverImage}"` : null,
    `metaTitle: "${data.metaTitle || data.title}"`,
    `metaDescription: "${data.metaDescription || data.excerpt}"`,
    `lastModified: "${data.date}"`,
    `articleSchema: true`,
    data.keywords?.length ? `keywords: [${data.keywords.map(k => `"${k}"`).join(', ')}]` : null,
    `robots: "index, follow"`,
    `---`,
    ``,
  ];
  return fm.filter(Boolean).join('\n');
}

// ============================================
// GITHUB API HELPERS
// ============================================
async function githubApi(path, options = {}) {
  const url = `https://api.github.com/repos/${CONFIG.owner}/${CONFIG.repo}${path}`;
  const response = await fetch(url, {
    headers: {
      'Authorization': `token ${process.env.GITHUB_TOKEN}`,
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'KimiClaw-Publisher',
      ...options.headers,
    },
    ...options,
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`GitHub API error (${response.status}): ${error}`);
  }
  
  return response.json();
}

async function getFileSha(path) {
  try {
    const data = await githubApi(`/contents/${path}?ref=${CONFIG.branch}`);
    return data.sha;
  } catch (e) {
    return null; // File doesn't exist
  }
}

async function commitFile(path, content, message) {
  const existingSha = await getFileSha(path);
  
  const body = {
    message: message,
    content: Buffer.from(content).toString('base64'),
    branch: CONFIG.branch,
    ...(existingSha && { sha: existingSha }),
  };
  
  return githubApi(`/contents/${path}`, {
    method: 'PUT',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });
}

// ============================================
// MAIN PUBLISH FUNCTION
// ============================================
async function publishPost(articleData) {
  // Validate required fields
  if (!articleData.title || !articleData.content || !articleData.excerpt) {
    throw new Error('Missing required fields: title, content, and excerpt are required');
  }
  
  // Generate slug from title
  const slug = articleData.slug || articleData.title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .slice(0, 60);
  
  // Use today's date if not provided
  const date = articleData.date || new Date().toISOString().split('T')[0];
  
  // Build the full markdown file
  const frontmatter = generateFrontmatter({
    ...articleData,
    date,
  });
  
  const fullContent = frontmatter + articleData.content;
  const filePath = `${CONFIG.postsPath}/${slug}.md`;
  const commitMessage = `content: add "${articleData.title}"`;
  
  // Commit to GitHub
  const result = await commitFile(filePath, fullContent, commitMessage);
  
  return {
    success: true,
    slug,
    url: `https://${CONFIG.owner}.github.io/${CONFIG.repo}/blog/${slug}/`,
    commit: result.commit.sha,
    message: `Published: ${articleData.title}`,
  };
}

// ============================================
// EXAMPLE USAGE (for Kimi Claw)
// ============================================
/*
The Kimi Claw agent would construct the articleData object like this:

const articleData = {
  title: "Best Portable Power Stations for Camping in 2026",
  excerpt: "We tested 12 top-rated portable power stations to find the best options for camping, van life, and outdoor adventures. Here's what actually works.",
  content: `# Best Portable Power Stations for Camping in 2026

When you're off-grid, reliable power isn't a luxury—it's a necessity...`,
  tags: ["portable power", "camping", "outdoor gear", "buying guide"],
  category: "Buying Guides",
  author: "Outdoor Gear Lab",
  keywords: ["portable power station", "camping power", "best power station 2026"],
};

publishPost(articleData).then(console.log).catch(console.error);
*/

module.exports = { publishPost, generateFrontmatter, commitFile };

// If called directly
if (require.main === module) {
  console.log('Kimi Claw Publishing Script loaded.');
  console.log('Usage: Call publishPost(articleData) from Kimi Claw code execution.');
}
