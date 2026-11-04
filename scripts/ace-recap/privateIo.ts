import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

/**
 * Private-output guard for the ACE recap tooling. Real pairings and the
 * rendered video must never land inside a git work tree (this repo is public).
 */
export function assertPrivateDir(dir: string): string {
  const abs = path.resolve(dir);
  mkdirSync(abs, { recursive: true });
  let inside = false;
  try {
    inside = execFileSync('git', ['-C', abs, 'rev-parse', '--is-inside-work-tree'], {
      stdio: ['ignore', 'pipe', 'ignore'],
    }).toString().trim() === 'true';
  } catch {
    inside = false;
  }
  if (inside) {
    throw new Error(`Refusing to write private ACE data inside a git work tree: ${abs}\n`
      + 'Pick a folder outside every repository (e.g. ~/Documents/vsa-ace-recap-private).');
  }
  return abs;
}

export function arg(name: string, fallback?: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  if (i >= 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--')) return process.argv[i + 1];
  return fallback;
}

export function requireArg(name: string): string {
  const value = arg(name);
  if (!value) throw new Error(`Missing --${name}`);
  return value;
}

/** Minimal RFC-4180 CSV reader (quotes, escaped quotes, CRLF). */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') { row.push(field); field = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(field); rows.push(row); row = []; field = '';
    } else field += ch;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  return rows;
}

export function csvEscape(value: unknown): string {
  const s = value == null ? '' : String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Rows from a .json ({rows}) export or a .csv export of the pairing sheet. */
export function readSheetRows(file: string): { rows: string[][]; meta: Record<string, unknown> } {
  if (!existsSync(file)) throw new Error(`Not found: ${file}`);
  const text = readFileSync(file, 'utf8');
  if (file.endsWith('.json')) {
    const json = JSON.parse(text);
    const { rows, ...meta } = json;
    return { rows, meta };
  }
  return { rows: parseCsv(text), meta: { sourceLabel: path.basename(file) } };
}

/**
 * Names under a "Rejections" block (to the right of the pairing columns).
 * Used only to EXCLUDE people; a rejected row never becomes a candidate.
 */
export function extractRejectedNames(rows: string[][]): string[] {
  for (let r = 0; r < rows.length; r++) {
    const c = rows[r].findIndex((v) => /^\s*rejections?\s*:?\s*$/i.test(v ?? ''));
    if (c < 0) continue;
    const names: string[] = [];
    for (let rr = r; rr < rows.length; rr++) {
      for (const cc of [c, c + 1]) {
        const v = (rows[rr][cc] ?? '').trim();
        if (!v || /rejection|^bigs?$|^littles?$|didn.?t meet|^(true|false)$/i.test(v)) continue;
        names.push(v.replace(/\s*,\s*/g, ' ').replace(/\s+/g, ' '));
      }
    }
    return Array.from(new Set(names));
  }
  return [];
}
