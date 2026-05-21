#!/usr/bin/env node
/**
 * create-site.js
 *
 * One-command automation to spin up a new agent content site from the template.
 *
 * Usage:
 *   GITHUB_TOKEN=ghp_xxx VERCEL_TOKEN=vercel_xxx CLOUDFLARE_API_TOKEN=xxx \
 *   GOOGLE_CLIENT_ID=xxx GOOGLE_CLIENT_SECRET=xxx \
 *   node scripts/create-site.js
 *
 * Phase 1 — Codegen:    Clone template → replace placeholders
 * Phase 2 — Infra:      Create GitHub repo → push → create Vercel project → set domain
 * Phase 3 — Integrations: Cloudflare DNS → GA4 → Search Console verification + sitemap
 */

const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')
const readline = require('readline')
const os = require('os')

const TEMPLATE_REPO = 'https://github.com/akhil7philip/agent-content-site.git'
const GITHUB_API = 'https://api.github.com'
const VERCEL_API = 'https://api.vercel.com'
const CLOUDFLARE_API = 'https://api.cloudflare.com/client/v4'
const GA4_API = 'https://analyticsadmin.googleapis.com/v1beta'
const GSC_API = 'https://searchconsole.googleapis.com/webmasters/v3'
const SITE_VERIFY_API = 'https://siteverification.googleapis.com/v1'
const TOKEN_STORAGE = path.join(os.homedir(), '.agent-site-tokens.json')

/* ─── helpers ─── */

function ask(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
  return new Promise((resolve) => rl.question(question, (ans) => { rl.close(); resolve(ans.trim()) }))
}

function sh(cmd, opts = {}) {
  return execSync(cmd, { encoding: 'utf-8', stdio: opts.silent ? 'pipe' : 'inherit', ...opts }).trim()
}

function randomId() {
  return Math.random().toString(36).slice(2, 8)
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function replaceInFile(filePath, replacements) {
  if (!fs.existsSync(filePath)) return
  let content = fs.readFileSync(filePath, 'utf8')
  for (const [from, to] of replacements) {
    content = content.split(from).join(to)
  }
  fs.writeFileSync(filePath, content)
}

function replaceInDir(dir, replacements, extensions = ['.ts', '.tsx', '.js', '.json', '.md', '.css', '.xml']) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === '.next' || entry.name === 'dist') continue
      replaceInDir(full, replacements, extensions)
    } else if (extensions.some((ext) => entry.name.endsWith(ext))) {
      replaceInFile(full, replacements)
    }
  }
}

async function fetchJson(url, opts = {}) {
  const res = await fetch(url, opts)
  const text = await res.text()
  if (!res.ok) throw new Error(`${opts.method || 'GET'} ${url} → ${res.status}: ${text.slice(0, 300)}`)
  return text ? JSON.parse(text) : {}
}

async function githubApi(token, path, opts = {}) {
  return fetchJson(`${GITHUB_API}${path}`, {
    headers: {
      Authorization: `token ${token}`,
      Accept: 'application/vnd.github.v3+json',
      'User-Agent': 'create-site-cli',
      'Content-Type': 'application/json',
    },
    ...opts,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  })
}

async function vercelApi(token, path, opts = {}) {
  return fetchJson(`${VERCEL_API}${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    ...opts,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  })
}

async function cloudflareApi(token, path, opts = {}) {
  return fetchJson(`${CLOUDFLARE_API}${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    ...opts,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  })
}

async function googleApi(accessToken, url, opts = {}) {
  return fetchJson(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    ...opts,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  })
}

/* ─── token storage ─── */

function loadTokens() {
  try { return JSON.parse(fs.readFileSync(TOKEN_STORAGE, 'utf8')) } catch { return {} }
}

function saveTokens(tokens) {
  fs.writeFileSync(TOKEN_STORAGE, JSON.stringify(tokens, null, 2))
  fs.chmodSync(TOKEN_STORAGE, 0o600)
}

/* ─── Phase 3: Google OAuth Device Flow ─── */

