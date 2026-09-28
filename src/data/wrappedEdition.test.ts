import { CURRENT_WRAPPED_YEAR_LABEL, wrappedNavLabel } from './wrappedEdition';
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
});
