/**
 * Picks a text color that stays readable on a dynamic background — used for
 * House / category chips whose fill comes from data (e.g. a gold or slate
 * House accent where white text measures ~2:1). The fill itself is unchanged.
 */
const DARK_INK = '#061014';
const LIGHT_INK = '#ffffff';

function parseHex(color: string): [number, number, number] | null {
  const match = /^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.exec(color.trim());
  if (!match) return null;
  let hex = match[1];
  if (hex.length === 3) hex = hex.split('').map((c) => c + c).join('');
  const value = parseInt(hex.slice(0, 6), 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

function channel(value: number): number {
  const s = value / 255;
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

function luminance([r, g, b]: [number, number, number]): number {
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

export function contrastRatio(a: string, b: string): number | null {
  const ca = parseHex(a);
  const cb = parseHex(b);
  if (!ca || !cb) return null;
  const [hi, lo] = [luminance(ca), luminance(cb)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/**
 * Returns whichever of near-black / white has the higher contrast against
 * `background`. Non-hex backgrounds (CSS variables, e.g. `var(--brand)`) fall
 * back to the theme's on-brand foreground, which is paired with that fill.
 */
export function readableInk(background: string | null | undefined): string {
  const parsed = background ? parseHex(background) : null;
  if (!parsed) return 'var(--color-on-brand)';
  const bg = luminance(parsed);
  const withLight = (1 + 0.05) / (bg + 0.05);
  const withDark = (bg + 0.05) / (luminance(parseHex(DARK_INK)!) + 0.05);
  return withDark >= withLight ? DARK_INK : LIGHT_INK;
}