async function googleDeviceAuth(clientId, clientSecret) {
  const tokens = loadTokens()
  if (tokens.googleRefreshToken) {
    console.log('Using cached Google refresh token.')
    return tokens.googleRefreshToken
  }

  const scope = encodeURIComponent([
    'https://www.googleapis.com/auth/analytics.edit',
    'https://www.googleapis.com/auth/webmasters',
    'https://www.googleapis.com/auth/siteverification',
  ].join(' '))

  const deviceRes = await fetch('https://oauth2.googleapis.com/device/code', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `client_id=${clientId}&scope=${scope}`,
  })
  const device = await deviceRes.json()
  if (device.error) throw new Error(device.error)

  console.log('\n🔐  Google Authorization Required')
  console.log(`   1. Open: ${device.verification_url}`)
  console.log(`   2. Enter code: ${device.user_code}`)
  console.log('   Waiting for authorization...\n')

  const deadline = Date.now() + (device.expires_in * 1000)
  while (Date.now() < deadline) {
    await sleep(device.interval * 1000)

    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `client_id=${clientId}&client_secret=${clientSecret}&device_code=${device.device_code}&grant_type=urn:ietf:params:oauth:grant-type:device_code`,
    })
    const tokenData = await tokenRes.json()

    if (tokenData.access_token) {
      tokens.googleRefreshToken = tokenData.refresh_token || tokens.googleRefreshToken
      saveTokens(tokens)
      console.log('✅  Google authorized.\n')
      return tokens.googleRefreshToken
    }
    if (tokenData.error === 'authorization_pending') continue
    if (tokenData.error === 'slow_down') await sleep(5000)
    else throw new Error(tokenData.error_description || tokenData.error)
  }
  throw new Error('Google authorization timed out.')
}

async function googleAccessToken(refreshToken, clientId, clientSecret) {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `client_id=${clientId}&client_secret=${clientSecret}&refresh_token=${refreshToken}&grant_type=refresh_token`,
  })
  const data = await res.json()
  if (!data.access_token) throw new Error(`Token refresh failed: ${data.error}`)
  return data.access_token
}

/* ─── Phase 3: Cloudflare DNS ─── */

async function setupCloudflareDNS(domain, cfToken, gscToken) {
  console.log('\n─── Phase 3: Cloudflare DNS ───\n')

  const zones = await cloudflareApi(cfToken, `/zones?name=${domain}`)
  const zone = zones.result?.[0]
  if (!zone) throw new Error(`Cloudflare zone not found for ${domain}. Is the domain added to Cloudflare?`)
  const zoneId = zone.id

  // Add A record for apex domain → Vercel
  console.log('Adding A record for apex domain...')
  await cloudflareApi(cfToken, `/zones/${zoneId}/dns_records`, {
    method: 'POST',
    body: { type: 'A', name: '@', content: '76.76.21.21', ttl: 1, proxied: false },
  })

  // Add CNAME for www
  console.log('Adding CNAME record for www...')
  await cloudflareApi(cfToken, `/zones/${zoneId}/dns_records`, {
    method: 'POST',
    body: { type: 'CNAME', name: 'www', content: 'cname.vercel-dns.com', ttl: 1, proxied: false },
  })

  // Add TXT record for Google Search Console if we have the token
  if (gscToken) {
    console.log('Adding TXT record for Google Search Console...')
    await cloudflareApi(cfToken, `/zones/${zoneId}/dns_records`, {
      method: 'POST',
      body: { type: 'TXT', name: '@', content: gscToken, ttl: 120, proxied: false },
    })
  }

  console.log('✅  DNS records added.')
}

/* ─── Phase 3: GA4 ─── */

async function createGA4(accessToken, brand, domain) {
  console.log('\n─── Phase 3: Google Analytics 4 ───\n')

  // List accounts and use the first one
  const accounts = await googleApi(accessToken, `${GA4_API}/accounts`)
  const account = accounts.accounts?.[0]
  if (!account) throw new Error('No Google Analytics account found. Create one at analytics.google.com first.')
  const accountName = account.name // "accounts/123"

  console.log(`Using GA account: ${accountName}`)

  const property = await googleApi(accessToken, `${GA4_API}/properties`, {
    method: 'POST',
    body: {
      parent: accountName,
      displayName: brand,
      timeZone: 'Asia/Kolkata',
      currencyCode: 'INR',
      industryCategory: 'SHOPPING',
    },
  })
  const propertyName = property.name // "properties/123"
  console.log(`Created GA4 property: ${propertyName}`)

  const stream = await googleApi(accessToken, `${GA4_API}/${propertyName}/dataStreams`, {
    method: 'POST',
    body: {
      type: 'WEB_DATA_STREAM',
      displayName: `${brand} Website`,
      webStreamData: { defaultUri: `https://${domain}` },
    },
  })

  const measurementId = stream.webStreamData?.measurementId
  console.log(`Measurement ID: ${measurementId}`)
  return measurementId
}

