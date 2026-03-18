/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      // ─── Brand tokens ─────────────────────────────────────────────────────
      colors: {
        // VSA Red — primary brand accent. Used for CTAs, active nav states,
        // focus rings, and selected elements. Applied sparingly against
        // the zinc neutral base. Avoid using below 600.
        brand: {
          50:  '#fff1f1',
          100: '#ffe1e1',
          200: '#ffc7c7',
          300: '#ffa0a0',
          400: '#ff6b6b',
          500: '#f93c3c',
          600: '#e01c1c',  // primary CTA
          700: '#be1212',  // hover state
          800: '#9d1010',
          900: '#821212',
          950: '#470505',
        },
        // Gold — secondary accent for points, badges, admin highlights.
        accent: {
          300: '#fcd34d',
          400: '#fbbf24',
          500: '#f59e0b',
          600: '#d97706',
        },
      },

      // ─── Typography ───────────────────────────────────────────────────────
      fontFamily: {
        // Inter variable with optical-size axis — loads from Google Fonts.
        // Font features: cv11 = alternative one, ss01 = alt digits.
        sans:    ['Inter', 'system-ui', 'sans-serif'],
        heading: ['Inter', 'system-ui', 'sans-serif'],
        mono:    ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', 'monospace'],
      },

      // ─── Type scale ───────────────────────────────────────────────────────
      fontSize: {
        // Compact data density scale — matches editorial grid
        '2xs': ['0.625rem', { lineHeight: '0.875rem' }],  // 10px
        'xs':  ['0.75rem',  { lineHeight: '1rem' }],       // 12px
        'sm':  ['0.8125rem',{ lineHeight: '1.25rem' }],    // 13px
        'base':['0.875rem', { lineHeight: '1.5rem' }],     // 14px
        'md':  ['0.9375rem',{ lineHeight: '1.5rem' }],     // 15px
        'lg':  ['1rem',     { lineHeight: '1.625rem' }],   // 16px
        'xl':  ['1.125rem', { lineHeight: '1.75rem' }],    // 18px
        '2xl': ['1.25rem',  { lineHeight: '1.75rem' }],    // 20px
        '3xl': ['1.5rem',   { lineHeight: '2rem' }],       // 24px
        '4xl': ['1.875rem', { lineHeight: '2.25rem' }],    // 30px
        '5xl': ['2.25rem',  { lineHeight: '2.5rem' }],     // 36px
        '6xl': ['3rem',     { lineHeight: '1' }],          // 48px
      },

      // ─── Letter spacing ───────────────────────────────────────────────────
      letterSpacing: {
        tighter: '-0.04em',
        tight:   '-0.025em',
        normal:  '0',
        wide:    '0.025em',
        label:   '0.06em',   // uppercase labels / column headers
      },

      // ─── Spacing (strict 8px grid) ────────────────────────────────────────
      spacing: {
        '18':  '4.5rem',   //  72px — nav height
        '88':  '22rem',    // 352px
        '128': '32rem',    // 512px
      },

      // ─── Border radius — sharp, engineered look ───────────────────────────
      borderRadius: {
        'none': '0',
        'sm':   '0.125rem',   //  2px — tight inputs, badges
        DEFAULT:'0.25rem',    //  4px — standard elements
        'md':   '0.375rem',   //  6px — cards, dropdowns
        'lg':   '0.5rem',     //  8px — modals
        'xl':   '0.75rem',    // 12px — large surfaces (used sparingly)
        'full': '9999px',     //       — pill badges, avatars
      },

      // ─── Shadows — border-only structure, no atmospheric blur ─────────────
      boxShadow: {
        // Use only for floating elements (modals, popovers) that sit above content.
        // All structural elements use 1px solid borders.
        'card': '0 1px 3px 0 rgb(0 0 0 / 0.06), 0 1px 2px -1px rgb(0 0 0 / 0.06)',
        'none': 'none',
      },

      // ─── Animations ───────────────────────────────────────────────────────
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%':      { transform: 'translateY(-6px)' },
        },
        'fade-in': {
          '0%':   { opacity: '0' },
          '100%': { opacity: '1' },
        },
      },
      animation: {
        float:    'float 3s ease-in-out infinite',
        'fade-in':'fade-in 0.15s ease-in',
      },

      transitionDuration: {
        '150': '150ms',
        '250': '250ms',
      },
    },
  },
  plugins: [],
};
