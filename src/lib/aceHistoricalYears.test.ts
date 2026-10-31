import {
  academicYearLabel,
  canonicalFamKey,
  EvidenceBundle,
  EvidenceRecord,
  EvidenceSource,
  LiveFamily,
  LiveNode,
  LiveSnapshot,
  nameKeys,
  parseAcademicYear,
  parseEvidenceFile,
  parseLiveSnapshot,
  parseTerm,
  reconcilePickupYears,
  summarize,
  summarizeYearCoverage,
} from './aceHistoricalYears';
import { evidenceFromRepoFamilies, evidenceFromResearchPackage } from './aceHistoricalEvidence';

// Every person below is fictional.
const FAM = { id: 'fam-reef', slug: 'reef', name: 'Reef' };
const FAM2 = { id: 'fam-comet', slug: 'comet', name: 'Comet' };

function node(id: string, name: string, parent: string | null, family = FAM.id, extra: Partial<LiveNode> = {}): LiveNode {
  return { id, family_id: family, name, parent_member_id: parent, member_id: null, ...extra };
}

function snapshot(nodes: LiveNode[], families: LiveFamily[] = [FAM, FAM2]): LiveSnapshot {
  return { families, nodes };
}

const OFFICIAL_FA21: EvidenceSource = { source_id: 'FA21_OFFICIAL', kind: 'official_pairing', label: 'FA21', term: 'FA21', extraction_complete: true, authoritative: true };
const OFFICIAL_FA23: EvidenceSource = { source_id: 'FA23_OFFICIAL', kind: 'official_pairing', label: 'FA23', term: 'FA23', extraction_complete: true, authoritative: true };
const OFFICIAL_SP22: EvidenceSource = { source_id: 'SP22_OFFICIAL', kind: 'official_pairing', label: 'SP22', term: 'SP22', extraction_complete: true, authoritative: true };
const REPO: EvidenceSource = { source_id: 'REPO_REEF', kind: 'repo_added_term', label: 'repo', extraction_complete: true };
const MASTER_A: EvidenceSource = { source_id: 'MASTER_A', kind: 'master_year_cell', label: 'Master A', extraction_complete: true };
const MASTER_B: EvidenceSource = { source_id: 'MASTER_B', kind: 'master_year_cell', label: 'Master B', extraction_complete: true };
const ALL_SOURCES = [OFFICIAL_FA21, OFFICIAL_FA23, OFFICIAL_SP22, REPO, MASTER_A, MASTER_B];

function official(source: EvidenceSource, little: string, big: string, fam_hint = ''): EvidenceRecord {
  return { source_id: source.source_id, kind: 'official_pairing', little, big, term: source.term, fam_hint, ref: `row ${little}` };
}
function repo(little: string, big: string | null, term: string, fam_hint = 'Reef'): EvidenceRecord {
  return { source_id: REPO.source_id, kind: 'repo_added_term', little, big, term, fam_hint, ref: `members[${little}]` };
}
function master(source: EvidenceSource, little: string, year: number, fam_hint = 'REEF FAM'): EvidenceRecord {
  return { source_id: source.source_id, kind: 'master_year_cell', little, academic_year_start: year, fam_hint, ref: `${fam_hint}!E${year}` };
}
function bundle(records: EvidenceRecord[], sources: EvidenceSource[] = ALL_SOURCES): EvidenceBundle {
  return { sources, records };
}
function run(nodes: LiveNode[], records: EvidenceRecord[], opts: { families?: LiveFamily[]; sources?: EvidenceSource[]; max?: number } = {}) {
  const result = reconcilePickupYears(snapshot(nodes, opts.families), bundle(records, opts.sources), { maxAcademicYearStart: opts.max ?? 2025 });
  const byId = new Map(result.rows.map((r) => [r.ace_node_id, r] as const));
  return { result, row: (id: string) => byId.get(id)! };
}

const BASE = [node('root', 'Rowan Testroot', null), node('big', 'Bree Sample', 'root'), node('little', 'Lio Fakename', 'big')];