/* ─── Phase 3: Search Console ─── */

async function setupSearchConsole(accessToken, domain) {
  console.log('\n─── Phase 3: Google Search Console ───\n')

  const siteUrl = encodeURIComponent(`https://${domain}/`)

  // 1. Add site
  console.log('Adding site to Search Console...')
  try {
    await googleApi(accessToken, `${GSC_API}/sites/${siteUrl}`, { method: 'PUT' })
  } catch (e) {
    if (!e.message.includes('409') && !e.message.includes('already exists')) throw e
    console.log('Site already exists.')
  }

  // 2. Get verification token
  console.log('Requesting verification token...')
  const tokenRes = await googleApi(accessToken, `${SITE_VERIFY_API}/token`, {
    method: 'POST',
    body: {
      site: { type: 'INET_DOMAIN', identifier: domain },
      verificationMethod: 'DNS',
    },
  })
  const verificationToken = tokenRes.token
  console.log(`Token: ${verificationToken}`)

  // 3. Wait a moment for DNS propagation
  console.log('Waiting 10s for DNS propagation...')
  await sleep(10000)

  // 4. Verify ownership
  console.log('Verifying ownership...')
  try {
    await googleApi(accessToken, `${SITE_VERIFY_API}/webResource?verificationMethod=DNS`, {
      method: 'POST',
      body: {
        site: { type: 'INET_DOMAIN', identifier: domain },
      },
    })
    console.log('✅  Domain verified.')
  } catch (e) {
    console.warn(`⚠️  Verification failed: ${e.message}`)
    console.warn('   DNS may need more time. Verify manually in Search Console later.')
  }

  // 5. Submit sitemap
  console.log('Submitting sitemap...')
  const sitemapUrl = encodeURIComponent(`https://${domain}/sitemap.xml`)
  try {
    await googleApi(accessToken, `${GSC_API}/sites/${siteUrl}/sitemaps/${sitemapUrl}`, { method: 'PUT' })
    console.log('✅  Sitemap submitted.')
  } catch (e) {
    console.warn(`⚠️  Sitemap submission failed: ${e.message}`)
  }

  return verificationToken
}

/* ─── Phase 3: Inject GA4 into repo ─── */

async function injectGA4IntoRepo(githubToken, owner, repo, measurementId) {
  console.log('\nInjecting GA4 Measurement ID into repo...')

  const tmpDir = path.join(os.tmpdir(), `ga4-inject-${randomId()}`)
  fs.mkdirSync(tmpDir, { recursive: true })

  const remote = `https://${githubToken}@github.com/${owner}/${repo}.git`
  sh(`git clone --depth 1 ${remote} "${tmpDir}"`, { silent: true })

  const layoutPath = path.join(tmpDir, 'app', 'layout.tsx')
  if (fs.existsSync(layoutPath)) {
    replaceInFile(layoutPath, [['G-XXXXXXXXXX', measurementId]])
    sh(`git -C "${tmpDir}" add -A`, { silent: true })
    sh(`git -C "${tmpDir}" -c user.name="${owner}" -c user.email="bot@agent.site" commit -m "feat: add GA4 measurement ID ${measurementId}"`, { silent: true })
    sh(`git -C "${tmpDir}" push`, { silent: true })
    console.log('✅  GA4 ID injected and pushed.')
  }

  fs.rmSync(tmpDir, { recursive: true, force: true })
}

/* ─── main ─── */

