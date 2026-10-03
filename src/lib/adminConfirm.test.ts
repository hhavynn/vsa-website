import { BULK_DELETE_TYPED_THRESHOLD, bulkConfirmPhrase, confirmErrorMessage, confirmPhraseMatches, normalizeConfirmPhrase } from './adminConfirm';

describe('confirm phrase', () => {
  it('ignores case, repeated spaces, and surrounding whitespace', () => {
    expect(normalizeConfirmPhrase('  Smith   FAM ')).toBe('smith fam');
    expect(confirmPhraseMatches('smith fam', 'Smith Fam')).toBe(true);
    expect(confirmPhraseMatches('  SMITH  FAM  ', 'Smith Fam')).toBe(true);
  });

  it('rejects partial, extra, or empty input', () => {
    expect(confirmPhraseMatches('smith', 'Smith Fam')).toBe(false);
    expect(confirmPhraseMatches('smith fam please', 'Smith Fam')).toBe(false);
    expect(confirmPhraseMatches('', 'Smith Fam')).toBe(false);
  });

  it('never matches against an empty expected phrase (no accidental free pass)', () => {
    expect(confirmPhraseMatches('', '')).toBe(false);
    expect(confirmPhraseMatches('anything', '   ')).toBe(false);
  });
});

describe('bulkConfirmPhrase', () => {
  it('bears the count so a wrong selection is noticed', () => {
    expect(bulkConfirmPhrase(12, 'event')).toBe('12 events');
    expect(bulkConfirmPhrase(1, 'event')).toBe('1 event');
    expect(bulkConfirmPhrase(3, 'family', 'families')).toBe('3 families');
    expect(BULK_DELETE_TYPED_THRESHOLD).toBeGreaterThan(1);
  });
});

describe('confirmErrorMessage', () => {
  it('uses an Error message, else a safe default', () => {
    expect(confirmErrorMessage(new Error('Row is referenced'))).toBe('Row is referenced');
    expect(confirmErrorMessage({ code: '23503' })).toMatch(/nothing was changed/i);
  });
});