describe('terms and academic years', () => {
  it.each([
    ['FA21', 'FA21', 2021],
    ['SP22', 'SP22', 2021],
    ['WI22', 'WI22', 2021],
    ['FA23', 'FA23', 2023],
    ['SP23', 'SP23', 2022],
    ['fa25', 'FA25', 2025],
    ['SP 26', 'SP26', 2025],
    ['FA2019', 'FA19', 2019],
  ])('%s → %s in %i–', (raw, term, year) => {
    expect(parseTerm(raw)).toEqual({ term, academicYearStart: year });
  });

  it('keeps FA23 (2023–24) apart from SP23 (2022–23)', () => {
    expect(academicYearLabel(parseTerm('FA23')!.academicYearStart)).toBe('2023–24');
    expect(academicYearLabel(parseTerm('SP23')!.academicYearStart)).toBe('2022–23');
  });

  it.each(['legacy', '', 'SU22', 'FA', 'Fall 2021', '2021', 'FA2', "SP'99", 'FA99', 'FA1999'])('does not invent a term from %p', (raw) => {
    expect(parseTerm(raw)).toBeNull();
  });

  it('reads academic-year labels without inventing a term', () => {
    expect(parseAcademicYear('2021–22')).toBe(2021);
    expect(parseAcademicYear('2021-2022')).toBe(2021);
    expect(parseAcademicYear('2021')).toBe(2021);
    expect(parseAcademicYear('2021-23')).toBeNull();
    expect(parseAcademicYear('2021', true)).toBeNull();
    expect(parseAcademicYear('2021–22', true)).toBe(2021);
    expect(parseAcademicYear(16)).toBeNull();
    expect(parseAcademicYear('15-16')).toBeNull();
    expect(parseAcademicYear('FA21')).toBeNull();
    expect(parseAcademicYear('')).toBeNull();
  });
});

describe('names and fams', () => {
  it('folds accents, punctuation and nicknames conservatively', () => {
    expect(nameKeys('Đặng  Thị-Mai').exact).toBe('dang thi mai');
    expect(nameKeys('Mai T. Sample').loose).toContain('mai sample');
    expect(nameKeys('Vy Testdo (Vee)')).toEqual({ exact: 'vy testdo', loose: ['vee testdo'] });
  });

  it('maps historic fam labels', () => {
    expect(canonicalFamKey('NO SEX FAM')).toBe('nsf');
    expect(canonicalFamKey('GBM')).toBe('bang-mi');
    expect(canonicalFamKey('swp')).toBe('sweatpants');
    expect(canonicalFamKey('(Dead) Attractive AF (AAF)')).toBe('aaf');
    expect(canonicalFamKey('')).toBeNull();
  });
});

