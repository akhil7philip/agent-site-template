#!/usr/bin/env node
/**
 * create-site.js
 *
 * Idempotent one-command automation to spin up (or resume) an agent content site.
 *
 * Usage:
 *   GITHUB_TOKEN=ghp_xxx VERCEL_TOKEN=vercel_xxx CLOUDFLARE_API_TOKEN=xxx \
 *   GOOGLE_CLIENT_ID=xxx GOOGLE_CLIENT_SECRET=xxx \
 *   node scripts/create-site.js [--dir ../existing-site] [--yes]
 *
 * Phase 1 — Codegen:    Ensure code exists → replace placeholders → push
 * Phase 2 — Infra:      Ensure GitHub repo → Vercel project → domain
 * Phase 3 — Integrations: Ensure Cloudflare DNS → GA4 → Search Console + sitemap
 */

const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')
const readline = require('readline')
const os = require('os')
const themes = require('../themes')

const TEMPLATE_REPO = 'https://github.com/akhil7philip/agent-content-site.git'
const GITHUB_API = 'https://api.github.com'
const VERCEL_API = 'https://api.vercel.com'
const CLOUDFLARE_API = 'https://api.cloudflare.com/client/v4'
const GA4_API = 'https://analyticsadmin.googleapis.com/v1beta'
const GSC_API = 'https://searchconsole.googleapis.com/webmasters/v3'
const SITE_VERIFY_API = 'https://siteverification.googleapis.com/siteVerification/v1'
const TOKEN_STORAGE = path.join(os.homedir(), '.agent-site-tokens.json')

/* ─── CLI args ─── */

const cliArgs = process.argv.slice(2)
const existingDirArg = getCliArg(['--dir', '-d'])
const themeArg = getCliArg(['--theme', '-t'])
const variantArg = getCliArg(['--variant'])
const skipConfirm = cliArgs.includes('--yes') || cliArgs.includes('-y')

function getCliArg(flags) {
  for (const flag of flags) {
    const idx = cliArgs.indexOf(flag)
    if (idx !== -1 && cliArgs[idx + 1]) return cliArgs[idx + 1]
  }
  return null
}

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
  const original = fs.readFileSync(filePath, 'utf8')
  if (content !== original) {
    fs.writeFileSync(filePath, content)
  }
}

function replaceInDirWithMap(dir, replacements, extensions = ['.ts', '.tsx', '.js', '.json', '.md', '.css', '.xml']) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      // Skip dirs that should never participate in the placeholder sweep.
      // `themes/` is excluded so theme templates remain reusable (their
      // placeholders are replaced at apply-theme time, not scaffold time).
      if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === '.next' || entry.name === 'dist' || entry.name === 'themes') continue
      replaceInDirWithMap(full, replacements, extensions)
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

/* ─── Idempotency helpers ─── */

async function githubRepoExists(token, owner, repo) {
  try {
    await githubApi(token, `/repos/${owner}/${repo}`)
    return true
  } catch (e) {
    if (e.message.includes('404')) return false
    throw e
  }
}

async function getVercelProject(token, name) {
  try {
    return await vercelApi(token, `/v9/projects/${encodeURIComponent(name)}`)
  } catch (e) {
    if (e.message.includes('404')) return null
    throw e
  }
}

async function getVercelDomains(token, projectId) {
  const res = await vercelApi(token, `/v9/projects/${projectId}/domains`)
  return res.domains || []
}

async function getCloudflareDnsRecords(token, zoneId, filters = {}) {
  const query = new URLSearchParams(filters).toString()
  const path = `/zones/${zoneId}/dns_records${query ? '?' + query : ''}`
  const res = await cloudflareApi(token, path)
  return res.result || []
}

async function getGA4Properties(token, accountName) {
  const res = await googleApi(token, `${GA4_API}/accountSummaries`)
  // accountSummaries lists properties inline
  const summaries = res.accountSummaries || []
  for (const acct of summaries) {
    if (acct.name === accountName || acct.account === accountName) {
      return acct.propertySummaries || []
    }
  }
  // Fallback: list properties directly
  const listRes = await googleApi(token, `${GA4_API}/${accountName}/properties?pageSize=200`)
  return listRes.properties || []
}

async function getGA4Streams(token, propertyName) {
  const res = await googleApi(token, `${GA4_API}/${propertyName}/dataStreams`)
  return res.dataStreams || []
}

