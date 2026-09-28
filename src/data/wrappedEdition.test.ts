import fs from 'fs';
import path from 'path';
import { CURRENT_WRAPPED_YEAR_LABEL, wrappedNavLabel } from './wrappedEdition';
import { WRAPPED_2026 } from './wrapped2026';
import { EXPLORE_LINKS } from '../components/layout/navigation/navConfig';

describe('wrappedNavLabel (#263)', () => {
  it('abbreviates an academic-year label', () => {
    expect(wrappedNavLabel('2025–2026')).toBe("Wrapped '25–'26");
    expect(wrappedNavLabel('2026-2027')).toBe("Wrapped '26–'27");
  });

  it('falls back to the raw label when it is not a year range', () => {
    expect(wrappedNavLabel('Spring')).toBe('Wrapped Spring');
  });

  it('drives the nav entry from the published edition, not a literal', () => {
    const wrapped = EXPLORE_LINKS.find((link) => link.path === '/#wrapped');
    expect(wrapped?.label).toBe(wrappedNavLabel(CURRENT_WRAPPED_YEAR_LABEL));
  });

  it('the rendered recap and its config use the same edition label as the nav', () => {
    expect(WRAPPED_2026.yearLabel).toBe(CURRENT_WRAPPED_YEAR_LABEL);
    const card = fs.readFileSync(
      path.resolve(__dirname, '../components/features/home/WrappedRecapCard.tsx'),
      'utf8',
    );
    // A hardcoded academic-year range in the card could drift from the nav label.
    expect(card.match(/\b20\d\d\s*[–-]\s*20\d\d\b/g) ?? []).toEqual([]);
    expect(card).toContain('CURRENT_WRAPPED_YEAR_LABEL');
  });
});
