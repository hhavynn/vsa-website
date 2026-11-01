import { aceFormFileContentProblem, readAceFormFile } from './aceFormFile';

describe('ACE form file content checks', () => {
  it('accepts clean CSV and TSV, including a quoted cell with a comma', () => {
    expect(aceFormFileContentProblem('Name,Role\n"Vale, Tamsin",Little\n')).toBeNull();
    expect(aceFormFileContentProblem('Name\tRole\nTamsin Vale\tLittle\n')).toBeNull();
  });

  it('refuses an unclosed quote that would swallow later rows', () => {
    expect(aceFormFileContentProblem('Name\tHeight\n"Tamsin\t5\nOrrin\t6\n')).toMatch(/line 2 never closes/);
  });

  it('refuses a file that did not decode as UTF-8', () => {
    expect(aceFormFileContentProblem('Name\nTr\uFFFDn\n')).toMatch(/not UTF-8/);
  });

  it('rejects the read instead of returning part of the file', async () => {
    const file = new File(['Name,Note\n"Tamsin,open\nOrrin,ok\n'], 'form.csv', { type: 'text/csv' });
    await expect(readAceFormFile(file)).rejects.toThrow(/never closes/);
  });

  it('strips the BOM from a readable file', async () => {
    const file = new File(['\uFEFFName\nTamsin\n'], 'form.csv', { type: 'text/csv' });
    await expect(readAceFormFile(file)).resolves.toBe('Name\nTamsin\n');
  });
});