function hasGa4IdInLayout(layoutPath) {
  if (!fs.existsSync(layoutPath)) return null
  const content = fs.readFileSync(layoutPath, 'utf8')
  const match = content.match(/G-[A-Z0-9]{8,12}/)
  return match ? match[0] : null
}

function isGitDirty(dir) {
  try {
    sh(`git -C "${dir}" diff-index --quiet HEAD --`, { silent: true })
    return false
  } catch {
    return true
  }
}

/* ─── Phase 3: Cloudflare DNS ─── */

async function setupCloudflareDNS(domain, cfToken, gscToken) {
  console.log('\n─── Phase 3: Cloudflare DNS ───\n')

  const zones = await cloudflareApi(cfToken, `/zones?name=${domain}`)
  const zone = zones.result?.[0]
  if (!zone) throw new Error(`Cloudflare zone not found for ${domain}. Is the domain added to Cloudflare?`)
  const zoneId = zone.id

  const records = await getCloudflareDnsRecords(cfToken, zoneId)

  const nameMatches = (r, target) => {
    const n = r.name || ''
    return n === target || n === `${target}.`
  }

  // Add A record for apex domain → Vercel
  const apexA = records.find((r) => r.type === 'A' && nameMatches(r, domain) && r.content === '76.76.21.21')
  if (!apexA) {
    console.log('Adding A record for apex domain...')
    await cloudflareApi(cfToken, `/zones/${zoneId}/dns_records`, {
      method: 'POST',
      body: { type: 'A', name: '@', content: '76.76.21.21', ttl: 1, proxied: false },
    })
  } else {
    console.log('A record for apex domain already exists. Skipping.')
  }

  // Add CNAME for www — skip if ANY www CNAME already exists
  const wwwCname = records.find((r) => r.type === 'CNAME' && nameMatches(r, `www.${domain}`))
  if (!wwwCname) {
    console.log('Adding CNAME record for www...')
    await cloudflareApi(cfToken, `/zones/${zoneId}/dns_records`, {
      method: 'POST',
      body: { type: 'CNAME', name: 'www', content: 'cname.vercel-dns.com', ttl: 1, proxied: false },
    })
  } else {
    console.log(`CNAME record for www already exists (→ ${wwwCname.content}). Skipping.`)
  }

  // Add TXT record for Google Search Console if we have the token
  if (gscToken) {
    const gscTxt = records.find((r) => r.type === 'TXT' && nameMatches(r, domain) && r.content === gscToken)
    if (!gscTxt) {
      console.log('Adding TXT record for Google Search Console...')
      await cloudflareApi(cfToken, `/zones/${zoneId}/dns_records`, {
        method: 'POST',
        body: { type: 'TXT', name: '@', content: gscToken, ttl: 120, proxied: false },
      })
    } else {
      console.log('TXT record for Google Search Console already exists. Skipping.')
    }
  }

  console.log('✅  DNS records ensured.')
}

/* ─── Phase 3: GA4 ─── */

