import { AceFamily, AceFamilyMember } from '../types';
import { FamAccent, FamPattern } from '../components/features/ace/FamCover';
import { TreeNode } from '../components/features/ace/FamilyTree';

const PATTERNS: FamPattern[] = ['sunburst', 'wave', 'dots', 'arches', 'lantern', 'leaves'];
const ACCENTS: FamAccent[] = ['teal', 'coral', 'gold'];

// Vietnamese number words 1..12 for fams without an explicit viet name.
const VIET_NUMBERS = [
  'Một', 'Hai', 'Ba', 'Bốn', 'Năm', 'Sáu',
  'Bảy', 'Tám', 'Chín', 'Mười', 'Mười Một', 'Mười Hai',
];

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const m = hex.trim().match(/^#?([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (!m) return null;
  let s = m[1];
  if (s.length === 3) s = s.split('').map((c) => c + c).join('');
  return {
    r: parseInt(s.slice(0, 2), 16),
    g: parseInt(s.slice(2, 4), 16),
    b: parseInt(s.slice(4, 6), 16),
  };
}

/** Map an admin-chosen theme_color hex to one of the three design accents. */
export function accentFromThemeColor(hex: string | null | undefined, fallbackSeed: string): FamAccent {
  const rgb = hex ? hexToRgb(hex) : null;
  if (!rgb) {
    return ACCENTS[hashString(fallbackSeed) % ACCENTS.length];
  }
  const { r, g, b } = rgb;
  // Compare distance to each accent's canonical color.
  const ANCHORS: Record<FamAccent, [number, number, number]> = {
    teal:  [30, 136, 120],
    coral: [232, 98, 58],
    gold:  [212, 132, 26],
  };
  let best: FamAccent = 'teal';
  let bestD = Infinity;
  (Object.keys(ANCHORS) as FamAccent[]).forEach((a) => {
    const [ar, ag, ab] = ANCHORS[a];
    const d = (r - ar) ** 2 + (g - ag) ** 2 + (b - ab) ** 2;
    if (d < bestD) {
      bestD = d;
      best = a;
    }
  });
  return best;
}

export function patternForFamily(family: AceFamily): FamPattern {
  return PATTERNS[hashString(family.id) % PATTERNS.length];
}

export function isDeadFam(name: string): boolean {
  return name.trim().toLowerCase().startsWith('(dead)');
}

export function getDisplayFamName(name: string): string {
  return name.replace(/^\s*\(dead\)\s*/i, '').trim() || name;
}

export function vietForFamily(family: AceFamily, indexInList: number): string | null {
  // No dedicated column yet — derive a fallback. Prefer a number word based on
  // display_order so admins implicitly control which name a fam gets.
  const seed = Number.isFinite(family.display_order) ? family.display_order : indexInList;
  const idx = ((seed % VIET_NUMBERS.length) + VIET_NUMBERS.length) % VIET_NUMBERS.length;
  return VIET_NUMBERS[idx];
}

export function generationDepth(members: Pick<AceFamilyMember, 'id' | 'parent_member_id'>[]): number {
  if (members.length === 0) return 0;
  const memo: Record<string, number> = {};
  const byId = new Map(members.map((m) => [m.id, m]));
  function depthOf(id: string, seen: Set<string>): number {
    if (memo[id] !== undefined) return memo[id];
    if (seen.has(id)) return 0;
    seen.add(id);
    const m = byId.get(id);
    if (!m || !m.parent_member_id || !byId.has(m.parent_member_id)) {
      return (memo[id] = 1);
    }
    return (memo[id] = 1 + depthOf(m.parent_member_id, seen));
  }
  let max = 0;
  members.forEach((m) => {
    const d = depthOf(m.id, new Set());
    if (d > max) max = d;
  });
  return max;
}

function firstInitial(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return '?';
  return trimmed.charAt(0).toUpperCase();
}

function classifyRole(rawRole: string | null): string {
  if (!rawRole) return 'Member';
  const lower = rawRole.toLowerCase();
  if (lower.includes('og') || lower.includes('founder') || lower.includes('grand')) {
    // Mark as OG so the tree node gets the founder dot. Preserve the original
    // label otherwise.
    if (lower.startsWith('og')) return rawRole;
    return `OG · ${rawRole}`;
  }
  if (lower.includes('little')) return 'Little';
  if (lower.includes('big')) return 'Big';
  return rawRole;
}

/** Convert published members into tree-node shape expected by FamilyTree. */
export function membersToTreeNodes(members: AceFamilyMember[]): TreeNode[] {
  return members.map((m) => ({
    id: m.id,
    initial: firstInitial(m.name),
    label: m.name,
    role: classifyRole(m.role_label),
    cohort: null,
    parent: m.parent_member_id ?? null,
  }));
}
