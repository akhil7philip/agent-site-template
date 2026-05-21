import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: '#2563eb',
        'primary-dark': '#1d4ed8',
        dark: '#0f172a',
        'dark-surface': '#1e293b',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      typography: (theme: any) => ({
        DEFAULT: {
          css: {
            color: theme('colors.gray.800'),
            maxWidth: 'none',
            h1: { fontWeight: '800', letterSpacing: '-0.025em' },
            h2: { fontWeight: '700', letterSpacing: '-0.025em', marginTop: '2em' },
            h3: { fontWeight: '600', marginTop: '1.5em' },
            a: { color: theme('colors.primary'), textDecoration: 'none' },
            'a:hover': { textDecoration: 'underline' },
            code: { backgroundColor: theme('colors.gray.100'), padding: '0.2em 0.4em', borderRadius: '0.25em', fontSize: '0.875em' },
            pre: { backgroundColor: theme('colors.gray.900'), color: theme('colors.gray.100'), padding: '1em', borderRadius: '0.5em', overflow: 'auto' },
          },
        },
      }),
    },
  },
  plugins: [require('@tailwindcss/typography')],
}
export default config
