import { parseDelimitedPaste } from './delimitedPaste';

describe('parseDelimitedPaste', () => {
  it('splits TSV when the first line has a tab', () => {
    expect(parseDelimitedPaste('a\tb, c\n1\t2')).toEqual([['a', 'b, c'], ['1', '2']]);
  });

  it('keeps line breaks, delimiters, and doubled quotes inside quoted cells', () => {
    expect(parseDelimitedPaste('name,answer\r\nAmy,"one, two\r\n""three"""\nBo,x')).toEqual([
      ['name', 'answer'],
      ['Amy', 'one, two\n"three"'],
      ['Bo', 'x'],
    ]);
  });

  it('treats a quote in the middle of a cell as text', () => {
    expect(parseDelimitedPaste('name\tnick\nKevin "KL" Le\tk')).toEqual([['name', 'nick'], ['Kevin "KL" Le', 'k']]);
  });

  it('drops blank lines but keeps rows of empty cells', () => {
    expect(parseDelimitedPaste('a,b\n\n   \n , \n1,2\n')).toEqual([['a', 'b'], ['', ''], ['1', '2']]);
  });

  it('returns nothing for empty input', () => {
    expect(parseDelimitedPaste('  \n')).toEqual([]);
  });
});
