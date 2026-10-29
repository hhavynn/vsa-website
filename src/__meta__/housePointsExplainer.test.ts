import { readFileSync } from 'fs';
import { resolve } from 'path';

const housePage = readFileSync(resolve(__dirname, '../pages/House.tsx'), 'utf8');

describe('public House points explainer (#637)', () => {
  it('distinguishes personal points, qualifying House attendance, and House socials', () => {
    expect(housePage).toContain('Are my personal VSA points the same as House points?');
    expect(housePage).toContain('Do House socials automatically award House points?');
    expect(housePage).toContain('Only attendance at qualifying VSA events counts toward House points.');
    expect(housePage).toContain('official effective membership dates');
    expect(housePage).toContain('Multiple check-ins for the same member at the same event do not award extra House credit');
  });

  it('makes the FAQ accessible without displaying private competition standings', () => {
    expect(housePage).toContain('aria-expanded={openFaq === i}');
    expect(housePage).toContain('aria-controls={`house-faq-answer-${i}`}');
    expect(housePage).toContain('hidden={openFaq !== i}');
    expect(housePage).toContain('officially announced at general body meetings (GBMs)');
    expect(housePage).not.toMatch(/getYearlyHouseLeaderboard|getRecentHouseActivity|getHouseMemberRankings/);
  });
});
