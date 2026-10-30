import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from 'react-query';
import { AdminPageHeader } from '../../components/features/admin/AdminPageHeader';
import { useCabinetYears } from '../../hooks/useCabinetYears';
import { useMemberDirectory } from '../../hooks/useMemberDirectory';
import { getAcademicYearStart, formatAcademicYear } from '../../lib/academicTerms';
import { normalizeMemberName, type MemberOption } from '../../lib/memberLinkMatching';
import {
  MAX_ROLE_REVIEW_ROWS,
  belongsToRole,
  exactCandidateCount,
  getRoleReviewStatus,
  parseRoleNames,
  type CabinetRoleSource,
  type NamePasteFormat,
  type ReviewRoleKind,
  type RoleReviewInput,
  type RoleReviewStatus,
} from '../../lib/bulkRoleReview';
import { listCabinetRoleReviewSources } from '../../data/repos/roleReview';

const fieldCls = 'w-full rounded border border-border-strong bg-surface px-3 py-2.5 font-sans text-sm text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 dark:focus-visible:ring-brand-400';
const actionCls = 'inline-flex min-h-11 items-center justify-center rounded border border-border-strong bg-surface px-3 text-sm font-semibold text-text-primary hover:bg-surface2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600';
const STATUS_LABELS: Record<RoleReviewStatus, string> = {
  'identity-review': 'Needs identity review',
  'source-review': 'Needs program source',
  'name-mismatch': 'Source name differs — review in Cabinet',
  'conflict': 'Conflicting source',
  'already-linked': 'Already assigned · no change needed',
  'ready': 'Ready to review in Cabinet',
};

function memberChoices(
  term: string,
  members: readonly MemberOption[],
  exact: readonly MemberOption[],
  selected: MemberOption | undefined,
) {
  const normalized = normalizeMemberName(term);
  const found = normalized
    ? members.filter((member) => normalizeMemberName(member.fullName).includes(normalized)).slice(0, 12)
    : exact;
  const unique = new Map(found.map((member) => [member.id, member]));
  if (selected) unique.set(selected.id, selected);
  return Array.from(unique.values()).sort((a, b) => a.fullName.localeCompare(b.fullName));
}