describe('reconcilePickupYears', () => {
  it('confirms a year when an official pairing names the Little under the live Big', () => {
    const { row } = run(BASE, [official(OFFICIAL_FA21, 'Lio Fakename', 'Bree Sample')]);
    expect(row('little')).toMatchObject({
      confidence_class: 'CONFIRMED_YEAR',
      recommended_pickup_academic_year: 2021,
      recommended_pickup_term: 'FA21',
      identity_resolution_status: 'RESOLVED_BY_LIVE_PAIR',
    });
    expect(row('big').confidence_class).toBe('UNKNOWN');
  });

  it('confirms through an obsolete source fam label, keeping the live fam', () => {
    const { row } = run(BASE, [official(OFFICIAL_FA21, 'Lio Fakename', 'Bree Sample', 'COMET FAM')]);
    expect(row('little').confidence_class).toBe('CONFIRMED_YEAR');
    expect(row('little').fam_id).toBe(FAM.id);
    expect(row('little').flags).toContain('SOURCE_FAM_LABEL_DIFFERS');
    expect(row('little').supporting[0].markers).toContain('fam_label_differs');
  });

  it('never moves a Little whose source Big differs from the live Big', () => {
    const nodes = [...BASE, node('other', 'Oren Wrongbig', 'root')];
    const snap = snapshot(nodes);
    const before = JSON.stringify(snap);
    const result = reconcilePickupYears(snap, bundle([official(OFFICIAL_FA21, 'Lio Fakename', 'Oren Wrongbig')]), { maxAcademicYearStart: 2025 });
    const little = result.rows.find((r) => r.ace_node_id === 'little')!;
    expect(little.confidence_class).toBe('CONFLICTING_EVIDENCE');
    expect(little.flags).toContain('SOURCE_BIG_DIFFERS');
    expect(little.current_big_node_id).toBe('big');
    expect(little.recommended_pickup_academic_year).toBe(2021);
    expect(JSON.stringify(snap)).toBe(before);
  });

  it('does not guess between two same-name people in one fam', () => {
    const nodes = [...BASE, node('twin-a', 'Kai Lumen', 'big'), node('other', 'Oren Sample', 'root'), node('twin-b', 'Kai Lumen', 'other')];
    const { row } = run(nodes, [master(MASTER_A, 'Kai Lumen', 2022), repo('Kai Lumen', null, 'FA22')]);
    for (const id of ['twin-a', 'twin-b']) {
      expect(row(id).recommended_pickup_academic_year).toBeNull();
      expect(row(id).flags).toEqual(expect.arrayContaining(['SAME_NAME_IN_FAM', 'AMBIGUOUS_IDENTITY']));
      expect(row(id).confidence_class).toBe('CONFLICTING_EVIDENCE');
    }
  });

  it('separates same-name people by their live Big when the source names one', () => {
    const nodes = [...BASE, node('twin-a', 'Kai Lumen', 'big'), node('other', 'Oren Sample', 'root'), node('twin-b', 'Kai Lumen', 'other')];
    const { row } = run(nodes, [official(OFFICIAL_FA23, 'Kai Lumen', 'Oren Sample')]);
    expect(row('twin-b')).toMatchObject({ confidence_class: 'CONFIRMED_YEAR', recommended_pickup_academic_year: 2023 });
    expect(row('twin-a').confidence_class).not.toBe('CONFIRMED_YEAR');
    expect(row('twin-a').recommended_pickup_academic_year).toBeNull();
  });

  it('does not join one name across two fams', () => {
    const nodes = [...BASE, node('c-root', 'Cam Testhead', null, FAM2.id), node('c-kai', 'Lio Fakename', 'c-root', FAM2.id)];
    const { row } = run(nodes, [master(MASTER_A, 'Lio Fakename', 2020, 'COMET FAM')]);
    expect(row('c-kai')).toMatchObject({ confidence_class: 'SUSPECTED_YEAR', recommended_pickup_academic_year: 2020, recommended_pickup_term: null });
    expect(row('little').confidence_class).toBe('UNKNOWN');
  });

  it('resolves historic fam aliases', () => {
    const fams = [{ id: 'fam-bm', slug: 'bang-mi', name: 'Bang Mi' }];
    const nodes = [node('r', 'Rhea Testroot', null, 'fam-bm'), node('l', 'Lux Sample', 'r', 'fam-bm')];
    const { row } = run(nodes, [repo('Lux Sample', 'Rhea Testroot', 'FA24', 'GBM')], { families: fams });
    expect(row('l')).toMatchObject({ confidence_class: 'STRONG_CANDIDATE', recommended_pickup_academic_year: 2024, recommended_pickup_term: 'FA24' });
  });

  it('keeps Moon and AAF apart while both fams are live', () => {
    const fams = [
      { id: 'fam-moon', slug: 'moon', name: 'Moon' },
      { id: 'fam-aaf', slug: 'dead-attractive-af-aaf', name: '(Dead) AAF' },
    ];
    const nodes = [node('m-root', 'Mira Testroot', null, 'fam-moon'), node('m-pat', 'Pax Sample', 'm-root', 'fam-moon'), node('a-root', 'Ada Testroot', null, 'fam-aaf')];
    const { row } = run(nodes, [master(MASTER_A, 'Pax Sample', 2021, 'AAF')], { families: fams });
    expect(row('m-pat').confidence_class).toBe('UNKNOWN');
  });

  it('reaches Moon from an AAF label only when no AAF fam is live, and says so', () => {
    const fams = [{ id: 'fam-moon', slug: 'moon', name: 'Moon' }];
    const nodes = [node('m-root', 'Mira Testroot', null, 'fam-moon'), node('m-pat', 'Pax Sample', 'm-root', 'fam-moon')];
    const { row } = run(nodes, [master(MASTER_A, 'Pax Sample', 2021, 'AAF')], { families: fams });
    expect(row('m-pat').confidence_class).toBe('SUSPECTED_YEAR');
    expect(row('m-pat').flags).toContain('AAF_TO_MOON');
    expect(row('m-pat').supporting[0].markers).toContain('aaf_to_moon');
  });

  it('holds a person whose Master variants place them in different years', () => {
    const { row } = run(BASE, [master(MASTER_A, 'Lio Fakename', 2019), master(MASTER_B, 'Lio Fakename', 2020)]);
    expect(row('little')).toMatchObject({ confidence_class: 'CONFLICTING_EVIDENCE', recommended_pickup_academic_year: null });
    expect(row('little').flags).toContain('MASTER_VARIANTS_DISAGREE');
    expect(row('little').candidate_years).toEqual([2019, 2020]);
  });

  it('holds conflicting official and repo years, keeping both candidates', () => {
    const { row } = run(BASE, [official(OFFICIAL_FA21, 'Lio Fakename', 'Bree Sample'), repo('Lio Fakename', 'Bree Sample', 'FA23')]);
    expect(row('little').confidence_class).toBe('CONFLICTING_EVIDENCE');
    expect(row('little').flags).toContain('SOURCE_YEARS_DISAGREE');
    expect(row('little').recommended_pickup_academic_year).toBe(2021);
    expect(row('little').candidate_years).toEqual([2021, 2023]);
  });

  it('holds an official year that a Master row contradicts', () => {
    const { row } = run(BASE, [official(OFFICIAL_FA21, 'Lio Fakename', 'Bree Sample'), master(MASTER_A, 'Lio Fakename', 2023)]);
    expect(row('little').confidence_class).toBe('CONFLICTING_EVIDENCE');
    expect(row('little').flags).toContain('MASTER_DISAGREES');
  });

  it('treats different terms in one academic year as agreement on the year only', () => {
    const { row } = run(BASE, [official(OFFICIAL_FA21, 'Lio Fakename', 'Bree Sample'), official(OFFICIAL_SP22, 'Lio Fakename', 'Bree Sample')]);
    expect(row('little')).toMatchObject({ confidence_class: 'CONFIRMED_YEAR', recommended_pickup_academic_year: 2021, recommended_pickup_term: null });
    expect(row('little').flags).toContain('TERMS_DISAGREE_SAME_YEAR');
  });

  it('agreeing official, repo and Master evidence confirm the year', () => {
    const { row } = run(BASE, [official(OFFICIAL_FA21, 'Lio Fakename', 'Bree Sample'), repo('Lio Fakename', 'Bree Sample', 'FA21'), master(MASTER_A, 'Lio Fakename', 2021)]);
    expect(row('little')).toMatchObject({ confidence_class: 'CONFIRMED_YEAR', recommended_pickup_term: 'FA21' });
    expect(row('little').supporting).toHaveLength(3);
  });

  it('leaves unknown and legacy-only people unknown', () => {
    const { row } = run(BASE, [repo('Bree Sample', 'Rowan Testroot', 'legacy')]);
    expect(row('big')).toMatchObject({ confidence_class: 'UNKNOWN', recommended_pickup_academic_year: null });
    expect(row('big').flags).toContain('LEGACY_TERM_ONLY');
    expect(row('root')).toMatchObject({ confidence_class: 'UNKNOWN', identity_resolution_status: 'NO_SOURCE_MATCH' });
  });

  it('never proposes a year after the latest revealed cycle', () => {
    const { row } = run(BASE, [master(MASTER_A, 'Lio Fakename', 2026)]);
    expect(row('little').confidence_class).toBe('CONFLICTING_EVIDENCE');
    expect(row('little').flags).toContain('FUTURE_OR_UNREVEALED_YEAR');
    expect(row('little').recommended_pickup_academic_year).toBeNull();
  });

  it('holds the weaker side when a Little predates their Big', () => {
    const { row } = run(BASE, [official(OFFICIAL_FA21, 'Lio Fakename', 'Bree Sample'), master(MASTER_A, 'Bree Sample', 2023)]);
    expect(row('little').confidence_class).toBe('CONFIRMED_YEAR');
    expect(row('little').flags).toContain('CHILD_EARLIER_THAN_BIG');
    expect(row('big').confidence_class).toBe('CONFLICTING_EVIDENCE');
    expect(row('big').recommended_pickup_academic_year).toBe(2023);
  });

  it('caps evidence from an incompletely read source below confirmed', () => {
    const partial = { ...OFFICIAL_FA21, extraction_complete: false };
    const { row } = run(BASE, [official(partial, 'Lio Fakename', 'Bree Sample')], { sources: [partial] });
    expect(row('little').confidence_class).toBe('STRONG_CANDIDATE');
    expect(row('little').flags).toContain('INCOMPLETE_SOURCE');
  });

  it('never confirms from a pairing list that is not labelled official', () => {
    const unlabelled = { ...OFFICIAL_FA21, authoritative: undefined };
    const { row } = run(BASE, [official(unlabelled, 'Lio Fakename', 'Bree Sample')], { sources: [unlabelled] });
    expect(row('little').confidence_class).toBe('STRONG_CANDIDATE');
    expect(row('little').flags).toContain('UNLABELLED_PAIRING_SOURCE');
  });

  it('matches looser spellings only as a strong candidate', () => {
    const nodes = [node('root', 'Rowan Testroot', null), node('big', 'Bree Sample', 'root'), node('little', 'Mai Sample', 'big')];
    const { row } = run(nodes, [official(OFFICIAL_FA21, 'Mai T. Sample', 'Bree Sample')]);
    expect(row('little').confidence_class).toBe('STRONG_CANDIDATE');
    expect(row('little').supporting[0].identity).toBe('loose_pair');
  });

  it('flags a canonical member linked to several nodes', () => {
    const nodes = [node('root', 'Rowan Testroot', null, FAM.id, { member_id: 'mem-1' }), node('c-root', 'Rowan Testroot', null, FAM2.id, { member_id: 'mem-1' })];
    const { row } = run(nodes, []);
    expect(row('root').flags).toContain('CANONICAL_MEMBER_ON_SEVERAL_NODES');
  });

  it('reports source rows that reach no live node, including leaked header rows', () => {
    const { result } = run(BASE, [official(OFFICIAL_FA21, 'Nobody Onthetree', 'Bree Sample'), official(OFFICIAL_FA21, 'LITTLE', 'BIG')]);
    expect(result.unmatched.map((u) => u.reason).sort()).toEqual(['no_live_node', 'unusable_name']);
  });

  it('flags Master-only years in a fam whose Master rows mostly disagree with stronger evidence', () => {
    const nodes: LiveNode[] = [node('root', 'Rowan Testroot', null)];
    const records: EvidenceRecord[] = [];
    for (let i = 0; i < 10; i++) {
      nodes.push(node(`n${i}`, `Person${String.fromCharCode(97 + i)} Sample`, 'root'));
      records.push(repo(`Person${String.fromCharCode(97 + i)} Sample`, 'Rowan Testroot', 'FA21'), master(MASTER_A, `Person${String.fromCharCode(97 + i)} Sample`, 2023));
    }
    nodes.push(node('lone', 'Quill Sample', 'root'));
    records.push(master(MASTER_A, 'Quill Sample', 2022));
    const { result, row } = run(nodes, records);
    expect(result.masterCalibration[FAM.id]).toEqual({ compared: 10, agreed: 0 });
    expect(row('lone').confidence_class).toBe('SUSPECTED_YEAR');
    expect(row('lone').flags).toContain('MASTER_UNRELIABLE_IN_FAM');
  });

  it('holds an official pair when the labelled fam has its own same-name Little', () => {
    const nodes = [...BASE, node('c-root', 'Cam Testhead', null, FAM2.id), node('c-lio', 'Lio Fakename', 'c-root', FAM2.id)];
    const { row } = run(nodes, [official(OFFICIAL_FA23, 'Lio Fakename', 'Bree Sample', 'COMET FAM')]);
    for (const id of ['little', 'c-lio']) {
      expect(row(id).confidence_class).toBe('CONFLICTING_EVIDENCE');
      expect(row(id).flags).toContain('AMBIGUOUS_IDENTITY');
    }
  });

  it('never confirms from a Big-less official row about a root', () => {
    const { row } = run(BASE, [{ ...official(OFFICIAL_FA21, 'Rowan Testroot', ''), big: '' }]);
    expect(row('root').confidence_class).toBe('STRONG_CANDIDATE');
    expect(row('root').flags).toContain('OFFICIAL_ROW_WITHOUT_BIG');
  });

  it('holds a row when ambiguous evidence gives a different year', () => {
    const nodes = [...BASE, node('c-root', 'Cam Testhead', null, FAM2.id), node('c-bree', 'Bree Sample', 'c-root', FAM2.id), node('c-lio', 'Lio Fakename', 'c-bree', FAM2.id)];
    const { row } = run(nodes, [official(OFFICIAL_FA21, 'Lio Fakename', 'Bree Sample'), master(MASTER_A, 'Lio Fakename', 2018)]);
    expect(row('little').confidence_class).toBe('CONFLICTING_EVIDENCE');
    expect(row('little').flags).toContain('AMBIGUOUS_IDENTITY');
  });

  it('holds a confirmed Little who predates a Big whose year is official but itself held', () => {
    const fa19: EvidenceSource = { source_id: 'FA19_OFFICIAL', kind: 'official_pairing', label: 'FA19', term: 'FA19', extraction_complete: true, authoritative: true };
    const { row } = run(BASE, [official(OFFICIAL_FA21, 'Bree Sample', 'Rowan Testroot'), master(MASTER_A, 'Bree Sample', 2020), official(fa19, 'Lio Fakename', 'Bree Sample')], {
      sources: [...ALL_SOURCES, fa19],
    });
    expect(row('big').confidence_class).toBe('CONFLICTING_EVIDENCE');
    expect(row('little').confidence_class).toBe('CONFLICTING_EVIDENCE');
    expect(row('little').flags).toContain('CHILD_EARLIER_THAN_BIG');
  });

  it('checks term order within one academic year', () => {
    const { row } = run(BASE, [official(OFFICIAL_SP22, 'Bree Sample', 'Rowan Testroot'), official(OFFICIAL_FA21, 'Lio Fakename', 'Bree Sample')]);
    expect(row('little').flags).toContain('CHILD_EARLIER_THAN_BIG');
    expect(row('little').confidence_class).toBe('CONFLICTING_EVIDENCE');
  });

  it('flags matched rows whose term cannot be read', () => {
    const { row } = run(BASE, [{ ...official(OFFICIAL_FA21, 'Lio Fakename', 'Bree Sample'), term: 'Fall 2021' }], {
      sources: [{ ...OFFICIAL_FA21, term: null }],
    });
    expect(row('little').confidence_class).toBe('UNKNOWN');
    expect(row('little').flags).toContain('UNPARSEABLE_TERM');
  });

  it('holds a row whose existing live year differs from the evidence', () => {
    const nodes = BASE.map((n) => (n.id === 'little' ? { ...n, pickup_term: 'FA22', pickup_academic_year_start: 2022 } : n));
    const { row } = run(nodes, [official(OFFICIAL_FA21, 'Lio Fakename', 'Bree Sample')]);
    expect(row('little').confidence_class).toBe('CONFLICTING_EVIDENCE');
    expect(row('little').flags).toContain('EXISTING_YEAR_DIFFERS');
  });

  it('is deterministic and order-independent across repeated runs', () => {
    const records = [official(OFFICIAL_FA21, 'Lio Fakename', 'Bree Sample'), master(MASTER_A, 'Bree Sample', 2020), repo('Bree Sample', 'Rowan Testroot', 'legacy')];
    const first = reconcilePickupYears(snapshot(BASE), bundle(records), { maxAcademicYearStart: 2025 });
    const again = reconcilePickupYears(snapshot(BASE), bundle(records.slice().reverse()), { maxAcademicYearStart: 2025 });
    const shape = (r: typeof first) => r.rows.map((x) => [x.ace_node_id, x.confidence_class, x.recommended_pickup_academic_year, x.recommended_pickup_term, x.flags.slice().sort()]);
    expect(shape(again)).toEqual(shape(first));
    expect(reconcilePickupYears(snapshot(BASE), bundle(records), { maxAcademicYearStart: 2025 })).toEqual(first);
  });

  it('returns exactly one row per live node', () => {
    const { result } = run(BASE, [official(OFFICIAL_FA21, 'Lio Fakename', 'Bree Sample')]);
    expect(result.rows.map((r) => r.ace_node_id).sort()).toEqual(['big', 'little', 'root']);
  });
});

