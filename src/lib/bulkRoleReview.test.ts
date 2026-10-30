import {
  MAX_ROLE_REVIEW_ROWS,
  getRoleReviewStatus,
  parseRoleNames,
  exactCandidateCount,
  type CabinetRoleSource,
} from './bulkRoleReview';
import { buildMemberNameIndex, type MemberOption } from './memberLinkMatching';

const people: MemberOption[] = [
  { id: 'id-1', fullName: 'Ada Example', displayName: 'Ada Example · Sixth', college: 'Sixth', year: 'Fourth Year' },
  { id: 'id-2', fullName: 'Béa Sample', displayName: 'Béa Sample · Muir', college: 'Muir', year: 'Third Year' },
  { id: 'id-3', fullName: 'Béa Sample', displayName: 'Béa Sample · Warren', college: 'Warren', year: 'First Year' },
];
const index = buildMemberNameIndex(people);
const source: CabinetRoleSource = {
  id: 'cabinet-row-1',
  name: 'Ada Example',
  role: 'Events Chair',
  category: 'General Board',
  member_id: null,
  cabinet_year_id: 'year-2026',
};
const firstRow = parseRoleNames('Ada Example', 'first-last')[0];

describe('Bulk Role Matcher name parser', () => {
  it('splits commas, newlines, semicolons and pasted spreadsheet columns in input order', () => {
    expect(parseRoleNames('Ada Example, Béa Sample;\nCai Example\nDai Sample', 'first-last').map((row) => row.name))
      .toEqual(['Ada Example', 'Béa Sample', 'Cai Example', 'Dai Sample']);
  });

  it('supports an explicit Last, First format without guessing comma structure', () => {
    expect(parseRoleNames('"Example, Ada"\n"Sample, Béa"', 'last-first').map((row) => row.name))
      .toEqual(['Ada Example', 'Béa Sample']);
    expect(parseRoleNames('Example, Ada', 'first-last')).toHaveLength(2);
    expect(() => parseRoleNames('Ada Example', 'last-first')).toThrow(/Last, First/);
  });

  it('keeps duplicate rows visible but identifies the first occurrence', () => {
    const rows = parseRoleNames('- Ada Example; ada  example\n* Béa Sample', 'first-last');
    expect(rows.map((row) => row.duplicateOf)).toEqual([null, 1, null]);
  });

  it('rejects excessive batches and oversized paste payloads without partial truncation', () => {
    expect(() => parseRoleNames(Array.from({ length: MAX_ROLE_REVIEW_ROWS + 1 }, (_, i) => 'Person ' + i).join('\n'), 'first-last'))
      .toThrow(/150 names/);
    expect(() => parseRoleNames('X'.repeat(16001), 'first-last')).toThrow(/too large/);
  });

  it('never turns accent-insensitive matching into an automatic identity selection', () => {
    expect(exactCandidateCount('bea sample', index)).toBe(2);
    expect(exactCandidateCount('ada example', index)).toBe(1);
    expect(exactCandidateCount('Unknown Example', index)).toBe(0);
  });
});

describe('Source-aware review status — no writes', () => {
  it('blocks preview until both identity and source are chosen', () => {
    expect(getRoleReviewStatus(firstRow, null, source, 'board', 'year-2026', ['cabinet-row-1'])).toBe('identity-review');
    expect(getRoleReviewStatus(firstRow, 'id-1', null, 'board', 'year-2026', [])).toBe('source-review');
    expect(getRoleReviewStatus(firstRow, 'id-1', source, 'board', 'year-2026', ['cabinet-row-1'])).toBe('ready');
  });

  it('never overwrites an existing canonical link or mismatched Cabinet year', () => {
    expect(getRoleReviewStatus(firstRow, 'id-1', { ...source, member_id: 'id-2' }, 'board', 'year-2026', ['cabinet-row-1']))
      .toBe('conflict');
    expect(getRoleReviewStatus(firstRow, 'id-1', { ...source, cabinet_year_id: 'year-2025' }, 'board', 'year-2026', ['cabinet-row-1']))
      .toBe('conflict');
    expect(getRoleReviewStatus(firstRow, 'id-1', { ...source, member_id: 'id-1' }, 'board', 'year-2026', ['cabinet-row-1']))
      .toBe('already-linked');
  });

  it('distinguishes published Intern from Board and does not conflate exact positions', () => {
    expect(getRoleReviewStatus(firstRow, 'id-1', { ...source, category: 'Interns' }, 'board', 'year-2026', ['cabinet-row-1']))
      .toBe('conflict');
    expect(getRoleReviewStatus(firstRow, 'id-1', { ...source, category: 'Interns', role: 'Intern' }, 'intern', 'year-2026', ['cabinet-row-1']))
      .toBe('ready');
  });

  it('requires a review for mismatched source name and reused source IDs', () => {
    expect(getRoleReviewStatus(firstRow, 'id-1', { ...source, name: 'Other Example' }, 'board', 'year-2026', ['cabinet-row-1']))
      .toBe('name-mismatch');
    expect(getRoleReviewStatus(firstRow, 'id-1', source, 'board', 'year-2026', ['cabinet-row-1', 'cabinet-row-1']))
      .toBe('conflict');
    expect(getRoleReviewStatus(firstRow, 'id-2', source, 'board', 'year-2026', ['cabinet-row-1'], 'Béa Sample'))
      .toBe('name-mismatch');
    const duplicate = parseRoleNames('Ada Example; ada example', 'first-last')[1];
    expect(getRoleReviewStatus(duplicate, 'id-1', source, 'board', 'year-2026', ['cabinet-row-1']))
      .toBe('identity-review');
  });
});
