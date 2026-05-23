#!/usr/bin/env node
/**
 * apply-theme.js
 *
 * Apply a saved theme + variant to a Next.js site by rewriting
 * tailwind.config.ts and app/globals.css.
 *
 * Usage:
 *   node scripts/apply-theme.js                          # interactive
 *   node scripts/apply-theme.js --theme turbopuffer
 *   node scripts/apply-theme.js --theme classic --variant warm
 *   node scripts/apply-theme.js --theme classic --variant blue --dir ../my-site
 *   node scripts/apply-theme.js --list
 */

const path = require('path')
const readline = require('readline')
const { applyTheme, describeThemes, listThemes, loadVariants } = require('../themes')

const args = process.argv.slice(2)

function getArg(flags) {
  for (const flag of flags) {
    const idx = args.indexOf(flag)
    if (idx !== -1 && args[idx + 1]) return args[idx + 1]
  }
  return null
}

function ask(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
  return new Promise((resolve) => rl.question(question, (ans) => { rl.close(); resolve(ans.trim()) }))
}

function printList() {
  for (const t of describeThemes()) {
    console.log(`\n${t.id}  (default variant: ${t.defaultVariant})`)
    for (const v of t.variants) {
      console.log(`  - ${v.id.padEnd(8)} ${v.label}`)
    }
  }
}

async function main() {
  if (args.includes('--list') || args.includes('-l')) {
    printList()
    return
  }

  const themes = listThemes()
  let theme = getArg(['--theme', '-t'])
  if (!theme) {
    const ans = await ask(`Theme [${themes.join('/')}] (default: classic): `)
    theme = ans || 'classic'
  }

  const variants = loadVariants(theme)
  let variant = getArg(['--variant', '-v'])
  if (!variant) {
    const ids = Object.keys(variants.variants)
    if (ids.length > 1) {
      const ans = await ask(`Variant [${ids.join('/')}] (default: ${variants.default}): `)
      variant = ans || variants.default
    } else {
      variant = variants.default
    }
  }

  const targetDir = path.resolve(getArg(['--dir', '-d']) || '.')

  const result = applyTheme({ theme, variant, targetDir })
  console.log(`\nApplied theme "${result.theme}" / variant "${result.variant}" (${result.label})`)
  console.log(`Wrote: ${path.join(targetDir, 'tailwind.config.ts')}`)
  console.log(`Wrote: ${path.join(targetDir, 'app', 'globals.css')}`)
}

if (require.main === module) {
  main().catch((err) => {
    console.error('\n❌', err.message)
    process.exit(1)
  })
}
