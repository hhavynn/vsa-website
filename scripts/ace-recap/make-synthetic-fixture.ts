/**
 * Writes tools/ace-recap-video/fixtures/synthetic-props.json: a fully
 * FICTIONAL ACE snapshot (made-up names, random ids) for Remotion Studio,
 * demos and tests. Never put real member names in this fixture.
 *
 *   npx tsx scripts/ace-recap/make-synthetic-fixture.ts
 */
import { writeFileSync } from 'node:fs';
import type { AceFamily } from '../../src/types';
import type { AceNodeRef } from '../../src/lib/aceAssignments';
import { buildRecapSnapshot, parseOfficialPairingRows, toRecapPresentation } from '../../src/lib/aceRecap';

const GIVEN = ['Ari', 'Bex', 'Cato', 'Dara', 'Eno', 'Fable', 'Gale', 'Hollis', 'Ivo', 'Juno', 'Kip', 'Lark', 'Mira', 'Nico', 'Oren', 'Pia', 'Quill', 'Remy', 'Sol', 'Tavi', 'Uma', 'Vesper', 'Wynn', 'Xan', 'Yara', 'Zeph'];
const FAMILY = ['Ashgrove', 'Brightwater', 'Cindervale', 'Dunmore', 'Emberly', 'Fernhollow', 'Glimmer', 'Hearth', 'Ironwood', 'Juniper', 'Kestrel', 'Lumen', 'Marrow', 'Nightjar', 'Oakhart', 'Pennywhistle'];
let seed = 7;
const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
const used = new Set<string>();
const name = () => {
  for (;;) {
    const n = `${GIVEN[Math.floor(rnd() * GIVEN.length)]} ${FAMILY[Math.floor(rnd() * FAMILY.length)]}`;
    if (!used.has(n)) { used.add(n); return n; }
  }
};
const fam = (id: string, n: string, color: string): AceFamily => ({
  id, name: n, slug: n.toLowerCase(), academic_year_start: null, academic_year_end: null, cover_image_url: null,
  theme_color: color, description: null, display_order: 0, is_published: true, created_at: '', updated_at: '',
});
const families = [
  fam('fx-lantern', 'Lantern', '#c9a378'), fam('fx-tide', 'Tide', '#3da9b8'), fam('fx-aurora', 'Aurora', '#a773bf'),
  fam('fx-ember', 'Ember', '#7a1f1f'), fam('fx-fern', 'Fern', '#6e7087'),
];
const SIZES = [72, 48, 34, 28, 20];
const BIGS_PER_FAMILY = [6, 4, 3, 3, 1];
const nodes: AceNodeRef[] = [];
const rows: string[][] = [['', 'BIGS', '', '', 'LITTLES']];
let id = 0;
let littles = 0;
for (const [fi, f] of families.entries()) {
  const famNodes: AceNodeRef[] = [];
  for (let i = 0; i < SIZES[fi]; i++) {
    const parent = i < 2 ? null : famNodes[Math.max(0, famNodes.length - 1 - Math.floor(rnd() * Math.min(famNodes.length, 7)))];
    famNodes.push({ id: `fx-${++id}`, name: name(), familyId: f.id, familyName: f.name, memberId: null, parentId: parent?.id ?? null, roleLabel: parent ? 'Little' : 'OG', isPublished: true });
  }
  nodes.push(...famNodes);
  // Bigs are the family's newest members: its deepest leaves.
  const depth = (n: AceNodeRef): number => (n.parentId ? 1 + depth(famNodes.find((x) => x.id === n.parentId)!) : 0);
  const leaves = famNodes.filter((n) => !famNodes.some((c) => c.parentId === n.id)).sort((a, b) => depth(b) - depth(a));
  for (const big of leaves.slice(0, BIGS_PER_FAMILY[fi])) {
    const k = fi === 4 ? 1 : 1 + Math.floor(rnd() * 3);
    littles += k;
    rows.push(['', big.name, '', '', Array.from({ length: k }, name).join(' + ')]);
  }
}
// Deliberately unresolvable rows, so the review queue is exercised too.
rows.push(['', 'Nobody Placeholder', '', '', name()]);
littles += 1;
rows.push([], ['', `TOTAL BIGS: ${rows.length - 1}`, '', '', `TOTAL LITTLES: ${littles}`]);
const sheet = parseOfficialPairingRows(rows);
const snapshot = buildRecapSnapshot({
  cycle: { label: 'Fall 2099', academicYearStart: 2099 },
  source: { label: 'Synthetic fixture (fictional names)', revision: null, retrievedAt: '2099-11-01' },
  families, nodes, pairings: sheet.pairings, sheetIssues: sheet.issues,
});
writeFileSync('tools/ace-recap-video/fixtures/synthetic-props.json', JSON.stringify({ presentation: toRecapPresentation(snapshot) }));
console.log(snapshot.totals);
