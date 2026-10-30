import type { MemberOption } from './memberLinkMatching';
import { normalizeMemberName } from './memberLinkMatching';

export type VcnRole = 'VCN Choreographer' | 'VCN Dancer' | 'VCN Stage Ninja' | 'VCN Props Member';
export type VcnReviewState = 'verified-input' | 'tentative' | 'invalid-role' | 'missing-name' | 'duplicate' | 'unknown-identity' | 'ambiguous-identity' | 'ready-for-human-review';
export interface VcnRosterRow {
  sourceLine: number;
  name: string;
  role: VcnRole | null;
  originalRole: string;
  verification: string;
  candidateIds: string[];
  state: VcnReviewState;
}
export interface VcnReview {
  rows: VcnRosterRow[];
  errors: string[];
}

/** CSV/TSV with RFC-4180 quoted cells, including quoted newlines and escaped quotes. */
function parseDelimited(input: string, delimiter: string): string[][] {
  const records: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < input.length; i++) {
    const char = input[i];
    if (char === '"') {
      if (quoted && input[i + 1] === '"') { cell += '"'; i++; }
      else if (cell === '' || quoted) quoted = !quoted;
      else throw new Error('Unexpected quote in roster field');
    } else if (quoted) cell += char;
    else if (char === delimiter) { row.push(cell); cell = ''; }
    else if (char === '\n' || char === '\r') {
      if (char === '\r' && input[i + 1] === '\n') i++;
      row.push(cell); records.push(row); row = []; cell = '';
    } else cell += char;
  }
  if (quoted) throw new Error('Unclosed quoted roster field');
  if (cell || row.length) { row.push(cell); records.push(row); }
  return records.filter(row => row.some(cell => cell.trim()));
}

export function normalizeVcnRole(value: string): VcnRole | null {
  const normalized = value.toLowerCase().trim().replace(/[ _-]+/g, ' ');
  const mapped: Record<string, VcnRole> = {
    choreographer: 'VCN Choreographer', 'vcn choreographer': 'VCN Choreographer',
    dancer: 'VCN Dancer', 'vcn dancer': 'VCN Dancer',
    'stage ninja': 'VCN Stage Ninja', 'vcn stage ninja': 'VCN Stage Ninja',
    'props member': 'VCN Props Member', 'vcn props member': 'VCN Props Member',
  };
  return mapped[normalized] ?? null;
}

/**
 * This parses UNTRUSTED, PRIVATE CSV locally in the admin browser only.
 * "Verified" from a CSV does not authorize publication; a separate permissioned
 * review/write contract and the shared #623 projection are still required.
 */
export function reviewVcnRoleCsv(
  source: string,
  members: readonly MemberOption[],
): VcnReview {
  if (source.length > 500_000) throw new Error('Roster exceeds 500 KB review limit');
  const delimiter = source.replace(/^\uFEFF/, '').split(/\r?\n/, 1)[0].includes('\t') ? '\t' : ',';
  const records = parseDelimited(source.replace(/^\uFEFF/, ''), delimiter);
  if (!records.length) throw new Error('CSV contains no header');
  if (records.length > 5001) throw new Error('Roster exceeds 5,000 data rows');
  const header = records[0].map(value=>value.toLowerCase().trim().replace(/[ _-]+/g, ' '));
  const col = (names: string[])=>header.findIndex(h=>names.includes(h));
  const nameCol = col(['name', 'full name', 'member name']);
  const roleCol = col(['role', 'vcn role', 'production role']);
  const verificationCol = col(['verification', 'status', 'participation status']);
  if (nameCol<0 || roleCol<0 || verificationCol<0) {
    throw new Error('CSV needs name, role and verification/status columns; no source is automatically final');
  }
  const grouped = new Map<string, MemberOption[]>();
  members.forEach(member=>{
    const key = normalizeMemberName(member.fullName);
    grouped.set(key, [...(grouped.get(key) ?? []), member]);
  });
  const rows: VcnRosterRow[] = [];
  const seen = new Set<string>();
  records.slice(1).forEach((cells,index)=>{
    const name = (cells[nameCol] ?? '').trim().slice(0,200);
    const originalRole = (cells[roleCol] ?? '').trim().slice(0,120);
    const verification = (cells[verificationCol] ?? '').trim().toLowerCase();
    const role = normalizeVcnRole(originalRole);
    const matches = name ? grouped.get(normalizeMemberName(name)) ?? [] : [];
    const duplicateKey = normalizeMemberName(name) + '|' + (role ?? originalRole.toLowerCase());
    let state: VcnReviewState;
    if (!name) state='missing-name';
    else if (!role) state='invalid-role';
    else if (seen.has(duplicateKey)) state='duplicate';
    else if (verification !== 'verified') state='tentative';
    else if (!matches.length) state='unknown-identity';
    else if (matches.length > 1) state='ambiguous-identity';
    else state='ready-for-human-review';
    seen.add(duplicateKey);
    rows.push({sourceLine:index+2,name,originalRole,verification,role,candidateIds:matches.map(m=>m.id),state});
  });
  return {rows,errors:[]};
}