describe('summarize', () => {
  it('contains counts only: no names, node ids or cell references', () => {
    const nodes = [...BASE, node('twin', 'Kai Lumen', 'big', FAM.id, { member_id: 'member-uuid-1' })];
    const records = [official(OFFICIAL_FA21, 'Lio Fakename', 'Bree Sample'), master(MASTER_A, 'Kai Lumen', 2022)];
    const ev = bundle(records);
    const result = reconcilePickupYears(snapshot(nodes), ev, { maxAcademicYearStart: 2025 });
    const text = JSON.stringify(summarize(result, ev, '2026-01-01'));
    for (const secret of ['Rowan', 'Bree', 'Lio', 'Kai', 'Lumen', 'little', 'twin', 'member-uuid-1', 'E2022', 'row ', 'Master A']) expect(text).not.toContain(secret);
    const summary = summarize(result, ev, '2026-01-01');
    expect(summary.live_nodes).toBe(4);
    expect(summary.classes.CONFIRMED_YEAR).toBe(1);
    expect(summary.classes.SUSPECTED_YEAR).toBe(1);
  });
});

describe('input validation', () => {
  const fams = [FAM];
  it('rejects malformed, empty or inconsistent live snapshots', () => {
    expect(() => parseLiveSnapshot(fams, [])).toThrow(/empty/);
    expect(() => parseLiveSnapshot({}, [])).toThrow(/malformed/);
    expect(() => parseLiveSnapshot(fams, [{ id: 'a', name: 'X' }])).toThrow(/malformed/);
    expect(() => parseLiveSnapshot(fams, [node('a', 'X', null), node('a', 'Y', null)])).toThrow(/repeats node id/);
    expect(() => parseLiveSnapshot(fams, [node('a', 'X', null, 'fam-missing')])).toThrow(/not in the families snapshot/);
    const bare = parseLiveSnapshot(fams, [{ id: 'a', family_id: FAM.id, name: 'X', parent_member_id: null }]);
    expect(bare.nodes[0].member_id).toBeNull();
    expect(bare.hasPickupColumns).toBe(false);
    expect(parseLiveSnapshot(fams, [{ ...node('a', 'X', null), pickup_term: null, pickup_academic_year_start: null }]).hasPickupColumns).toBe(true);
  });

  it('rejects malformed evidence files', () => {
    const good = { schema: 'ace-pickup-evidence/v1', sources: [OFFICIAL_FA21], records: [official(OFFICIAL_FA21, 'A Person', 'B Person')] };
    expect(parseEvidenceFile(good).records).toHaveLength(1);
    expect(() => parseEvidenceFile({ ...good, schema: 'v0' })).toThrow(/malformed/);
    expect(() => parseEvidenceFile({ ...good, records: [{ ...good.records[0], source_id: 'NOPE' }] })).toThrow(/undeclared source/);
    expect(() => parseEvidenceFile({ ...good, records: [{ ...good.records[0], kind: 'master_year_cell' }] })).toThrow(/but source/);
    expect(() => parseEvidenceFile({ ...good, sources: [OFFICIAL_FA21, OFFICIAL_FA21] })).toThrow(/twice/);
    expect(() => parseEvidenceFile({ ...good, sources: [{ ...OFFICIAL_FA21, source_id: 'https://example.test/x' }] })).toThrow(/A-Z/);
    expect(() => parseEvidenceFile(null)).toThrow(/malformed/);
  });
});

