import { parseCsvRecords } from './csvParse';

/**
 * Pasted CSV or TSV as rows of trimmed cells, tab-delimited when the first
 * non-blank line contains a tab (a copy from Google Sheets). Quoting follows
 * csvParse, so a cell may hold the delimiter, doubled quotes and line breaks.
 * Lines with no content at all are dropped; a line of empty cells ("  ,") is
 * kept so callers can count it.
 */
export function parseDelimitedPaste(text: string): string[][] {
  const firstLine = text.split(/\r\n|\r|\n/).find((line) => line.trim().length > 0) ?? '';
  const delimiter = firstLine.includes('\t') ? '\t' : ',';
  return parseCsvRecords(text, delimiter)
    .records.filter((record) => record.length > 1 || record[0].trim() !== '')
    .map((record) => record.map((cell) => cell.trim()));
}
