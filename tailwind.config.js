/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      // ─── Brand tokens ─────────────────────────────────────────────────────
      colors: {
        // VSA Turquoise — primary accent, drawn from the butterfly logo.
        // 600 = light-mode primary (#1ba8a0), 400 = dark-mode primary (#45d4c8).
        brand: {
          50:  '#e8faf8',
          100: '#c8f2ee',
          200: '#96e3dc',
          300: '#5dd4c9',
          400: '#45d4c8',  // dark mode primary
          500: '#25b8ad',
          600: '#1ba8a0',  // light mode primary CTA
          700: '#158f86',  // hover
          800: '#12756e',
          900: '#0f5c58',
          950: '#083533',
        },
        // Rose accent — soft pink from the butterfly logo.
        rose: {
          400: '#f08da8',
          500: '#e06b8f',
          600: '#c95578',
        },
        // Lavender accent — pastel purple from the butterfly logo.
        lavender: {
          400: '#b9a0de',
          500: '#9b7fc7',
          600: '#7d62ab',
        },
        // Semantic surface/text tokens — driven by CSS custom properties so
        // dark mode flips automatically without repeating dark: variants everywhere.
        surface:  'var(--color-surface)',
        surface2: 'var(--color-surface2)',
        'border-strong': 'var(--color-border-strong)',
        'text-primary':  'var(--color-text)',
        'text-secondary':'var(--color-text2)',
        'text-muted':    'var(--color-text3)',
      },

      // ─── Typography ───────────────────────────────────────────────────────
      fontFamily: {
        sans:  ['"DM Sans"', 'system-ui', 'sans-serif'],
        serif: ['"DM Serif Display"', 'Georgia', 'serif'],
        mono:  ['"JetBrains Mono"', 'ui-monospace', 'Menlo', 'Consolas', 'monospace'],
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
  plugins: [],
};
