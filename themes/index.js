/**
 * themes/index.js — shared helpers for theme listing and application.
 *
 * Used by:
 *   - scripts/apply-theme.js  (CLI wrapper, re-theme an existing site)
 *   - scripts/create-site.js  (scaffolding flow)
 */

const fs = require('fs')
const path = require('path')

const THEMES_DIR = __dirname

function listThemes() {
  return fs
    .readdirSync(THEMES_DIR, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort()
}

function loadVariants(themeId) {
  const file = path.join(THEMES_DIR, themeId, 'variants.json')
  if (!fs.existsSync(file)) {
    throw new Error(`Theme "${themeId}" has no variants.json (expected at ${file})`)
  }
  return JSON.parse(fs.readFileSync(file, 'utf8'))
}

function renderTemplate(text, values) {
  return text.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    if (!(key in values)) {
      throw new Error(`Variant is missing value for placeholder "{{${key}}}"`)
    }
    return values[key]
  })
}

function describeThemes() {
  return listThemes().map((id) => {
    const v = loadVariants(id)
    return {
      id,
      defaultVariant: v.default,
      variants: Object.entries(v.variants).map(([vid, val]) => ({ id: vid, label: val.label })),
    }
  })
}

function resolveVariant(themeId, variantId) {
  const variants = loadVariants(themeId)
  const resolvedId = variantId || variants.default
  const values = variants.variants[resolvedId]
  if (!values) {
    const available = Object.keys(variants.variants).join(', ')
    throw new Error(`Variant "${resolvedId}" not found in theme "${themeId}". Available: ${available}`)
  }
  return { id: resolvedId, values }
}

/** Recursively copy a directory tree. Returns number of files copied. No-op if src doesn't exist. */
function copyDirRecursive(srcDir, dstDir) {
  if (!fs.existsSync(srcDir)) return 0
  let count = 0
  for (const entry of fs.readdirSync(srcDir, { withFileTypes: true })) {
    const srcPath = path.join(srcDir, entry.name)
    const dstPath = path.join(dstDir, entry.name)
    if (entry.isDirectory()) {
      fs.mkdirSync(dstPath, { recursive: true })
      count += copyDirRecursive(srcPath, dstPath)
    } else {
      fs.mkdirSync(path.dirname(dstPath), { recursive: true })
      fs.copyFileSync(srcPath, dstPath)
      count++
    }
  }
  return count
}

/**
 * Subdirectories of a theme that get overlaid onto the target site.
 * `classic` is treated as the canonical baseline and is always overlaid first,
 * so switching themes resets these directories to a known state before the
 * chosen theme's overrides are layered on top.
 */
const OVERLAY_DIRS = ['app', 'components']

/**
 * Capture site-specific values from the existing target so the theme overlay
 * can be re-applied without clobbering them (GA4 ID, brand, domain, niche
 * metadata). Returns null if the target has no app/layout.tsx yet (e.g. a
 * brand-new scaffold before placeholders have been substituted).
 */