export default function AdminMemberRoles() {
  const [yearStart, setYearStart] = useState(() => getAcademicYearStart(new Date()));
  const [role, setRole] = useState<ReviewRoleKind>('board');
  const [format, setFormat] = useState<NamePasteFormat>('first-last');
  const [raw, setRaw] = useState('');
  const [rows, setRows] = useState<RoleReviewInput[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const [memberIds, setMemberIds] = useState<Record<number, string>>({});
  const [sourceIds, setSourceIds] = useState<Record<number, string>>({});
  const [memberSearch, setMemberSearch] = useState<Record<number, string>>({});
  const [sourceSearch, setSourceSearch] = useState<Record<number, string>>({});
  const [statusFilter, setStatusFilter] = useState<'all' | 'ready' | 'unresolved' | 'conflict'>('all');

  const { cabinetYears, loading: yearsLoading, error: yearsError } = useCabinetYears();
  const year = cabinetYears.find((item) => item.start_year === yearStart);
  const directory = useMemberDirectory(rows.length > 0);
  const { data: sources = [], isLoading: sourcesLoading, isError: sourcesError, refetch: refreshSources } = useQuery<CabinetRoleSource[]>({
    queryKey: ['admin-role-review-sources', year?.id ?? null],
    queryFn: () => listCabinetRoleReviewSources(year?.id ?? ''),
    enabled: !!year?.id && rows.length > 0,
    staleTime: 60 * 1000,
    retry: false,
  });
  const roleSources = useMemo(() => sources.filter((source) => belongsToRole(source, role)), [role, sources]);
  const sourceById = useMemo(() => new Map(roleSources.map((source) => [source.id, source])), [roleSources]);
  const selectedSources = rows.map((row) => sourceIds[row.index]).filter(Boolean);
  const readsPending = yearsLoading || directory.loading || sourcesLoading;
  const readsFailed = !!yearsError || !!directory.error || sourcesError || !year;

  const reviews = rows.map((row) => {
    const selectedMemberId = memberIds[row.index] || null;
    const source = sourceById.get(sourceIds[row.index]) ?? null;
    const status = getRoleReviewStatus(row, selectedMemberId, source, role, year?.id ?? '', selectedSources);
    return { row, status, source };
  });
  const readyCount = reviews.filter((item) => item.status === 'ready').length;
  const linkedCount = reviews.filter((item) => item.status === 'already-linked').length;
  const conflictCount = reviews.filter((item) => item.status === 'conflict' || item.status === 'name-mismatch').length;
  const unresolvedCount = reviews.length - readyCount - linkedCount - conflictCount;
  const visibleReviews = reviews.filter((item) =>
    statusFilter === 'all' ||
    (statusFilter === 'ready' && (item.status === 'ready' || item.status === 'already-linked')) ||
    (statusFilter === 'conflict' && (item.status === 'conflict' || item.status === 'name-mismatch')) ||
    (statusFilter === 'unresolved' && (item.status === 'source-review' || item.status === 'identity-review'))
  );

  const resetReview = () => {
    setRows([]);
    setMemberIds({});
    setSourceIds({});
    setMemberSearch({});
    setSourceSearch({});
    setParseError(null);
    setStatusFilter('all');
  };
  const parse = () => {
    try {
      const next = parseRoleNames(raw, format);
      if (next.length === 0) {
        setParseError('Paste at least one name to begin.');
        setRows([]);
        return;
      }
      resetReview();
      setRows(next);
    } catch (error) {
      resetReview();
      setParseError(error instanceof Error ? error.message : 'Unable to parse the names.');
    }
  };

  return (
    <div className="min-w-0">
      <AdminPageHeader
        description="Paste names, compare canonical member identities with published program records, and review each link before changing the real roster."
        related={['/admin/members', '/admin/cabinet', '/admin/cabinet/rollover', '/admin/interns', '/admin/merge-suggestions']}
      />
      <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6 lg:p-8">
        <section className="rounded border border-border-strong bg-surface2 p-4 text-sm text-text-secondary">
          <h2 className="font-semibold text-text-primary">Review-only phase — no roles are assigned here</h2>
          <p className="mt-1 leading-relaxed">Confirm a real member and an existing published Cabinet/Intern record, then open that exact record in Cabinet to review and save its canonical link. A name alone never creates a Board or Intern badge. House Parents, ACE Fam Heads, and VCN roles still use their own protected editors.</p>
        </section>

        <section aria-labelledby="role-scope" className="rounded border border-border-strong bg-surface p-4 sm:p-5">
          <h2 id="role-scope" className="mb-4 font-serif text-xl text-text-primary">1. Choose role and year</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-xs font-semibold text-text-secondary">
              Academic year (not All Time)
              <select aria-label="Academic year" value={yearStart} onChange={(e) => { setYearStart(Number(e.target.value)); resetReview(); }} className={'mt-1 ' + fieldCls} disabled={yearsLoading || !!yearsError}>
                {!cabinetYears.some((item) => item.start_year === yearStart) && <option value={yearStart}>{formatAcademicYear(yearStart)} — not configured</option>}
                {cabinetYears.map((item) => <option key={item.id} value={item.start_year}>{item.label || formatAcademicYear(item.start_year)}</option>)}
              </select>
            </label>
            <label className="block text-xs font-semibold text-text-secondary">
              Verified source category
              <select aria-label="Role category" value={role} onChange={(e) => { setRole(e.target.value as ReviewRoleKind); resetReview(); }} className={'mt-1 ' + fieldCls}>
                <option value="board">Board Member (Executive/General Board)</option>
                <option value="intern">Intern (published Cabinet entry)</option>
                <option disabled>House Parent — use Admin Houses</option>
                <option disabled>ACE Fam Head — use ACE Families</option>
                <option disabled>VCN roles — integration pending</option>
              </select>
            </label>
          </div>
          <p className="mt-3 text-xs text-text-secondary">
            {role === 'board' ? 'Only existing, legitimate Executive/General Board entries qualify. Exact officer titles are preserved.' : 'Only published Interns category entries qualify, not Board by default.'}
          </p>
        </section>

        <section aria-labelledby="role-paste" className="rounded border border-border-strong bg-surface p-4 sm:p-5">
          <h2 id="role-paste" className="mb-3 font-serif text-xl text-text-primary">2. Paste and parse names</h2>
          <label htmlFor="role-names" className="block text-xs font-semibold text-text-secondary">Member names, up to {MAX_ROLE_REVIEW_ROWS} rows</label>
          <textarea id="role-names" rows={4} value={raw} onChange={(e) => setRaw(e.target.value)} placeholder="Ada Example, Bea Sample, Cai Example" className={'mt-1 ' + fieldCls} />
          <label className="mt-3 inline-flex items-center gap-2 text-sm text-text-secondary">
            <input type="checkbox" checked={format === 'last-first'} onChange={(e) => { setFormat(e.target.checked ? 'last-first' : 'first-last'); resetReview(); }} />
            Each line uses Last, First (one name per line)
          </label>
          <p className="mt-1 text-xs text-text-muted">Default: commas, semicolons or newlines separate people. For “Nguyen, Ada” as a single name, enable Last, First. Duplicate inputs remain visible but require separate review.</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" onClick={parse} className={actionCls}>Parse names</button>
            <button type="button" onClick={() => { setRaw(''); resetReview(); }} className={actionCls}>Clear</button>
          </div>
          {parseError && <p role="alert" className="mt-2 text-sm text-red-700 dark:text-red-400">{parseError}</p>}
        </section>

        {rows.length > 0 && (
          <section aria-labelledby="role-review" className="rounded border border-border-strong bg-surface p-4 sm:p-5">
            <h2 id="role-review" className="font-serif text-xl text-text-primary">3. Verify identities and sources · {formatAcademicYear(yearStart)}</h2>
            <p role="status" aria-live="polite" className="my-3 text-sm text-text-secondary">
              {rows.length} inputs · {readyCount} ready for editor · {linkedCount} already linked · {conflictCount} conflicts · {unresolvedCount} unresolved · 0 roles published by this tool
            </p>
            {readsPending && <p role="status" className="mb-3 text-sm text-text-secondary">Loading the complete member directory and matching year's Cabinet roster…</p>}
            {readsFailed && !readsPending && (
              <div role="alert" className="mb-3 rounded border border-red-500/40 p-3 text-sm text-red-700 dark:text-red-400">
                Identity or Cabinet source data is unavailable. No match is safe to confirm. Check the configured Cabinet year, then retry.
                <button type="button" onClick={() => { directory.error && window.location.reload(); void refreshSources(); }} className={'ml-2 ' + actionCls}>Retry sources</button>
              </div>
            )}
            <label className="mb-3 block max-w-xs text-xs font-semibold text-text-secondary">
              Show review rows
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)} className={'mt-1 ' + fieldCls}>
                <option value="all">All rows</option><option value="ready">Ready / already linked</option>
                <option value="unresolved">Need review or source</option><option value="conflict">Conflicting</option>
              </select>
            </label>
            <ol className="space-y-4">
              {visibleReviews.map(({ row, status, source }) => {
                const exact = directory.nameIndex.get(normalizeMemberName(row.name)) ?? [];
                const selected = directory.byId.get(memberIds[row.index]);
                const candidates = memberChoices(memberSearch[row.index] ?? '', directory.members, exact, selected);
                const sourceTerm = normalizeMemberName(sourceSearch[row.index] ?? '');
                const sourceChoices = roleSources.filter((item) =>
                  sourceTerm ? normalizeMemberName(item.name).includes(sourceTerm) || normalizeMemberName(item.role).includes(sourceTerm)
                    : normalizeMemberName(item.name) === normalizeMemberName(row.name)
                ).slice(0, 20);
                if (source && !sourceChoices.some((item) => item.id === source.id)) sourceChoices.push(source);
                return (
                  <li key={row.index} className="rounded border border-border-strong bg-surface2 p-3 sm:p-4">
                    <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
                      <div className="min-w-0">
                        <h3 className="break-words font-sans text-sm font-semibold text-text-primary">{row.index}. {row.name}</h3>
                        <p className="text-xs text-text-muted">
                          {row.duplicateOf !== null ? 'Repeated input from row ' + row.duplicateOf + '. Resolve or remove the duplicate.' :
                          exactCandidateCount(row.name, directory.nameIndex) === 1 ? 'One exact normalized candidate — still requires your confirmation.' :
                          exactCandidateCount(row.name, directory.nameIndex) > 1 ? 'Multiple exact candidates — verify the correct person.' :
                          'No exact member match; search manually or open Members.'}
                        </p>
                      </div>
                      <span className="rounded border border-border-strong px-2 py-1 text-xs font-semibold text-text-secondary">{readsPending || readsFailed ? 'Source verification unavailable' : STATUS_LABELS[status]}</span>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-2">
                        <label htmlFor={'member-search-' + row.index} className="block text-xs font-semibold text-text-secondary">Search canonical members (optional)</label>
                        <input id={'member-search-' + row.index} className={fieldCls} placeholder="Search name or variation…" value={memberSearch[row.index] ?? ''} onChange={(e) => setMemberSearch((prev) => ({ ...prev, [row.index]: e.target.value }))} />
                        <label htmlFor={'member-choice-' + row.index} className="block text-xs font-semibold text-text-secondary">Confirm canonical VSA member</label>
                        <select id={'member-choice-' + row.index} className={fieldCls} value={memberIds[row.index] ?? ''} disabled={readsPending || readsFailed} onChange={(e) => setMemberIds((prev) => ({ ...prev, [row.index]: e.target.value }))}>
                          <option value="">Unresolved — choose person</option>
                          {candidates.map((item) => <option value={item.id} key={item.id}>{item.displayName} · {item.id.slice(0, 8)}</option>)}
                        </select>
                        {candidates.length === 0 && <p className="text-xs text-text-muted">No displayed candidates. Try a shorter search or review the full Members directory.</p>}
                      </div>
                      <div className="space-y-2">
                        <label htmlFor={'source-search-' + row.index} className="block text-xs font-semibold text-text-secondary">Find published source position</label>
                        <input id={'source-search-' + row.index} className={fieldCls} placeholder="Search Cabinet name or position…" value={sourceSearch[row.index] ?? ''} onChange={(e) => setSourceSearch((prev) => ({ ...prev, [row.index]: e.target.value }))} />
                        <label htmlFor={'source-choice-' + row.index} className="block text-xs font-semibold text-text-secondary">Select existing {role === 'board' ? 'Board' : 'Intern'} record</label>
                        <select id={'source-choice-' + row.index} className={fieldCls} value={sourceIds[row.index] ?? ''} disabled={readsPending || readsFailed} onChange={(e) => setSourceIds((prev) => ({ ...prev, [row.index]: e.target.value }))}>
                          <option value="">Needs source selection</option>
                          {sourceChoices.map((item) => <option value={item.id} key={item.id}>{item.name} · {item.role} · {item.member_id ? 'Linked' : 'Unlinked'}</option>)}
                        </select>
                        {source && <p className="text-xs text-text-muted">Source: {source.role} · {source.category} · {source.member_id ? 'An existing member link must be checked' : 'Currently unlinked'}</p>}
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-3">
                      {source ? (
                        <Link className={actionCls} to={'/admin/cabinet?member=' + encodeURIComponent(source.id)}>
                          Open exact Cabinet record for final review
                        </Link>
                      ) : (
                        <Link className={actionCls} to={role === 'board' ? '/admin/cabinet/rollover' : '/admin/interns'}>
                          Open owning program editor
                        </Link>
                      )}
                      <Link to="/admin/merge-suggestions" className="text-xs font-semibold text-brand-600 underline dark:text-brand-400">Duplicate identity review</Link>
                    </div>
                    {status === 'ready' && <p className="mt-2 text-xs text-text-secondary">This preview is not a saved role. Verify the source in Cabinet and explicitly save its member link there.</p>}
                  </li>
                );
              })}
            </ol>
          </section>
        )}
        <p className="text-xs leading-relaxed text-text-muted">No database writes occur on this page. Only the existing Cabinet editor can change the canonical source link. Confirm published visibility and the leaderboard year after saving. Raw pasted names are not sent to audit logs or stored in the browser.</p>
      </div>
    </div>
  );
}