async function main() {
  console.log('\n🚀  Agent Content Site — Automated Scaffold (Phases 1 + 2 + 3)\n')

  /* 0. env checks */
  const githubToken = process.env.GITHUB_TOKEN
  const vercelToken = process.env.VERCEL_TOKEN

  if (!githubToken) {
    console.error('❌ Missing GITHUB_TOKEN env var. Create one at https://github.com/settings/tokens (repo scope)')
    process.exit(1)
  }
  if (!vercelToken) {
    console.error('❌ Missing VERCEL_TOKEN env var. Create one at https://vercel.com/account/tokens')
    process.exit(1)
  }

  /* 1. inputs */
  const brand = (await ask('Brand name (e.g. Gear Lab): ')) || 'My Site'
  const domain = (await ask('Domain (e.g. gearlab.space): ')) || 'example.com'
  const niche = (await ask('Niche (e.g. Portable Power Stations): ')) || 'General'
  const githubOwner = (await ask(`GitHub owner/username [${process.env.GITHUB_OWNER || 'akhil7philip'}]: `)) || process.env.GITHUB_OWNER || 'akhil7philip'
  const repoNameDefault = domain.replace(/\./g, '-')
  const repoName = (await ask(`GitHub repo name [${repoNameDefault}]: `)) || repoNameDefault

  const siteUrl = `https://${domain}`
  const repoSlug = `${githubOwner}/${repoName}`
  const vercelProjectName = repoName.toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 50) || `site-${randomId()}`

  console.log('\n📋  Plan:')
  console.log(`   Brand:     ${brand}`)
  console.log(`   Domain:    ${domain}`)
  console.log(`   Niche:     ${niche}`)
  console.log(`   GitHub:    ${repoSlug}`)
  console.log(`   Vercel:    ${vercelProjectName}`)
  console.log('')

  const ok = await ask('Proceed? [Y/n]: ')
  if (ok && ok.toLowerCase() !== 'y') {
    console.log('Aborted.')
    process.exit(0)
  }

  /* 2. Phase 1 — Codegen */
  console.log('\n─── Phase 1: Codegen ───\n')

  const tmpDir = path.join(os.tmpdir(), `agent-site-${randomId()}`)
  fs.mkdirSync(tmpDir, { recursive: true })

  console.log(`Cloning template → ${tmpDir}`)
  sh(`git clone --depth 1 ${TEMPLATE_REPO} "${tmpDir}"`, { silent: true })
  fs.rmSync(path.join(tmpDir, '.git'), { recursive: true, force: true })

  console.log('Replacing placeholders...')
  replaceInDir(tmpDir, [
    ['Gear Lab', brand],
    ['gearlab.space', domain],
    ['https://gearlab.space', siteUrl],
    ['Portable Power Stations', niche],
    ['Portable power stations', niche],
    ['portable power stations', niche.toLowerCase()],
    ['akhil7philip', githubOwner],
    ['agent-content-site', repoName],
  ])

  const publishScript = path.join(tmpDir, 'scripts', 'publish-post.js')
  if (fs.existsSync(publishScript)) {
    let content = fs.readFileSync(publishScript, 'utf8')
    content = content.replace(/owner: process\.env\.GITHUB_OWNER \|\| '[^']+'/, `owner: process.env.GITHUB_OWNER || '${githubOwner}'`)
    content = content.replace(/repo: process\.env\.GITHUB_REPO \|\| '[^']+'/, `repo: process.env.GITHUB_REPO || '${repoName}'`)
    fs.writeFileSync(publishScript, content)
  }

  sh(`git init`, { cwd: tmpDir, silent: true })
  sh(`git -C "${tmpDir}" add -A`, { silent: true })
  sh(`git -C "${tmpDir}" -c user.name="${brand}" -c user.email="admin@${domain}" commit -m "init: ${brand} content site"`, { silent: true })

  /* 3. Phase 2 — GitHub repo */
  console.log('\n─── Phase 2: GitHub Repo ───\n')

  console.log(`Creating GitHub repo: ${repoSlug}`)
  await githubApi(githubToken, '/user/repos', {
    method: 'POST',
    body: { name: repoName, private: false, description: `${brand} — ${niche} buying guides & reviews` },
  })

  console.log('Pushing code...')
  const remote = `https://${githubToken}@github.com/${repoSlug}.git`
  sh(`git -C "${tmpDir}" remote add origin ${remote}`, { silent: true })
  sh(`git -C "${tmpDir}" branch -M main`, { silent: true })
  sh(`git -C "${tmpDir}" push -u origin main`, { silent: true })

  /* 4. Phase 2 — Vercel */
  console.log('\n─── Phase 2: Vercel ───\n')

  console.log(`Creating Vercel project: ${vercelProjectName}`)
  const project = await vercelApi(vercelToken, '/v9/projects', {
    method: 'POST',
    body: {
      name: vercelProjectName,
      framework: 'nextjs',
      gitRepository: { type: 'github', repo: repoSlug },
      buildSettings: { buildCommand: 'next build', outputDirectory: 'dist' },
    },
  })

  console.log(`Adding custom domain: ${domain}`)
  try {
    await vercelApi(vercelToken, `/v9/projects/${project.id}/domains`, {
      method: 'POST',
      body: { name: domain },
    })
    console.log('✅  Domain added in Vercel.')
  } catch (err) {
    console.warn(`⚠️  Could not add domain automatically: ${err.message}`)
  }

  /* 5. Phase 3 — Integrations */
  const cfToken = process.env.CLOUDFLARE_API_TOKEN
  const googleClientId = process.env.GOOGLE_CLIENT_ID
  const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET

  let gscVerificationToken = null
  let measurementId = null

  if (googleClientId && googleClientSecret) {
    try {
      const refreshToken = await googleDeviceAuth(googleClientId, googleClientSecret)
      const accessToken = await googleAccessToken(refreshToken, googleClientId, googleClientSecret)

      // Search Console first (to get the verification token for DNS)
      gscVerificationToken = await setupSearchConsole(accessToken, domain)
    } catch (e) {
      console.warn(`\n⚠️  Google Search Console setup failed: ${e.message}`)
    }
  } else {
    console.log('\n⏭️  Skipping Google Search Console (set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to enable)')
    console.log('   1. Go to https://console.cloud.google.com/')
    console.log('   2. Create a project → APIs & Services → Credentials')
    console.log('   3. Create OAuth 2.0 Client ID (Desktop app)')
    console.log('   4. Enable APIs: Google Analytics Admin API, Search Console API, Site Verification API')
    console.log('   5. Export GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET')
  }

  if (cfToken) {
    try {
      await setupCloudflareDNS(domain, cfToken, gscVerificationToken)
    } catch (e) {
      console.warn(`\n⚠️  Cloudflare DNS setup failed: ${e.message}`)
    }
  } else {
    console.log('\n⏭️  Skipping Cloudflare DNS (set CLOUDFLARE_API_TOKEN to enable)')
    console.log('   Create a token at https://dash.cloudflare.com/profile/api-tokens')
    console.log('   Permissions: Zone:Read, DNS:Edit for your domain zone')
  }

  if (googleClientId && googleClientSecret && measurementId === null) {
    try {
      const refreshToken = loadTokens().googleRefreshToken
      if (refreshToken) {
        const accessToken = await googleAccessToken(refreshToken, googleClientId, googleClientSecret)
        measurementId = await createGA4(accessToken, brand, domain)
        await injectGA4IntoRepo(githubToken, githubOwner, repoName, measurementId)
      }
    } catch (e) {
      console.warn(`\n⚠️  Google Analytics setup failed: ${e.message}`)
    }
  }

  /* 6. Done */
  console.log('\n✅  Done!\n')
  console.log(`GitHub:    https://github.com/${repoSlug}`)
  console.log(`Vercel:    https://vercel.com/dashboard/${vercelProjectName}`)
  console.log(`Live URL:  https://${domain}  (DNS may take a few minutes)`)
  if (measurementId) console.log(`GA4 ID:    ${measurementId}`)

  console.log(`\nNext steps:`)
  if (!cfToken) {
    console.log(`  1. Add DNS records at your provider:`)
    console.log(`       A     ${domain}        → 76.76.21.21`)
    console.log(`       CNAME www.${domain}    → cname.vercel-dns.com`)
  }
  if (!googleClientId) {
    console.log(`  2. Set up Google Analytics manually and update app/layout.tsx`)
    console.log(`  3. Set up Google Search Console manually and submit sitemap.xml`)
  }
  console.log(`  4. Set GITHUB_TOKEN in .env for the Kimi Claw publishing pipeline`)

  fs.rmSync(tmpDir, { recursive: true, force: true })
}

main().catch((err) => {
  console.error('\n❌ Error:', err.message)
  process.exit(1)
})
