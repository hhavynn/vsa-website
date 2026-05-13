export function normalizeEmail(value: string | null | undefined): string {
  return (value ?? '').trim().toLowerCase();
}

export function capitalizeName(value: string): string {
  return value
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

export function normalizeNameForMatch(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function displayNameFromHouseCell(value: string): string {
  let next = value.trim();
  if (!next) return '';

  next = next
    .replace(/\s+[-\u2013\u2014]\s+.*$/u, '')
    .replace(/\([^)]*(first|second|third|fourth)[^)]*\)/giu, '')
    .replace(/\(\s*\d{4}-\d{1,2}-\d{1,2}[^)]*\)/gu, '')
    .replace(/\(\s*(mon|tue|wed|thu|fri|sat|sun)[^)]*\)/giu, '')
    .replace(/\(\s*\d{1,2}\/\d{1,2}\/\d{2,4}[^)]*\)/gu, '')
    .replace(/\s+/g, ' ')
    .trim();

  next = next.replace(/,/g, ' ').replace(/\s+/g, ' ').trim();
  return capitalizeName(next);
}

export function cleanNameForImport(value: string): string {
  return capitalizeName(
    value
      .trim()
      .replace(/,/g, ' ')
      .replace(/\b[A-Za-z]\.\s*/g, '')
      .replace(/(\b\w{2,})\s+\b[A-Za-z]\b\s+(\w{2,}\b)/g, '$1 $2')
      .replace(/\s+/g, ' ')
  );
}

export function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  );

  for (let i = 1; i <= m; i += 1) {
    for (let j = 1; j <= n; j += 1) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }

  return dp[m][n];
}

export function nameSimilarity(a: string, b: string): number {
  const na = normalizeNameForMatch(a);
  const nb = normalizeNameForMatch(b);
  if (!na || !nb) return 0;
  if (na === nb) return 100;
  return Math.max(0, Math.round((1 - levenshtein(na, nb) / Math.max(na.length, nb.length)) * 100));
}

export function parseCSV(raw: string): Record<string, string>[] {
  const lines = raw.trim().split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length < 2) return [];

  const headers = splitCSVRow(lines[0]).map((header) => header.trim());
  return lines.slice(1).map((line) => {
    const values = splitCSVRow(line);
    const row: Record<string, string> = {};
    headers.forEach((header, index) => {
      row[header] = (values[index] ?? '').trim();
    });
    return row;
  });
}

export function splitCSVRow(line: string): string[] {
  const output: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    const next = line[i + 1];

    if (char === '"' && inQuotes && next === '"') {
      current += '"';
      i += 1;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      output.push(current);
      current = '';
    } else {
      current += char;
    }
  }

  output.push(current);
  return output;
}

export function detectColumn(headers: string[], hints: string[]): string {
  const loweredHints = hints.map((hint) => hint.toLowerCase());
  return headers.find((header) => loweredHints.some((hint) => header.toLowerCase().includes(hint))) ?? '';
}
