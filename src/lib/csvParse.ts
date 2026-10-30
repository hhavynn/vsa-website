// RFC 4180 CSV parsing for admin imports (Google Forms / Sheets exports and
// local files). One pass over the text, so a quoted cell may contain commas,
// escaped quotes ("") and line breaks. No dependency: the format is small and
// every rule below is covered by csvParse.test.ts.

export interface ParsedCsvTable {
  /** Unique, trimmed header names in column order. */
  headers: string[];
  /** One record per non-blank data line, keyed by header. */
  rows: Record<string, string>[];
  /** 1-based spreadsheet row of each entry in `rows` (the header is row 1; blank rows still count). */
  rowNumbers: number[];
  /** Original header names that appeared more than once (renamed "Name (2)", …). */
  duplicateHeaders: string[];
  /** The text ended inside a quoted cell; the last cell runs to end of input. */
  unterminatedQuote: boolean;
  /** 1-based file line where that unclosed quote opened, or null. */
  unterminatedQuoteLine: number | null;
}

/** Splits CSV (or, with `delimiter: '\t'`, TSV) text into records of raw cells. Handles CRLF, LF and lone CR. */
export function parseCsvRecords(raw: string, delimiter = ','): { records: string[][]; unterminatedQuote: boolean; unterminatedQuoteLine: number | null } {
  const text = raw.charCodeAt(0) === 0xfeff ? raw.slice(1) : raw;
  const records: string[][] = [];
  let record: string[] = [];
  let cell = '';
  let inQuotes = false;
  let i = 0;
  let line = 1;
  let quoteLine = 1;

  const endCell = () => {
    record.push(cell);
    cell = '';
  };
  const endRecord = () => {
    endCell();
    records.push(record);
    record = [];
  };

  while (i < text.length) {
    const char = text[i];
    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i += 1;
        continue;
      }
      if (char === '\n' || (char === '\r' && text[i + 1] !== '\n')) line += 1;
      cell += char;
      i += 1;
      continue;
    }
    if (char === '"') {
      // A quote opens a quoted section anywhere in the cell; sheets only emit
      // it at the start, and being lenient never drops characters.
      inQuotes = true;
      quoteLine = line;
      i += 1;
    } else if (char === delimiter) {
      endCell();
      i += 1;
    } else if (char === '\r' || char === '\n') {
      endRecord();
      line += 1;
      i += char === '\r' && text[i + 1] === '\n' ? 2 : 1;
    } else {
      cell += char;
      i += 1;
    }
  }
  if (cell !== '' || record.length > 0 || inQuotes) endRecord();

  return { records, unterminatedQuote: inQuotes, unterminatedQuoteLine: inQuotes ? quoteLine : null };
}

function isBlankRecord(record: readonly string[]): boolean {
  return record.every((cell) => cell.trim() === '');
}

/**
 * Header row plus keyed data rows. Blank lines (including trailing ones) are
 * dropped. Duplicate headers keep every column: the second "Email" becomes
 * "Email (2)" so it can still be mapped. Empty headers become "Column N".
 */
export function parseCsvTable(raw: string): ParsedCsvTable {
  const { records, unterminatedQuote, unterminatedQuoteLine } = parseCsvRecords(raw);
  const nonBlank = records
    .map((record, index) => ({ record, rowNumber: index + 1 }))
    .filter(({ record }) => !isBlankRecord(record));
  if (nonBlank.length === 0) return { headers: [], rows: [], rowNumbers: [], duplicateHeaders: [], unterminatedQuote, unterminatedQuoteLine };

  const headerRecord = nonBlank[0].record;
  const dataRecords = nonBlank.slice(1);
  const seen = new Map<string, number>();
  const used = new Set<string>();
  const duplicateHeaders: string[] = [];
  const headers = headerRecord.map((value, index) => {
    const base = value.trim() || `Column ${index + 1}`;
    let count = (seen.get(base) ?? 0) + 1;
    if (count === 2) duplicateHeaders.push(base);
    let name = count === 1 ? base : `${base} (${count})`;
    while (used.has(name)) {
      count += 1;
      name = `${base} (${count})`;
    }
    seen.set(base, count);
    used.add(name);
    return name;
  });

  const rows = dataRecords.map(({ record }) => {
    const row: Record<string, string> = {};
    headers.forEach((header, index) => {
      row[header] = (record[index] ?? '').trim();
    });
    return row;
  });

  return { headers, rows, rowNumbers: dataRecords.map(({ rowNumber }) => rowNumber), duplicateHeaders, unterminatedQuote, unterminatedQuoteLine };
}
