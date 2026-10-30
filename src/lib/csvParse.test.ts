import { parseCsvRecords, parseCsvTable } from './csvParse';
import { parseDelimitedPaste } from './delimitedPaste';

describe('parseCsvRecords', () => {
  it('keeps commas inside quoted cells', () => {
    expect(parseCsvRecords('a,b\n"Nguyen, An",Muir').records).toEqual([['a', 'b'], ['Nguyen, An', 'Muir']]);
  });

  it('unescapes doubled quotes inside quoted cells', () => {
    expect(parseCsvRecords('note\n"She said ""hi"""').records).toEqual([['note'], ['She said "hi"']]);
  });

  it('keeps line breaks inside quoted cells as part of the cell', () => {
    const { records } = parseCsvRecords('name,comment\r\nAn Tran,"line one\r\nline two"\r\nBao Le,ok');
    expect(records).toEqual([['name', 'comment'], ['An Tran', 'line one\r\nline two'], ['Bao Le', 'ok']]);
  });

  it('accepts LF, CRLF and lone CR line endings', () => {
    expect(parseCsvRecords('a\n1\r\n2\r3').records).toEqual([['a'], ['1'], ['2'], ['3']]);
  });

  it('strips a UTF-8 byte order mark from the first header', () => {
    expect(parseCsvRecords('﻿Name,Email\nAn,a@ucsd.edu').records[0]).toEqual(['Name', 'Email']);
  });

  it('reports a quote that never closes instead of dropping the rest of the file', () => {
    const result = parseCsvRecords('a,b\n"open,1');
    expect(result.unterminatedQuote).toBe(true);
    expect(result.records[1]).toEqual(['open,1']);
    expect(result.unterminatedQuoteLine).toBe(2);
    expect(parseCsvRecords('a\n"ok\nstill ok",x\nb,"never closed\nc,d').unterminatedQuoteLine).toBe(4);
    expect(parseCsvRecords('a\n"closed"').unterminatedQuoteLine).toBeNull();
  });

  it('keeps empty trailing cells', () => {
    expect(parseCsvRecords('a,b,c\n1,,').records[1]).toEqual(['1', '', '']);
  });
});

describe('parseCsvTable', () => {
  it('drops blank and trailing empty rows', () => {
    const table = parseCsvTable('Name,Email\nAn Tran,an@ucsd.edu\n\n,\n  ,  \n');
    expect(table.rows).toEqual([{ Name: 'An Tran', Email: 'an@ucsd.edu' }]);
  });

  it('keeps every column of a repeated header and names the repeats', () => {
    const table = parseCsvTable('Email,Name,Email\nfirst@gmail.com,An,second@ucsd.edu');
    expect(table.headers).toEqual(['Email', 'Name', 'Email (2)']);
    expect(table.duplicateHeaders).toEqual(['Email']);
    expect(table.rows[0]).toEqual({ Email: 'first@gmail.com', Name: 'An', 'Email (2)': 'second@ucsd.edu' });
  });

  it('does not collide with a header that already looks like a renamed repeat', () => {
    expect(parseCsvTable('Email,Email (2),Email\n1,2,3').headers).toEqual(['Email', 'Email (2)', 'Email (3)']);
  });

  it('names empty headers by position', () => {
    expect(parseCsvTable('Name,,Year\nAn,x,1').headers).toEqual(['Name', 'Column 2', 'Year']);
  });

  it('fills missing trailing cells with empty strings and trims values', () => {
    expect(parseCsvTable('Name,College,Year\n  An Tran  ,Muir').rows[0]).toEqual({ Name: 'An Tran', College: 'Muir', Year: '' });
  });

  it('reads a Google Forms export with a timestamp, quoted answers and a multiline comment', () => {
    const csv = [
      '﻿Timestamp,Email Address,"Name (First & Last)",What year are you?,College,Anything else?',
      '10/1/2026 18:02:11,an@ucsd.edu,"Nguyễn Văn An",2nd Year,Muir,"Loved it,\nsee you next week"',
      '10/1/2026 18:03:40,bao@gmail.com,Bao Le,1st,Sixth,',
      '',
    ].join('\r\n');
    const table = parseCsvTable(csv);
    expect(table.headers[0]).toBe('Timestamp');
    expect(table.rows).toHaveLength(2);
    expect(table.rows[0]['Name (First & Last)']).toBe('Nguyễn Văn An');
    expect(table.rows[0]['Anything else?']).toBe('Loved it,\nsee you next week');
  });

  it('returns no rows for a header-only or empty file', () => {
    expect(parseCsvTable('Name,Email\n').rows).toEqual([]);
    expect(parseCsvTable('').headers).toEqual([]);
  });

  it('parses a large file in one pass', () => {
    const lines = ['Name,Email'];
    for (let i = 0; i < 5000; i += 1) lines.push(`"Member, ${i}",m${i}@ucsd.edu`);
    const table = parseCsvTable(lines.join('\n'));
    expect(table.rows).toHaveLength(5000);
    expect(table.rows[4999]).toEqual({ Name: 'Member, 4999', Email: 'm4999@ucsd.edu' });
  });
});

describe('parseCsvTable row numbers', () => {
  it('reports the spreadsheet row of each record, counting blank rows and multi-line cells once', () => {
    const table = parseCsvTable('Name,Note\nAn,"two\nlines"\n\nBao,x\n');
    expect(table.rows.map((row) => row.Name)).toEqual(['An', 'Bao']);
    expect(table.rowNumbers).toEqual([2, 4]);
  });
});

describe('parseCsvRecords with a tab delimiter', () => {
  it('splits on tabs only and keeps quoted line breaks', () => {
    expect(parseCsvRecords('a\tb, c\n1\t"two\nlines"', '\t').records).toEqual([['a', 'b, c'], ['1', 'two\nlines']]);
  });
});

describe('parseDelimitedPaste', () => {
  it('detects TSV from the first non-blank line and trims cells', () => {
    expect(parseDelimitedPaste('\n name \t answer\nAmy\t" one, two\n""three"" "')).toEqual([
      ['name', 'answer'],
      ['Amy', 'one, two\n"three"'],
    ]);
  });

  it('defaults to CSV', () => {
    expect(parseDelimitedPaste('a,b\r\n1,"x\ty"')).toEqual([['a', 'b'], ['1', 'x\ty']]);
  });

  it('drops blank lines but keeps rows of empty cells', () => {
    expect(parseDelimitedPaste('a,b\n\n   \n , \n1,2\n')).toEqual([['a', 'b'], ['', ''], ['1', '2']]);
  });

  it('returns nothing for empty input', () => {
    expect(parseDelimitedPaste('  \n')).toEqual([]);
  });
});
