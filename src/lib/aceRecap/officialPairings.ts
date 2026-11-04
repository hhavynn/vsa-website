import { normalizeMemberName } from '../memberLinkMatching';

/**
 * Parser for the ACE Chair's official Big/Little pairing sheet.
 *
 * Reads ONLY the "BIGS" and "LITTLES" columns of a sheet laid out as
 * `Big | … | Littles joined with " + "`, plus the optional `TOTAL BIGS: n`
 * / `TOTAL LITTLES: n` footer. Every other column (sent-email flags,
 * rejection lists, application answers) is ignored on purpose, so a rejected
 * person can never become a pairing candidate.
 *
 * Pure and dependency-free so the next ACE Chair can reuse it on a new
 * year's export without touching the database.
 */

export interface OfficialPairing {
  /** 1-based row in the sheet (header row included). */
  rowNumber: number;
  /** Cleaned Big display name. Co-Bigs stay joined with " + ". */
  bigName: string;
  /** The individual Bigs when one row lists more than one. */
  bigNames: string[];
  littleNames: string[];
}

export type PairingSheetIssueCode =
  | 'missing_header'
  | 'big_count_mismatch'
  | 'little_count_mismatch'
  | 'duplicate_little'
  | 'duplicate_big'
  | 'empty_littles'
  | 'co_big'
  | 'big_also_little';

export interface PairingSheetIssue {
  code: PairingSheetIssueCode;
  message: string;
  names: string[];
  rows: number[];
}

export interface ParsedPairingSheet {
  pairings: OfficialPairing[];
  bigCount: number;
  littleCount: number;
  declaredBigs: number | null;
  declaredLittles: number | null;
  issues: PairingSheetIssue[];
}

/**
 * "Rowan, Q, Vale" → "Rowan Q Vale"; trims and collapses spacing.
 * Never reorders tokens: the sheet's comma form keeps first-name-first order.
 */
