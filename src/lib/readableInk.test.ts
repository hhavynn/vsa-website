import { HOUSE_COLORS } from '../constants/houses';
import { contrastRatio, readableInk } from './readableInk';

describe('readableInk', () => {
  it('uses dark ink on light House fills and light ink on dark fills', () => {
    expect(readableInk('#eab308')).toBe('#061014'); // Donkey Kong gold
    expect(readableInk('#94a3b8')).toBe('#061014'); // Boo slate
    expect(readableInk('#1e3a8a')).toBe('#ffffff');
  });

  it('keeps every House fill at 4.5:1 or better for its chosen ink', () => {
    for (const fill of Object.values(HOUSE_COLORS)) {
      const ink = readableInk(fill);
      expect(contrastRatio(fill, ink)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('falls back to the theme on-brand color for non-hex fills', () => {
    expect(readableInk('var(--brand)')).toBe('var(--color-on-brand)');
    expect(readableInk(null)).toBe('var(--color-on-brand)');
  });

  it('expands 3-digit hex', () => {
    expect(readableInk('#fff')).toBe('#061014');
  });
});