describe('evidence adapters', () => {
  it('reads repo added_term, keeps legacy as written and skips blank terms', () => {
    const json = {
      family: 'Reef',
      members: [
        { name: 'Rowan Testroot', big: null },
        { name: 'Bree Sample', big: 'Rowan Testroot', added_term: 'legacy' },
        { name: 'Lio Fakename', big: 'Bree Sample', added_term: 'FA22', confidence: 'inferred-high' },
      ],
    };
    const { sources, records, blankTerms } = evidenceFromRepoFamilies([{ file: 'reef.json', json: { ...json, members: [...json.members, { name: 'Nia Sample', big: 'Lio Fakename' }] } }]);
    expect(blankTerms).toBe(1);
    expect(sources[0].source_id).toBe('REPO_REEF');
    expect(records.map((r) => [r.little, r.term])).toEqual([
      ['Bree Sample', 'legacy'],
      ['Lio Fakename', 'FA22'],
    ]);
    expect(() => evidenceFromRepoFamilies([{ file: 'bad.json', json: { members: [] } }])).toThrow(/bad.json/);
  });

  it('reads the research package, skipping multi-name Master cells', () => {
    const pkg = {
      created: '2026-01-01',
      official: [{ term: 'FA21', big: 'Bree Sample', little: 'Lio Fakename', fam_hint: '', source: 'Official FA21', tab: 'Pairings', source_row: 4 }],
      master: [
        { variant: 'A', fam: 'reef', tab: 'REEF FAM', row: 6, col: 'E', cell: 'Lio Fakename', year: 2021, simple: true },
        { variant: 'A', fam: 'reef', tab: 'REEF FAM', row: 7, col: 'E', cell: 'Two / People', year: 2021, simple: false },
        { variant: 'A', fam: 'reef', tab: 'REEF FAM', row: 8, col: 'E', cell: 'Odd Year', year: 16, simple: true },
      ],
    };
    const { bundle: b, skippedMasterCells } = evidenceFromResearchPackage({ ...pkg, official: [...pkg.official, { ...pkg.official[0], term: 'Fall 2023', source: 'https://example.test/sheet' }] });
    expect(skippedMasterCells).toBe(2);
    expect(b.sources.map((s) => s.source_id).sort()).toEqual(['PKG_FA21_OFFICIAL_1', 'PKG_MASTER_A']);
    expect(b.sources.find((s) => s.kind === 'official_pairing')?.authoritative).toBe(false);
    expect(b.records.find((r) => r.kind === 'master_year_cell')).toMatchObject({ academic_year_start: 2021, ref: 'REEF FAM!E6' });
    expect(() => evidenceFromResearchPackage({ official: [] })).toThrow(/master/);
    expect(evidenceFromResearchPackage(pkg, ['master']).bundle.sources.map((s) => s.source_id)).toEqual(['PKG_MASTER_A']);
  });
});


