import fs from 'fs';
import path from 'path';
import postcss from 'postcss';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const tailwind = require('tailwindcss');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const baseConfig = require('../tailwind.config.js');

const css = fs.readFileSync(path.join(__dirname, 'index.css'), 'utf8');

describe('44px touch-target floor wiring', () => {
  it('Tailwind exposes a touch: variant for phone widths and coarse pointers', async () => {
    const result = await postcss([
      tailwind({ ...baseConfig, content: [{ raw: '<div class="touch:min-h-11">' }] }),
    ]).process('@tailwind utilities;', { from: undefined });

    expect(result.css).toMatch(/@media \(max-width: 767px\)[\s\S]*min-height: 2\.75rem/);
    expect(result.css).toMatch(/@media \(pointer: coarse\)[\s\S]*min-height: 2\.75rem/);
  });

  it('shared CSS classes grow to 44px under the same condition', () => {
    const block = css.slice(css.indexOf('@media (max-width: 767px), (pointer: coarse)'));
    expect(block).toMatch(/\.vsa-filter-btn[\s\S]*?min-height: 44px/);
    expect(block).toMatch(/\.scrapbook-select[\s\S]*?min-height: 44px/);
    expect(block).toMatch(/\.vsa-btn-primary[\s\S]*?min-height: 44px/);
    expect(block).toMatch(/\.touch-hit::after[\s\S]*?min-width: 44px[\s\S]*?min-height: 44px/);
  });

  it('active filter chips carry a check mark, not just a fill', () => {
    expect(css).toMatch(/\.vsa-filter-btn\.active::before\s*\{[^}]*\\2713/);
    expect(css).toMatch(/\.chip-check\[aria-pressed='true'\]::before/);
  });

  it('entrance animations are dropped under prefers-reduced-motion', () => {
    expect(css).toMatch(
      /@media \(prefers-reduced-motion: reduce\)\s*\{\s*\.vsa-animate-slide-up,\s*\.vsa-animate-fade-in,\s*\.vsa-particle\s*\{\s*animation: none;/
    );
    expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\)\s*\{\s*html\s*\{\s*scroll-behavior: auto;/);
  });
});