export function cleanPersonName(raw: string | null | undefined): string {
  return (raw ?? '')
    .replace(/\s*,\s*/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Splits a Littles cell on "+", "&" or line breaks. Commas belong to names. */
export function splitPeople(raw: string | null | undefined): string[] {
  return (raw ?? '')
    .split(/\s*(?:\+|&|\n)\s*/)
    .map(cleanPersonName)
    .filter(Boolean);
}

const cell = (row: readonly unknown[], index: number): string =>
  index >= 0 && index < row.length && row[index] != null ? String(row[index]) : '';

function findHeader(rows: readonly (readonly unknown[])[]) {
  for (let r = 0; r < rows.length; r++) {
    const keys = rows[r].map((value) => String(value ?? '').trim().toLowerCase());
    const bigCol = keys.findIndex((k) => k === 'bigs' || k === 'big');
    const littleCol = keys.findIndex((k) => k === 'littles' || k === 'little');
    if (bigCol >= 0 && littleCol >= 0) return { headerRow: r, bigCol, littleCol };
  }
  return null;
}

export function parseOfficialPairingRows(rows: readonly (readonly unknown[])[]): ParsedPairingSheet {
  const issues: PairingSheetIssue[] = [];
  const header = findHeader(rows);
  if (!header) {
    return {
      pairings: [], bigCount: 0, littleCount: 0, declaredBigs: null, declaredLittles: null,
      issues: [{ code: 'missing_header', message: 'No row has both a "BIGS" and a "LITTLES" column.', names: [], rows: [] }],
    };
  }
  const pairings: OfficialPairing[] = [];
  let declaredBigs: number | null = null;
  let declaredLittles: number | null = null;

  for (let r = header.headerRow + 1; r < rows.length; r++) {
    const row = rows[r];
    const bigRaw = cell(row, header.bigCol);
    const joined = row.map((v) => String(v ?? '')).join(' ');
    const bigTotal = /TOTAL\s+BIGS?\s*:\s*(\d+)/i.exec(joined);
    const littleTotal = /TOTAL\s+LITT\w*\s*:\s*(\d+)/i.exec(joined);
    if (bigTotal || littleTotal) {
      if (bigTotal) declaredBigs = Number(bigTotal[1]);
      if (littleTotal) declaredLittles = Number(littleTotal[1]);
      break;
    }
    const bigNames = splitPeople(bigRaw);
    const littleNames = splitPeople(cell(row, header.littleCol));
    if (bigNames.length === 0 && littleNames.length === 0) continue;
    const pairing: OfficialPairing = {
      rowNumber: r + 1, bigName: bigNames.join(' + '), bigNames, littleNames,
    };
    pairings.push(pairing);
    if (littleNames.length === 0) issues.push({
      code: 'empty_littles', message: `${pairing.bigName || 'A row'} has no Littles listed.`,
      names: [pairing.bigName], rows: [pairing.rowNumber],
    });
    if (bigNames.length > 1) issues.push({
      code: 'co_big', message: `Row ${pairing.rowNumber} lists ${bigNames.length} Bigs together; a Little has exactly one Big node.`,
      names: bigNames, rows: [pairing.rowNumber],
    });
  }

  const littleCount = pairings.reduce((sum, p) => sum + p.littleNames.length, 0);
  if (declaredBigs !== null && declaredBigs !== pairings.length) issues.push({
    code: 'big_count_mismatch', message: `Sheet declares ${declaredBigs} Bigs but ${pairings.length} rows were parsed.`, names: [], rows: [],
  });
  if (declaredLittles !== null && declaredLittles !== littleCount) issues.push({
    code: 'little_count_mismatch', message: `Sheet declares ${declaredLittles} Littles but ${littleCount} were parsed.`, names: [], rows: [],
  });

  const group = (pick: (p: OfficialPairing) => string[]) => {
    const seen = new Map<string, { name: string; rows: number[] }>();
    for (const p of pairings) for (const name of pick(p)) {
      const key = normalizeMemberName(name);
      const entry = seen.get(key) ?? { name, rows: [] };
      entry.rows.push(p.rowNumber);
      seen.set(key, entry);
    }
    return seen;
  };
  const littles = group((p) => p.littleNames);
  const bigs = group((p) => p.bigNames);
  littles.forEach((entry) => {
    if (entry.rows.length > 1) issues.push({
      code: 'duplicate_little', message: `${entry.name} is listed as a Little more than once.`, names: [entry.name], rows: entry.rows,
    });
  });
  bigs.forEach((entry, key) => {
    if (entry.rows.length > 1) issues.push({
      code: 'duplicate_big', message: `${entry.name} has more than one Big row.`, names: [entry.name], rows: entry.rows,
    });
    const asLittle = littles.get(key);
    if (asLittle) issues.push({
      code: 'big_also_little',
      message: `${entry.name} is both a Big and an incoming Little this cycle — confirm they are two different people.`,
      names: [entry.name], rows: [...entry.rows, ...asLittle.rows],
    });
  });

  return { pairings, bigCount: pairings.length, littleCount, declaredBigs, declaredLittles, issues };
}

export interface PairingSheetDiff {
  littlesAdded: Array<{ little: string; big: string }>;
  littlesRemoved: Array<{ little: string; big: string }>;
  littlesMoved: Array<{ little: string; fromBig: string; toBig: string }>;
  /** A Big row whose Littles are unchanged but whose Big name changed. */
  bigsRenamed: Array<{ from: string; to: string; littles: string[] }>;
  bigsAdded: string[];
  bigsRemoved: string[];
}

/** What changed from `base` (an older export) to `next` (the newer source). */
export function diffPairingSheets(base: ParsedPairingSheet, next: ParsedPairingSheet): PairingSheetDiff {
  const index = (sheet: ParsedPairingSheet) => {
    const map = new Map<string, { little: string; big: string }>();
    for (const p of sheet.pairings) for (const little of p.littleNames) {
      map.set(normalizeMemberName(little), { little, big: p.bigName });
    }
    return map;
  };
  const a = index(base);
  const b = index(next);
  const diff: PairingSheetDiff = {
    littlesAdded: [], littlesRemoved: [], littlesMoved: [], bigsRenamed: [], bigsAdded: [], bigsRemoved: [],
  };
  b.forEach((entry, key) => {
    const prior = a.get(key);
    if (!prior) diff.littlesAdded.push(entry);
    else if (normalizeMemberName(prior.big) !== normalizeMemberName(entry.big)) {
      diff.littlesMoved.push({ little: entry.little, fromBig: prior.big, toBig: entry.big });
    }
  });
  a.forEach((entry, key) => { if (!b.has(key)) diff.littlesRemoved.push(entry); });

  const bigKeys = (sheet: ParsedPairingSheet) => new Map(sheet.pairings.map((p) => [normalizeMemberName(p.bigName), p]));
  const aBigs = bigKeys(base);
  const bBigs = bigKeys(next);
  const littlesKey = (p: OfficialPairing) => p.littleNames.map(normalizeMemberName).sort().join('|');
  const removed = [...aBigs].filter(([key]) => !bBigs.has(key)).map(([, p]) => p);
  const added = [...bBigs].filter(([key]) => !aBigs.has(key)).map(([, p]) => p);
  const renamedFrom = new Set<OfficialPairing>();
  const renamedTo = new Set<OfficialPairing>();
  for (const from of removed) {
    const to = added.find((p) => !renamedTo.has(p) && littlesKey(p) === littlesKey(from));
    if (to) {
      renamedFrom.add(from);
      renamedTo.add(to);
      diff.bigsRenamed.push({ from: from.bigName, to: to.bigName, littles: to.littleNames });
      // A rename is not a move: drop the per-Little "moved" rows it explains.
      diff.littlesMoved = diff.littlesMoved.filter((m) =>
        !(normalizeMemberName(m.fromBig) === normalizeMemberName(from.bigName)
          && normalizeMemberName(m.toBig) === normalizeMemberName(to.bigName)));
    }
  }
  diff.bigsRemoved = removed.filter((p) => !renamedFrom.has(p)).map((p) => p.bigName);
  diff.bigsAdded = added.filter((p) => !renamedTo.has(p)).map((p) => p.bigName);
  return diff;
}