describe('aggregate pickup-year coverage, not private evidence (#675)', () => {
  const publicSnapshot = () => parseLiveSnapshot([
    { id: 'active-fam', slug: 'active-fictional', name: 'Fictional Active' },
    { id: 'old-fam', slug: 'dead-fictional', name: 'Fictional Graveyard' },
  ], [
    { ...node('root', 'Fictional Root', null, 'active-fam'),
      pickup_academic_year_start: 2021, pickup_term: 'FA21' },
    { ...node('child', 'Fictional Child', 'root', 'active-fam'),
      pickup_academic_year_start: 2023, pickup_term: null },
    { ...node('other', 'Fictional Other', 'root', 'active-fam'),
      pickup_academic_year_start: null, pickup_term: null },
    { ...node('archived', 'Fictional Archived', null, 'old-fam'),
      pickup_academic_year_start: 2023, pickup_term: 'SP24' },
    { ...node('bad', 'Fictional Bad', 'archived', 'old-fam'),
      pickup_academic_year_start: 2021, pickup_term: 'FA23' },
  ]);
  const sources = [
    { file: 'alpha.json', json: {
      family: 'Fictional Alpha', members: [
        { name: 'Secret Name Alpha', big: null, added_term: 'FA21' },
        { name: 'Secret Name Beta', big: 'Secret Name Alpha', added_term: 'SP22' },
        { name: 'Secret Name Gamma', big: 'Secret Name Alpha', added_term: '2023–24' },
        { name: 'Secret Name Delta', big: 'Secret Name Alpha', added_term: 'legacy' },
        { name: 'Secret Name Epsilon', big: 'Secret Name Alpha' },
        { name: 'Secret Name Zeta', big: 'Secret Name Alpha', added_term: 'SU23' },
      ],
    }},
    { file: 'graveyard.json', json: { family: 'Fictional Graveyard', members: [
      { name: 'Secret Archived Name', big: null, added_term: 'FA23' },
    ]}},
  ];

  it('counts exact terms, year-only, legacy, absent and malformed separately', () => {
    const result = summarizeYearCoverage(publicSnapshot(), sources);
    expect(result.source_total).toEqual({
      files: 2, members: 7, exact: 3, year_only: 1, legacy: 1,
      absent: 1, needs_review: 1,
    });
    expect(result.sources.map((s) => [s.file, s.total, s.exact])).toEqual([
      ['alpha.json', 6, 2], ['graveyard.json', 1, 1],
    ]);
  });

  it('uses only approved public pickup columns and includes archived families', () => {
    const result = summarizeYearCoverage(publicSnapshot(), sources);
    expect(result.live_total).toEqual({
      families: 2, nodes: 5, approved_year: 3, approved_term: 2, unknown: 2,
    });
    expect(result.live_families).toEqual([
      { fam_slug: 'active-fictional', nodes: 3, approved_year: 2, approved_term: 1, unknown: 1 },
      { fam_slug: 'dead-fictional', nodes: 2, approved_year: 1, approved_term: 1, unknown: 1 },
    ]);
    expect(result.live_total.approved_year + result.live_total.unknown)
      .toBe(result.live_total.nodes);
  });

  it('requires #669 columns and refuses a misleading empty or incomplete snapshot', () => {
    expect(() => summarizeYearCoverage(snapshot(BASE), sources)).toThrow(/both #669 approved pickup columns/);
    const incomplete = publicSnapshot();
    delete incomplete.nodes[0].pickup_term;
    expect(() => summarizeYearCoverage(incomplete, sources)).toThrow(/both #669 approved pickup columns/);
    expect(() => summarizeYearCoverage(publicSnapshot(), [])).toThrow(/source coverage is unknown/);
  });

  it('never includes person name, member ID, photo, source note, or raw evidence in the report', () => {
    const report = JSON.stringify(summarizeYearCoverage(publicSnapshot(), sources));
    for (const privateField of ['Secret Name', 'Fictional Child', 'member_id',
      'parent_member_id', 'photo_url', 'source_confidence', 'review_note',
      'added_term', 'source_doc_url', 'live_node_id']) {
      expect(report).not.toContain(privateField);
    }
    expect(report).toContain('dead-fictional');
  });

  it('refuses duplicated node IDs and invalid reconstruction inputs', () => {
    const invalid = publicSnapshot();
    invalid.nodes.push({ ...invalid.nodes[0] });
    expect(() => summarizeYearCoverage(invalid, sources)).toThrow(/Duplicate live node IDs/);
    expect(() => summarizeYearCoverage(publicSnapshot(), [
      sources[0], { ...sources[1], file: 'alpha.json' },
    ])).toThrow(/distinct safe JSON basenames/);
    expect(() => summarizeYearCoverage(publicSnapshot(), [
      { file: 'invalid.json', json: { family: 'Fictional', members: [] } },
    ])).toThrow(/malformed/);
  });
});
