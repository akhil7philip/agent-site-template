# Themes

Preset visual themes that can be applied when scaffolding a new site (via
`scripts/create-site.js`) or to an existing site (via
`scripts/apply-theme.js`).

Each theme is a directory under `themes/<id>/` containing:

- `tailwind.config.ts.tmpl` — full Tailwind config with `{{token}}`
  placeholders. The applier substitutes variant values.
- `globals.css` — theme-specific `@tailwind` directives, font `@import`s,
  base layer overrides (e.g. serif headings), and component styles.
- `variants.json` — one or more named color variants. Each variant supplies
  values for the placeholders.

Components in `app/` reference semantic Tailwind classes (`text-primary`,
`bg-white`, `text-gray-700`, etc.). Themes redefine those tokens (and, for
the turbopuffer theme, the whole `gray` scale + `white`) so the same JSX
re-skins automatically.

## Available themes

### `classic`
Clean editorial sans-serif (Inter) on a white background. Generic starting point.

| Variant | Label          | Primary | Notes    |
|---------|----------------|---------|----------|
| `blue`  | Blue (generic) | #2563eb | Default. |

### `turbopuffer`
Editorial parchment aesthetic inspired by
[turbopuffer.com](https://turbopuffer.com): cream background, serif
headlines in Newsreader, monospace accents in JetBrains Mono, warm
orange accent.

| Variant   | Label              | Primary | Background | Notes                          |
|-----------|--------------------|---------|-----------|--------------------------------|
| `gearlab` | Cream (Gear Lab)   | #ff6b35 | #f5f0e5    | Default. Primary matches gearlab.space's accent. |

### `furryfinds`
Faithful reproduction of furryfinds.club: warm cream background, Inter
body, Nunito display headings, amber accent.

| Variant   | Label                | Primary | Background | Notes                                 |
|-----------|----------------------|---------|-----------|---------------------------------------|
| `default` | Furry Finds (live)   | #f39c12 | #fef9f3    | Default. Mirrors the live deployment. |

## Applying a theme

When creating a new site:

    node scripts/create-site.js --theme turbopuffer
    node scripts/create-site.js --theme classic --variant warm

If `--theme` is omitted, `create-site.js` prompts interactively.

To re-theme an existing local site:

    node scripts/apply-theme.js --theme turbopuffer --variant cream
    node scripts/apply-theme.js --theme classic --variant warm --dir ../my-site
    node scripts/apply-theme.js --list

The applier overwrites `tailwind.config.ts` and `app/globals.css` and
leaves everything else untouched.

## Adding a new theme

1. Create `themes/<id>/` with the three files above.
2. Use `{{primary}}`, `{{primaryDark}}`, `{{dark}}`, `{{darkSurface}}` in
   `tailwind.config.ts.tmpl`. Add extra placeholders as needed — every
   `{{key}}` must appear in each variant block of `variants.json`.
3. Provide at least one entry in `variants.json` and set `default` to its id.
