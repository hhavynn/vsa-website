/**
 * Splits pasted CSV or TSV into rows of trimmed cells. The text is
 * tab-delimited when its first non-blank line contains a tab.
 *
 * A quote opens a quoted cell only at the start of a cell. Quoted cells may
 * hold the delimiter, doubled quotes, and line breaks, which is how Google
 * Sheets copies long-answer form responses. Lines with no content at all are
 * dropped; a line of empty cells ("  ,") is kept so callers can count it.
 */
export function parseDelimitedPaste(text: string): string[][] {
  const normalized = text.replace(/\r\n?/g, '\n');
  const firstLine = normalized.split('\n').find((line) => line.trim().length > 0) ?? '';
  const delimiter = firstLine.includes('\t') ? '\t' : ',';

  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;

  const endCell = () => {
    row.push(cell.trim());
    cell = '';
  };
  const endRow = () => {
    endCell();
    if (row.length > 1 || row[0] !== '') rows.push(row);
    row = [];
  };

  for (let i = 0; i < normalized.length; i += 1) {
    const char = normalized[i];
    if (quoted) {
      if (char === '"' && normalized[i + 1] === '"') {
        cell += '"';
        i += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        cell += char;
      }
    } else if (char === '"' && cell.trim() === '') {
      cell = '';
      quoted = true;
    } else if (char === delimiter) {
      endCell();
    } else if (char === '\n') {
      endRow();
    } else {
      cell += char;
    }
  }
  if (cell.length > 0 || row.length > 0) endRow();
  return rows;
}