function captureSiteValues(targetDir) {
  const layoutPath = path.join(targetDir, 'app', 'layout.tsx')
  if (!fs.existsSync(layoutPath)) return null
  const text = fs.readFileSync(layoutPath, 'utf8')

  const captureKey = (key) => {
    const m = text.match(new RegExp(`${key}\\s*:\\s*'((?:[^'\\\\]|\\\\.)*)'`))
    return m ? m[1].replace(/\\'/g, "'") : null
  }

  const urlMatch = text.match(/metadataBase:\s*new URL\('([^']+)'\)/)
  let domain = null
  let siteUrl = null
  if (urlMatch) {
    try { const u = new URL(urlMatch[1]); domain = u.hostname; siteUrl = u.origin } catch { /* ignore */ }
  }

  const gaMatch = text.match(/G-[A-Z0-9]+/)
  const gaId = gaMatch && gaMatch[0] !== 'G-XXXXXXXXXX' ? gaMatch[0] : null

  // Brand: prefer openGraph.siteName since it's an authoritative string.
  const brand = captureKey('siteName')

  return {
    gaId,
    brand,
    domain,
    siteUrl,
    titleDefault: captureKey('default'),
    titleTemplate: captureKey('template'),
    description: captureKey('description'),
  }
}

/**
 * Re-inject captured site-specific values into the freshly-overlaid app files,
 * substituting any placeholders the overlay re-introduced (Site Title, Gear
 * Lab, gearlab.space, G-XXXXXXXXXX, etc.).
 */
function restoreSiteValues(targetDir, captured) {
  if (!captured) return { restored: false }
  const targets = [
    path.join(targetDir, 'app', 'layout.tsx'),
    path.join(targetDir, 'app', 'page.tsx'),
    path.join(targetDir, 'app', 'blog', 'page.tsx'),
    path.join(targetDir, 'app', 'blog', '[slug]', 'page.tsx'),
  ]
  const esc = (s) => s.replace(/'/g, "\\'")
  let touched = 0
  for (const f of targets) {
    if (!fs.existsSync(f)) continue
    let text = fs.readFileSync(f, 'utf8')
    const before = text

    if (captured.gaId) text = text.replace(/G-XXXXXXXXXX/g, captured.gaId)
    if (captured.brand) {
      text = text.replace(/Site Title/g, captured.brand)
      text = text.replace(/Gear Lab/g, captured.brand)
      text = text.replace(/site title/g, captured.brand.toLowerCase())
    }
    if (captured.domain) text = text.replace(/gearlab\.space/g, captured.domain)
    if (captured.siteUrl) text = text.replace(/https:\/\/gearlab\.space/g, captured.siteUrl)

    if (f.endsWith('layout.tsx')) {
      if (captured.titleDefault) text = text.replace(/default:\s*'[^']*'/, `default: '${esc(captured.titleDefault)}'`)
      if (captured.titleTemplate) text = text.replace(/template:\s*'[^']*'/, `template: '${esc(captured.titleTemplate)}'`)
      if (captured.description) text = text.replace(/description:\s*'[^']*'/, `description: '${esc(captured.description)}'`)
    }

    if (text !== before) { fs.writeFileSync(f, text); touched++ }
  }
  return { restored: touched > 0, filesTouched: touched }
}

function applyTheme({ theme, variant, targetDir }) {
  const themeDir = path.join(THEMES_DIR, theme)
  if (!fs.existsSync(themeDir)) {
    throw new Error(`Theme "${theme}" not found. Available: ${listThemes().join(', ')}`)
  }

  const { id: variantId, values } = resolveVariant(theme, variant)

  const tmplPath = path.join(themeDir, 'tailwind.config.ts.tmpl')
  const cssPath = path.join(themeDir, 'globals.css')
  if (!fs.existsSync(tmplPath)) throw new Error(`Missing template: ${tmplPath}`)
  if (!fs.existsSync(cssPath)) throw new Error(`Missing globals.css: ${cssPath}`)

  const tailwindOut = renderTemplate(fs.readFileSync(tmplPath, 'utf8'), values)
  // globals.css may contain {{accent}} / {{accentHover}} placeholders too.
  const cssOut = renderTemplate(fs.readFileSync(cssPath, 'utf8'), values)

  const targetTailwind = path.join(targetDir, 'tailwind.config.ts')
  const targetCss = path.join(targetDir, 'app', 'globals.css')

  fs.writeFileSync(targetTailwind, tailwindOut)
  fs.mkdirSync(path.dirname(targetCss), { recursive: true })
  fs.writeFileSync(targetCss, cssOut)

  // Capture site-specific values (GA4 ID, brand, domain, niche metadata) before
  // the overlay so we can re-inject them after — protects re-applies on
  // already-deployed sites from being clobbered by template placeholders.
  const preserved = captureSiteValues(targetDir)

  // Overlay component trees: always reset from classic baseline first, then layer
  // the chosen theme's overrides. Themes that don't ship overrides for app/ or
  // components/ inherit the classic versions automatically.
  const layers = theme === 'classic' ? ['classic'] : ['classic', theme]
  let filesCopied = 0
  for (const tid of layers) {
    for (const sub of OVERLAY_DIRS) {
      filesCopied += copyDirRecursive(path.join(THEMES_DIR, tid, sub), path.join(targetDir, sub))
    }
  }

  const restore = restoreSiteValues(targetDir, preserved)

  return { theme, variant: variantId, label: values.label, filesCopied, preserved, restore }
}

module.exports = {
  THEMES_DIR,
  listThemes,
  loadVariants,
  describeThemes,
  resolveVariant,
  renderTemplate,
  applyTheme,
}
