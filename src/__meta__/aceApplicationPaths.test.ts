import { readFileSync } from 'fs';
import { resolve } from 'path';

const acePage = readFileSync(resolve(__dirname, '../pages/Ace.tsx'), 'utf8');

describe('public ACE application-path guidance (#667)', () => {
  it('explains mutual and general forms without advertising an unapproved mutual link', () => {
    expect(acePage).toContain('General ACE Application');
    expect(acePage).toContain('Mutual requests use a separate form');
    expect(acePage).toContain('You do not need to submit the general application just to submit a mutual request.');
    expect(acePage).toContain('A Little can submit both, but may have only one confirmed Big in the cycle');
    expect(acePage).toContain('Submitting a mutual request is not an automatic confirmation');
    expect(acePage).not.toMatch(/applicationKeys=["']ace_mutual/);
  });

  it('keeps individual matching private and avoids implying eligibility exemptions', () => {
    expect(acePage).toContain('Individual matching decisions stay private');
    expect(acePage).toContain('eligibility or attendance requirements are still set by ACE leadership');
    expect(acePage).toContain('aria-controls={`ace-faq-answer-${i}`}');
    expect(acePage).toContain('hidden={openFaq !== i}');
  });
});
