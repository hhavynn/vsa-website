const plugin = require('tailwindcss/plugin');

/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      // ─── Brand tokens ─────────────────────────────────────────────────────
      colors: {
        // Keep the original VSA teal in admin; the public editorial shell
        // supplies blue/periwinkle RGB channels from the Figma concept.
        // CSS channels preserve Tailwind opacity utilities (brand-600/20, etc).
        brand: {
          50:  'rgb(var(--vsa-brand-50, 238 248 247) / <alpha-value>)',
          100: 'rgb(var(--vsa-brand-100, 210 239 236) / <alpha-value>)',
          200: 'rgb(var(--vsa-brand-200, 166 222 218) / <alpha-value>)',
          300: 'rgb(var(--vsa-brand-300, 108 202 194) / <alpha-value>)',
          400: 'rgb(var(--vsa-brand-400, 59 189 181) / <alpha-value>)',
          500: 'rgb(var(--vsa-brand-500, 32 125 114) / <alpha-value>)',
          600: 'rgb(var(--vsa-brand-600, 23 110 99) / <alpha-value>)',
          700: 'rgb(var(--vsa-brand-700, 20 90 82) / <alpha-value>)',
          800: 'rgb(var(--vsa-brand-800, 16 75 69) / <alpha-value>)',
          900: 'rgb(var(--vsa-brand-900, 13 60 56) / <alpha-value>)',
          950: 'rgb(var(--vsa-brand-950, 10 40 40) / <alpha-value>)',
        },
        // Coral accent — lantern red-orange from the logo.
        coral: {
          400: '#f07858',
          500: '#e8623a',
          600: '#d44e2a',
        },
        // Gold accent — warm cloud amber from the logo.
        gold: {
          400: '#e8a838',
          500: '#d4841a',
          600: '#b86c10',
        },
        // Semantic surface/text tokens — driven by CSS custom properties so
        // dark mode flips automatically without repeating dark: variants everywhere.
        surface:  'var(--color-surface)',
        surface2: 'var(--color-surface2)',
        'border-strong': 'var(--color-border-strong)',
        'text-primary':  'var(--color-text)',
        'text-secondary':'var(--color-text2)',
        'text-muted':    'var(--color-text3)',
        // Figma editorial palette (public shell). Fallbacks keep admin readable
        // if a class leaks outside .vsa-editorial-shell.
        ed: {
          ink:    'var(--ed-ink, #28354d)',
          paper:  'var(--ed-paper, #faf9f5)',
          line:   'var(--ed-line, rgba(40, 53, 77, 0.22))',
          muted:  'var(--ed-muted, #4f5a74)',
          accent: 'var(--ed-accent, #6c628d)',
          'on-ink': 'var(--ed-on-ink, #ffffff)',
        },
        // Fixed Figma swatches for surfaces that stay light in both themes
        // (homepage About band, hero CTA, gallery accent on the blue band).
        figma: {
          ink:    '#28354d',
          accent: '#6c628d',
          pink:   '#f0ccd9',
          // Photo mat inside a Polaroid while its image loads or after it fails.
          mist:   '#e7e9f6',
        },
      },

      // ─── Typography ───────────────────────────────────────────────────────
      fontFamily: {
        sans:  ['"DM Sans"', 'system-ui', 'sans-serif'],
        serif: ['var(--vsa-serif-font, "DM Serif Display")', 'Georgia', 'serif'],
        mono:  ['"JetBrains Mono"', 'ui-monospace', 'Menlo', 'Consolas', 'monospace'],
        // Figma editorial display face (loaded in public/index.html).
        display: ['"Instrument Serif"', 'Georgia', 'serif'],
      },

      // ─── Type scale ───────────────────────────────────────────────────────
      fontSize: {
        '2xs': ['0.625rem',  { lineHeight: '0.875rem' }],  // 10px
        'xs':  ['0.75rem',   { lineHeight: '1rem' }],       // 12px
        'sm':  ['0.8125rem', { lineHeight: '1.25rem' }],    // 13px
        'base':['0.875rem',  { lineHeight: '1.5rem' }],     // 14px
        'md':  ['0.9375rem', { lineHeight: '1.5rem' }],     // 15px
        'lg':  ['1rem',      { lineHeight: '1.625rem' }],   // 16px
        'xl':  ['1.125rem',  { lineHeight: '1.75rem' }],    // 18px
        '2xl': ['1.25rem',   { lineHeight: '1.75rem' }],    // 20px
        '3xl': ['1.5rem',    { lineHeight: '2rem' }],       // 24px
        '4xl': ['1.875rem',  { lineHeight: '2.25rem' }],    // 30px
        '5xl': ['2.25rem',   { lineHeight: '2.5rem' }],     // 36px
        '6xl': ['3rem',      { lineHeight: '1' }],          // 48px
      },

      // ─── Letter spacing ───────────────────────────────────────────────────
      letterSpacing: {
        tighter: '-0.04em',
        tight:   '-0.025em',
        normal:  '0',
        wide:    '0.025em',
        label:   '0.07em',   // uppercase section labels
      },

      // ─── Spacing (8px grid) ───────────────────────────────────────────────
      spacing: {
        '18':  '4.5rem',   //  72px
        '88':  '22rem',    // 352px
        '128': '32rem',    // 512px
      },

      // ─── Border radius — sharp, engineered look ───────────────────────────
      borderRadius: {
        'none': '0',
        'sm':   '0.125rem',  //  2px — badges
        DEFAULT:'0.25rem',   //  4px — standard
        'md':   '0.375rem',  //  6px — relaxed
        'lg':   '0.5rem',    //  8px — modals
        'xl':   '0.75rem',   // 12px — large surfaces (sparingly)
        'full': '9999px',
      },

      // ─── Shadows — structure via borders, not blur ────────────────────────
      boxShadow: {
        'card': '0 1px 3px 0 rgb(0 0 0 / 0.08), 0 4px 16px 0 rgb(0 0 0 / 0.06)',
        'none': 'none',
      },

      // ─── Animations ───────────────────────────────────────────────────────
      keyframes: {
        'fade-in': {
          '0%':   { opacity: '0' },
          '100%': { opacity: '1' },
        },
      },
      animation: {
        'fade-in': 'fade-in 0.15s ease-in',
      },

      transitionDuration: {
        '150': '150ms',
        '250': '250ms',
      },
    },
  },
  plugins: [
    // `touch:` applies on phone-width viewports (< 768px) and on any
    // coarse-pointer device (tablets, landscape phones). Used for the 44x44px
    // touch-target floor so desktop density is unchanged. The same condition
    // is mirrored in src/index.css (`@media (max-width: 767px), (pointer: coarse)`).
    plugin(({ addVariant }) => {
      addVariant('touch', ['@media (max-width: 767px)', '@media (pointer: coarse)']);
    }),
  ],
};