async function ensureGA4(accessToken, brand, domain) {
  console.log('\n─── Phase 3: Google Analytics 4 ───\n')

  // List accounts and try each until one allows property creation
  const accounts = await googleApi(accessToken, `${GA4_API}/accounts`)
  if (!accounts.accounts?.length) throw new Error('No Google Analytics account found. Create one at analytics.google.com first.')

  let property = null
  let accountName = null
  let lastError = null

  for (const account of accounts.accounts) {
    accountName = account.name
    console.log(`Trying GA account: ${accountName} (${account.displayName})`)

    // Check for existing property in this account
    const properties = await getGA4Properties(accessToken, accountName)
    const existing = properties.find((p) => p.displayName === brand)
    if (existing) {
      property = existing
      console.log(`GA4 property already exists: ${property.property || property.name}`)
      break
    }

    // Try creating property
    try {
      property = await googleApi(accessToken, `${GA4_API}/properties`, {
        method: 'POST',
        body: {
          parent: accountName,
          displayName: brand,
          timeZone: 'Asia/Kolkata',
          currencyCode: 'INR',
          industryCategory: 'SHOPPING',
        },
      })
      console.log(`Created GA4 property: ${property.name}`)
      break
    } catch (e) {
      if (e.message.includes('403') || e.message.includes('PERMISSION_DENIED')) {
        console.log(`   Account ${accountName} denied property creation. Trying next...`)
        lastError = e
        property = null
        continue
      }
      throw e
    }
  }

  if (!property) {
    throw new Error(
      `No GA account allowed property creation. ` +
      `Ensure you are an Administrator or Editor on at least one GA account. ` +
      `Last error: ${lastError?.message || 'unknown'}`
    )
  }

  const propertyName = property.name || property.property

  // Check for existing stream
  const streams = await getGA4Streams(accessToken, propertyName)
  let stream = streams.find((s) => s.webStreamData?.defaultUri === `https://${domain}`)
  if (stream) {
    console.log(`Web data stream already exists: ${stream.name}`)
  } else {
    stream = await googleApi(accessToken, `${GA4_API}/${propertyName}/dataStreams`, {
      method: 'POST',
      body: {
        type: 'WEB_DATA_STREAM',
        displayName: `${brand} Website`,
        webStreamData: { defaultUri: `https://${domain}` },
      },
    })
    console.log(`Created web data stream: ${stream.name}`)
  }

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

async function injectGA4IntoRepo(githubToken, owner, repo, measurementId, workDir) {
  console.log('\nInjecting GA4 Measurement ID into repo...')

  const layoutPath = path.join(workDir, 'app', 'layout.tsx')
  if (!fs.existsSync(layoutPath)) {
    console.log('No app/layout.tsx found. Skipping GA4 injection.')
    return
  }

  const existingId = hasGa4IdInLayout(layoutPath)
  if (existingId && existingId !== 'G-XXXXXXXXXX') {
    console.log(`GA4 ID already present (${existingId}). Skipping injection.`)
    return
  }

  replaceInFile(layoutPath, [['G-XXXXXXXXXX', measurementId]])

  if (!isGitDirty(workDir)) {
    console.log('No changes to commit. Skipping push.')
    return
  }

  sh(`git -C "${workDir}" add -A`, { silent: true })
  sh(`git -C "${workDir}" -c user.name="${owner}" -c user.email="bot@agent.site" commit -m "feat: add GA4 measurement ID ${measurementId}"`, { silent: true })

  // Ensure we can push
  try {
    sh(`git -C "${workDir}" push`, { silent: true })
    console.log('✅  GA4 ID injected and pushed.')
  } catch (e) {
    console.warn(`⚠️  Push failed: ${e.message}`)
    console.warn('   You may need to push manually.')
  }
}

/* ─── main ─── */

async function main() {
  console.log('\n🚀  Agent Content Site — Automated Scaffold (Idempotent)\n')

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

  /* theme + variant */
  const availableThemes = themes.listThemes()
  const themeId = themeArg
    || (await ask(`Theme [${availableThemes.join('/')}] (default: classic): `))
    || 'classic'
  const variantsForTheme = themes.loadVariants(themeId)
  const variantIds = Object.keys(variantsForTheme.variants)
  let variantId
  if (variantArg) {
    variantId = variantArg
  } else if (variantIds.length > 1) {
    variantId = (await ask(`Variant [${variantIds.join('/')}] (default: ${variantsForTheme.default}): `)) || variantsForTheme.default
  } else {
    variantId = variantsForTheme.default
  }
  // Validate now so we fail fast before doing any cloning.
  themes.resolveVariant(themeId, variantId)

  const siteUrl = `https://${domain}`
  const repoSlug = `${githubOwner}/${repoName}`
  const vercelProjectName = repoName.toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 50) || `site-${randomId()}`

  console.log('\n📋  Plan:')
  console.log(`   Brand:     ${brand}`)
  console.log(`   Domain:    ${domain}`)
  console.log(`   Niche:     ${niche}`)
  console.log(`   GitHub:    ${repoSlug}`)
  console.log(`   Vercel:    ${vercelProjectName}`)
  console.log(`   Theme:     ${themeId} / ${variantId}`)
  if (existingDirArg) console.log(`   Local dir: ${path.resolve(existingDirArg)}`)
  console.log('')

  if (!skipConfirm) {
    const ok = await ask('Proceed? [Y/n]: ')
    if (ok && ok.toLowerCase() !== 'y') {
      console.log('Aborted.')
      process.exit(0)
    }
  }

  const created = []
  const skipped = []

  /* ─── 2. Phase 1 — Codegen ─── */
  console.log('\n─── Phase 1: Codegen ───\n')

  let workDir
  const tmpDir = path.join(os.tmpdir(), `agent-site-${randomId()}`)

  if (existingDirArg) {
    workDir = path.resolve(existingDirArg)
    if (!fs.existsSync(workDir)) {
      console.error(`❌ Directory does not exist: ${workDir}`)
      process.exit(1)
    }
    console.log(`Using existing directory: ${workDir}`)
  } else {
    fs.mkdirSync(tmpDir, { recursive: true })

    // Check if GitHub repo already exists
    const repoExists = await githubRepoExists(githubToken, githubOwner, repoName)
    let cloneUrl = TEMPLATE_REPO
    let keepGit = false

    if (repoExists) {
      console.log('GitHub repo already exists. Cloning existing repo instead of template.')
      cloneUrl = `https://${githubToken}@github.com/${repoSlug}.git`
      keepGit = true
      skipped.push('GitHub repo')
    } else {
      console.log(`Cloning template → ${tmpDir}`)
    }

    sh(`git clone --depth 1 ${cloneUrl} "${tmpDir}"`, { silent: true })
    if (!keepGit) {
      fs.rmSync(path.join(tmpDir, '.git'), { recursive: true, force: true })
    }
    workDir = tmpDir
  }

  /* apply theme FIRST so the placeholder sweep below also touches the theme's
   * freshly-overlaid files. themes/ itself is excluded from the sweep so it
   * stays reusable for future re-applies. */
  console.log(`Applying theme: ${themeId} / ${variantId}`)
  const themeResult = themes.applyTheme({ theme: themeId, variant: variantId, targetDir: workDir })
  console.log(`✅  Theme applied (${themeResult.label}).`)

  console.log('Replacing placeholders...')
  replaceInDirWithMap(workDir, [
    ['Gear Lab', brand],
    ['gearlab.space', domain],
    ['https://gearlab.space', siteUrl],
    ['Portable Power Stations', niche],
    ['Portable power stations', niche],
    ['portable power stations', niche.toLowerCase()],
    ['akhil7philip', githubOwner],
    ['agent-content-site', repoName],
    // Lowercase brand variant for turbopuffer-style themes.
    ['site title', brand.toLowerCase()],
    ['Site Title', brand],
  ])

  const publishScript = path.join(workDir, 'scripts', 'publish-post.js')
  if (fs.existsSync(publishScript)) {
    let content = fs.readFileSync(publishScript, 'utf8')
    content = content.replace(/owner: process\.env\.GITHUB_OWNER \|\| '[^']+'/, `owner: process.env.GITHUB_OWNER || '${githubOwner}'`)
    content = content.replace(/repo: process\.env\.GITHUB_REPO \|\| '[^']+'/, `repo: process.env.GITHUB_REPO || '${repoName}'`)
    fs.writeFileSync(publishScript, content)
  }

  // Git setup
  const gitDir = path.join(workDir, '.git')
  if (!fs.existsSync(gitDir)) {
    sh(`git init`, { cwd: workDir, silent: true })
    sh(`git -C "${workDir}" -c user.name="${brand}" -c user.email="admin@${domain}" commit --allow-empty -m "init: ${brand} content site"`, { silent: true })
  }

  // Ensure remote points to target repo
  let currentRemote = null
  try {
    currentRemote = sh(`git -C "${workDir}" remote get-url origin`, { silent: true })
  } catch { /* no remote */ }

  const targetRemote = `https://${githubToken}@github.com/${repoSlug}.git`
  if (currentRemote !== targetRemote) {
    if (currentRemote) {
      sh(`git -C "${workDir}" remote set-url origin ${targetRemote}`, { silent: true })
    } else {
      sh(`git -C "${workDir}" remote add origin ${targetRemote}`, { silent: true })
    }
  }

  sh(`git -C "${workDir}" branch -M main`, { silent: true })

  sh(`git -C "${workDir}" add -A`, { silent: true })
  try {
    sh(`git -C "${workDir}" diff --cached --quiet`, { silent: true })
    // no staged changes
  } catch {
    sh(`git -C "${workDir}" -c user.name="${brand}" -c user.email="admin@${domain}" commit -m "chore: apply site placeholders"`, { silent: true })
  }

  /* ─── 3. Phase 2 — GitHub repo ─── */
  console.log('\n─── Phase 2: GitHub Repo ───\n')

  const repoExists = await githubRepoExists(githubToken, githubOwner, repoName)
  if (!repoExists) {
    console.log(`Creating GitHub repo: ${repoSlug}`)
    await githubApi(githubToken, '/user/repos', {
      method: 'POST',
      body: { name: repoName, private: false, description: `${brand} — ${niche} buying guides & reviews` },
    })
    created.push('GitHub repo')
  } else {
    console.log(`GitHub repo ${repoSlug} already exists.`)
    skipped.push('GitHub repo')
  }

  console.log('Pushing code...')
  try {
    sh(`git -C "${workDir}" push -u origin main`, { silent: true })
    console.log('✅  Code pushed.')
  } catch (e) {
    console.warn(`⚠️  Push failed: ${e.message}`)
    console.warn('   If the repo already has divergent history, resolve manually.')
  }

  /* ─── 4. Phase 2 — Vercel ─── */
  console.log('\n─── Phase 2: Vercel ───\n')

  let project = await getVercelProject(vercelToken, vercelProjectName)
  if (!project) {
    console.log(`Creating Vercel project: ${vercelProjectName}`)
    project = await vercelApi(vercelToken, '/v9/projects', {
      method: 'POST',
      body: {
        name: vercelProjectName,
        framework: 'nextjs',
        gitRepository: { type: 'github', repo: repoSlug },
        buildSettings: { buildCommand: 'next build', outputDirectory: 'dist' },
      },
    })
    created.push('Vercel project')
  } else {
    console.log(`Vercel project ${vercelProjectName} already exists.`)
    skipped.push('Vercel project')
  }

  const domains = await getVercelDomains(vercelToken, project.id)
  const hasDomain = domains.some((d) => d.name === domain)
  if (!hasDomain) {
    console.log(`Adding custom domain: ${domain}`)
    try {
      await vercelApi(vercelToken, `/v9/projects/${project.id}/domains`, {
        method: 'POST',
        body: { name: domain },
      })
      console.log('✅  Domain added in Vercel.')
      created.push('Vercel domain')
    } catch (err) {
      console.warn(`⚠️  Could not add domain automatically: ${err.message}`)
    }
  } else {
    console.log(`Domain ${domain} already linked in Vercel.`)
    skipped.push('Vercel domain')
  }

  /* ─── 5. Phase 3 — Integrations ─── */
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
      created.push('Cloudflare DNS')
    } catch (e) {
      console.warn(`\n⚠️  Cloudflare DNS setup failed: ${e.message}`)
    }
  } else {
    console.log('\n⏭️  Skipping Cloudflare DNS (set CLOUDFLARE_API_TOKEN to enable)')
    console.log('   Create a token at https://dash.cloudflare.com/profile/api-tokens')
    console.log('   Permissions: Zone:Read, DNS:Edit for your domain zone')
  }

  if (googleClientId && googleClientSecret) {
    try {
      const refreshToken = loadTokens().googleRefreshToken
      if (refreshToken) {
        const accessToken = await googleAccessToken(refreshToken, googleClientId, googleClientSecret)
        measurementId = await ensureGA4(accessToken, brand, domain)
        await injectGA4IntoRepo(githubToken, githubOwner, repoName, measurementId, workDir)
        created.push('GA4 property + stream')
      }
    } catch (e) {
      console.warn(`\n⚠️  Google Analytics setup failed: ${e.message}`)
    }
  }

  /* ─── 6. Done ─── */
  console.log('\n✅  Done!\n')
  console.log(`GitHub:    https://github.com/${repoSlug}`)
  console.log(`Vercel:    https://vercel.com/dashboard/${vercelProjectName}`)
  console.log(`Live URL:  https://${domain}  (DNS may take a few minutes)`)
  if (measurementId) console.log(`GA4 ID:    ${measurementId}`)

  if (created.length) console.log(`\nCreated:   ${created.join(', ')}`)
  if (skipped.length) console.log(`Skipped:   ${skipped.join(', ')}`)

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

  if (workDir === tmpDir && fs.existsSync(tmpDir)) {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  }
}

main().catch((err) => {
  console.error('\n❌ Error:', err.message)
  process.exit(1)
})
