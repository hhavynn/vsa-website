// Protected domain — House membership. The Legacy Backfill tab writes to
// house_memberships directly. House assignments are drafted, locked, and revealed
// through HouseDraftWorkflow, which writes only via houseMembershipWrites.
// Errors here directly alter member-to-House associations for the current year.
// Do not modify membership logic unless explicitly requested.
// Authority: AGENTS.md § "Things to never do"; vsa-change-control § 1 (Forbidden tier).
import { useEffect, useMemo, useState } from 'react';
import toast, { Toaster } from 'react-hot-toast';
import { Link } from 'react-router-dom';
import { PageTitle } from '../../components/common/PageTitle';
import { HouseEventsManager } from '../../components/features/admin/HouseEventsManager';
import { HouseImagesManager } from '../../components/features/admin/HouseImagesManager';
import { getVerifiedLegacyHouseYears } from '../../data/legacyHouseArchive';
import { useAcademicTerms } from '../../hooks/useAcademicTerms';
import { formatAcademicYear, getAcademicTermMeta } from '../../lib/academicTerms';
import { HouseDraftWorkflow } from '../../components/features/admin/HouseDraftWorkflow';
import {
  HouseImportMember,
  getMemberName,
  normalizeHouseLookup,
  profileMapByName,
} from '../../lib/houseAssignmentImport';
import { supabase } from '../../lib/supabase';
import { HousePageAsset } from '../../types';

type Member = HouseImportMember;

type AdminHouseTab = 'assignments' | 'backfill' | 'images' | 'events';

interface BackfillPreview {
  totalMembersWithHouse: number;
  detectedHouseNames: string[];
  toCreate: Array<{ memberId: string; memberName: string; house: string; profileId: string }>;
  skippedNoProfile: Array<{ memberId: string; memberName: string; house: string }>;
  skippedAlreadyHasMembership: Array<{ memberId: string; memberName: string; house: string }>;
}

function getCurrentAcademicYearStart() {
  return getAcademicTermMeta(new Date())?.academicYearStart ?? new Date().getFullYear();
}

function defaultAcademicYearStart(terms: ReturnType<typeof useAcademicTerms>['terms']) {
  // 1. Try active term
  const activeTerm = terms.find((term) => term.is_active);
  if (activeTerm) return activeTerm.academic_year_start;

  // 2. Try most recent term
  if (terms.length > 0) {
    return Math.max(...terms.map(t => t.academic_year_start));
  }

  // 3. Fallback to calendar year
  return getCurrentAcademicYearStart();
}

function buildAcademicYearOptions(terms: ReturnType<typeof useAcademicTerms>['terms']) {
  const years = new Map<number, { start: number; label: string; isActive: boolean }>();
  const currentYear = getCurrentAcademicYearStart();

  // 1. Add current year
  years.set(currentYear, {
    start: currentYear,
    label: formatAcademicYear(currentYear),
    isActive: false,
  });

  // 2. Add years from active terms
  terms.forEach((term) => {
    const existing = years.get(term.academic_year_start);
    years.set(term.academic_year_start, {
      start: term.academic_year_start,
      label: formatAcademicYear(term.academic_year_start),
      isActive: term.is_active || existing?.isActive || false,
    });
  });

  // 3. Add verified legacy years from static archive
  getVerifiedLegacyHouseYears().forEach((legacy) => {
    if (!years.has(legacy.startYear)) {
      years.set(legacy.startYear, {
        start: legacy.startYear,
        label: legacy.academicYear,
        isActive: false,
      });
    }
  });

  return Array.from(years.values()).sort((a, b) => b.start - a.start);
}

export default function AdminHouses() {
  const [activeTab, setActiveTab] = useState<AdminHouseTab>('assignments');
  const { terms } = useAcademicTerms();
  const [members, setMembers] = useState<Member[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(true);
  const [houseProfiles, setHouseProfiles] = useState<HousePageAsset[]>([]);
  const [loadingProfiles, setLoadingProfiles] = useState(true);
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [effectiveStartDate, setEffectiveStartDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [backfillPreview, setBackfillPreview] = useState<BackfillPreview | null>(null);
  const [backfillLoading, setBackfillLoading] = useState(false);
  const [backfillApplying, setBackfillApplying] = useState(false);
  const [backfillConfirmed, setBackfillConfirmed] = useState(false);
  const academicYearOptions = useMemo(() => buildAcademicYearOptions(terms), [terms]);

  useEffect(() => {
    if (selectedYear === null) setSelectedYear(defaultAcademicYearStart(terms));
  }, [selectedYear, terms]);

  useEffect(() => {
    if (selectedYear === 2025) {
      setEffectiveStartDate('2025-11-08');
    }
  }, [selectedYear]);

  async function loadMembers() {
    setLoadingMembers(true);
    const { data, error } = await supabase
      .from('members')
      .select('id, first_name, last_name, college, year, house, email, points, events_attended')
      .order('points', { ascending: false });

    if (error) {
      toast.error('Failed to load members.');
    } else {
      setMembers((data ?? []) as Member[]);
    }
    setLoadingMembers(false);
  }

  useEffect(() => { loadMembers(); }, []);

  async function loadHouseProfiles(year: number | null) {
    if (!year) {
      setHouseProfiles([]);
      setLoadingProfiles(false);
      return;
    }

    setLoadingProfiles(true);
    const { data, error } = await supabase
      .from('house_page_assets')
      .select('*')
      .eq('academic_year_start', year)
      .order('display_order', { ascending: true });

    if (error) {
      toast.error('Failed to load house profiles.');
      setHouseProfiles([]);
    } else {
      setHouseProfiles((data ?? []) as HousePageAsset[]);
    }
    setLoadingProfiles(false);
  }

  useEffect(() => { loadHouseProfiles(selectedYear); }, [selectedYear]);

  useEffect(() => {
    setBackfillPreview(null);
    setBackfillConfirmed(false);
  }, [selectedYear, effectiveStartDate]);

  const houseProfilesByName = useMemo(() => profileMapByName(houseProfiles), [houseProfiles]);

  async function handleBackfillPreview() {
    if (!selectedYear || !effectiveStartDate) {
      toast.error('Choose an academic year and effective start date.');
      return;
    }

    setBackfillLoading(true);
    setBackfillPreview(null);
    setBackfillConfirmed(false);

    try {
      const { data: existingMemberships, error: memError } = await supabase
        .from('house_memberships')
        .select('member_id')
        .eq('academic_year_start', selectedYear);
      if (memError) throw memError;

      const existingMemberIds = new Set((existingMemberships ?? []).map((m) => m.member_id as string));

      const membersWithHouse = members.filter((m) => m.house && m.house.trim());
      const detectedHouseNames = Array.from(new Set(membersWithHouse.map((m) => m.house!.trim()))).sort();

      const toCreate: BackfillPreview['toCreate'] = [];
      const skippedNoProfile: BackfillPreview['skippedNoProfile'] = [];
      const skippedAlreadyHasMembership: BackfillPreview['skippedAlreadyHasMembership'] = [];

      for (const member of membersWithHouse) {
        if (existingMemberIds.has(member.id)) {
          skippedAlreadyHasMembership.push({ memberId: member.id, memberName: getMemberName(member), house: member.house! });
          continue;
        }
        const profile = houseProfilesByName.get(normalizeHouseLookup(member.house!));
        if (!profile) {
          skippedNoProfile.push({ memberId: member.id, memberName: getMemberName(member), house: member.house! });
          continue;
        }
        toCreate.push({ memberId: member.id, memberName: getMemberName(member), house: member.house!, profileId: profile.id });
      }

      setBackfillPreview({ totalMembersWithHouse: membersWithHouse.length, detectedHouseNames, toCreate, skippedNoProfile, skippedAlreadyHasMembership });
    } catch (err) {
      console.error(err);
      toast.error('Failed to preview backfill.');
    } finally {
      setBackfillLoading(false);
    }
  }

  async function handleBackfillApply() {
    if (!backfillPreview || !selectedYear || !effectiveStartDate || !backfillConfirmed) return;
    if (backfillPreview.toCreate.length === 0) {
      toast.error('No memberships to create.');
      return;
    }

    setBackfillApplying(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id ?? null;

      const rows = backfillPreview.toCreate.map((item) => ({
        member_id: item.memberId,
        house_profile_id: item.profileId,
        academic_year_start: selectedYear,
        academic_year_end: selectedYear + 1,
        effective_start_date: effectiveStartDate,
        effective_end_date: null,
        source: 'legacy_members_house_backfill',
        notes: 'Backfilled from members.house after house membership history migration',
        created_by: userId,
        updated_by: userId,
      }));

      const BATCH_SIZE = 50;
      for (let i = 0; i < rows.length; i += BATCH_SIZE) {
        const { error } = await supabase.from('house_memberships').insert(rows.slice(i, i + BATCH_SIZE));
        if (error) throw error;
      }

      toast.success(`Created ${rows.length} house membership${rows.length !== 1 ? 's' : ''} from legacy data.`);
      setBackfillPreview(null);
      setBackfillConfirmed(false);
      await loadMembers();
      await loadHouseProfiles(selectedYear);
    } catch (err) {
      console.error(err);
      toast.error('Backfill failed. Check for overlapping memberships and try again.');
    } finally {
      setBackfillApplying(false);
    }
  }

  return (
    <>
      <PageTitle title="House Assignments" />
      <Toaster position="top-right" />

      <div className="border-b px-6 py-6 sm:flex sm:items-center sm:justify-between sm:gap-4 sm:px-8 sm:py-8" style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}>
        <div className="mb-4 sm:mb-0">
          <h1 className="font-serif text-3xl font-bold tracking-tight sm:text-4xl" style={{ color: 'var(--color-text)' }}>House Assignments</h1>
          <p className="mt-2 max-w-3xl font-sans text-sm leading-relaxed" style={{ color: 'var(--color-text2)' }}>
            Manage the selected academic year's House assignments, public House profiles/images, House parents, and House events. Assignments are drafted and locked privately, then revealed. They do not change attendance records or point calculations.
          </p>
          <div className="mt-3 flex flex-wrap gap-2 text-xs">
            <span className="rounded border px-2 py-1" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text3)' }}>
              Editing: {selectedYear ? formatAcademicYear(selectedYear) : 'choose a year'}
            </span>
            <Link to="/house" className="rounded border px-2 py-1 font-semibold text-[var(--brand)] hover:bg-[var(--color-surface2)]" style={{ borderColor: 'var(--color-border)' }}>
              View public Houses
            </Link>
            <Link to="/leaderboard?view=houses" className="rounded border px-2 py-1 font-semibold text-[var(--brand)] hover:bg-[var(--color-surface2)]" style={{ borderColor: 'var(--color-border)' }}>
              View standings
            </Link>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="inline-flex overflow-hidden rounded border" style={{ borderColor: 'var(--color-border)' }}>
            {([
              ['assignments', 'House Assignments'],
              ['backfill', 'Legacy Backfill'],
              ['images', 'Profiles & Images'],
              ['events', 'House Events'],
            ] as const).map(([tab, label], index) => (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                className="font-sans text-[13px] font-semibold transition-colors duration-150 sm:text-sm"
                style={{
                  padding: '8px 16px',
                  fontWeight: activeTab === tab ? 600 : 500,
                  background: activeTab === tab ? 'var(--color-surface2)' : 'transparent',
                  color: activeTab === tab ? 'var(--color-text)' : 'var(--color-text2)',
                  borderLeft: index > 0 ? '1px solid var(--color-border)' : 'none',
                }}
              >
                {label}
              </button>
            ))}
          </div>
          <Link to="/admin/members" className="rounded border bg-transparent px-4 py-2 text-[13px] font-semibold transition-colors hover:bg-[var(--color-surface2)]" style={{ color: 'var(--color-text2)', borderColor: 'var(--color-border)' }}>
            Members
          </Link>
        </div>
      </div>

      {activeTab === 'backfill' && (
        <div className="p-4 sm:p-6 lg:p-8">
          <div className="mx-auto max-w-2xl">
            <div className="scrapbook-paper p-6 sm:p-8" style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}>
              <h2 className="mb-2 font-serif text-xl font-bold" style={{ color: 'var(--color-text)' }}>Legacy Backfill from members.house</h2>
              <p className="mb-6 font-sans text-sm leading-relaxed" style={{ color: 'var(--color-text2)' }}>
                Advanced one-time cleanup: reads the old member House value and creates House memberships for people who do not yet have one for the selected year. House points only count for events on or after the effective start date.
              </p>

              <div className="mb-5 grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block font-mono text-[10px] font-bold uppercase tracking-[0.1em]" style={{ color: 'var(--color-text3)' }}>Academic Year</label>
                  <select
                    value={selectedYear ?? ''}
                    onChange={(e) => { setSelectedYear(Number(e.target.value)); }}
                    className="w-full rounded border bg-[var(--color-surface2)] px-3 py-2 text-sm text-[var(--color-text)] focus:border-[var(--brand)] focus:outline-none focus:ring-1 focus:ring-[var(--brand)]"
                    style={{ borderColor: 'var(--color-border)' }}
                  >
                    {academicYearOptions.map((year) => (
                      <option key={year.start} value={year.start}>{`${year.label}${year.isActive ? ' (Active)' : ''}`}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block font-mono text-[10px] font-bold uppercase tracking-[0.1em]" style={{ color: 'var(--color-text3)' }}>Effective Start Date</label>
                  <input
                    type="date"
                    value={effectiveStartDate}
                    onChange={(e) => setEffectiveStartDate(e.target.value)}
                    className="w-full rounded border bg-[var(--color-surface2)] px-3 py-2 text-sm text-[var(--color-text)] focus:border-[var(--brand)] focus:outline-none focus:ring-1 focus:ring-[var(--brand)]"
                    style={{ borderColor: 'var(--color-border)' }}
                  />
                  <p className="mt-1 font-sans text-[11px]" style={{ color: 'var(--color-text3)' }}>
                    For 2025–2026, the House Reveal date was 2025-11-08.
                  </p>
                </div>
              </div>

              <div className="mb-5 rounded border p-3 text-xs" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text2)', background: 'var(--color-surface2)' }}>
                {loadingProfiles
                  ? 'Loading house profiles...'
                  : houseProfiles.length === 0
                    ? `No House profiles found for ${selectedYear ? formatAcademicYear(selectedYear) : 'the selected year'}. Create profiles in Profiles & Images before backfilling.`
                    : `${houseProfiles.length} profile${houseProfiles.length !== 1 ? 's' : ''} for ${selectedYear ? formatAcademicYear(selectedYear) : 'this year'}: ${houseProfiles.map((p) => p.display_name || p.house_key || p.house).join(', ')}.`}
              </div>

              <button
                type="button"
                onClick={handleBackfillPreview}
                disabled={backfillLoading || backfillApplying || loadingMembers || loadingProfiles || !selectedYear || !effectiveStartDate || houseProfiles.length === 0}
                className="vsa-btn-primary mb-5 w-full py-3 text-xs disabled:opacity-50"
              >
                {backfillLoading ? 'Previewing...' : 'Preview Backfill'}
              </button>

              {backfillPreview && (
                <div>
                  <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                    {([
                      ['Members with house', backfillPreview.totalMembersWithHouse],
                      ['Will create', backfillPreview.toCreate.length],
                      ['Already assigned', backfillPreview.skippedAlreadyHasMembership.length],
                      ['No profile match', backfillPreview.skippedNoProfile.length],
                    ] as const).map(([label, value]) => (
                      <div key={label} className="scrapbook-note px-3 py-3">
                        <p className="mb-1 font-mono text-[10px] font-bold uppercase tracking-[0.1em]" style={{ color: 'var(--color-text3)' }}>{label}</p>
                        <p className="font-serif text-[26px] leading-none" style={{ color: 'var(--color-text)' }}>{value}</p>
                      </div>
                    ))}
                  </div>

                  {backfillPreview.detectedHouseNames.length > 0 && (
                    <p className="mb-4 font-sans text-xs" style={{ color: 'var(--color-text3)' }}>
                      Detected houses in members.house: {backfillPreview.detectedHouseNames.join(', ')}
                    </p>
                  )}

                  {backfillPreview.skippedNoProfile.length > 0 && (
                    <div className="mb-4 rounded border border-amber-300 bg-amber-50 p-3 text-xs dark:border-amber-800 dark:bg-amber-950/40">
                      <p className="mb-1 font-semibold text-amber-800 dark:text-amber-300">
                        {backfillPreview.skippedNoProfile.length} member{backfillPreview.skippedNoProfile.length !== 1 ? 's' : ''} skipped — no matching house profile:
                      </p>
                      <p className="font-mono text-amber-700 dark:text-amber-400">
                        {Array.from(new Set(backfillPreview.skippedNoProfile.map((s) => `"${s.house}"`))).join(', ')}
                      </p>
                    </div>
                  )}

                  {backfillPreview.toCreate.length > 0 ? (
                    <div className="mt-4">
                      <label className="flex cursor-pointer select-none items-start gap-2">
                        <input
                          type="checkbox"
                          checked={backfillConfirmed}
                          onChange={(e) => setBackfillConfirmed(e.target.checked)}
                          className="mt-0.5 cursor-pointer rounded border-[var(--color-border)] bg-transparent text-[var(--brand)] focus:ring-[var(--brand)]"
                        />
                        <span className="font-sans text-sm leading-relaxed" style={{ color: 'var(--color-text)' }}>
                          I confirm: create <strong>{backfillPreview.toCreate.length}</strong> house membership{backfillPreview.toCreate.length !== 1 ? 's' : ''} for {selectedYear ? formatAcademicYear(selectedYear) : 'this year'} starting <strong>{effectiveStartDate}</strong>. Events before this date will not count toward house points.
                        </span>
                      </label>

                      <button
                        type="button"
                        onClick={handleBackfillApply}
                        disabled={!backfillConfirmed || backfillApplying || backfillLoading}
                        className="mt-4 vsa-btn-primary w-full py-3 text-xs disabled:opacity-50"
                      >
                        {backfillApplying ? 'Running Backfill...' : `Run Backfill — Create ${backfillPreview.toCreate.length} Membership${backfillPreview.toCreate.length !== 1 ? 's' : ''}`}
                      </button>
                    </div>
                  ) : (
                    <div className="rounded border p-4 text-center text-xs" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text3)', background: 'var(--color-surface2)' }}>
                      Nothing to backfill — all members with house values are already assigned for {selectedYear ? formatAcademicYear(selectedYear) : 'this year'}.
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'assignments' ? (
        <HouseDraftWorkflow
          selectedYear={selectedYear}
          onYearChange={setSelectedYear}
          yearOptions={academicYearOptions}
          effectiveStartDate={effectiveStartDate}
          onEffectiveStartDateChange={setEffectiveStartDate}
          houseProfiles={houseProfiles}
          loadingProfiles={loadingProfiles}
          members={members}
          loadingMembers={loadingMembers}
          onMembershipsPublished={() => { loadMembers(); loadHouseProfiles(selectedYear); }}
        />
      ) : activeTab === 'images' ? (
        <HouseImagesManager 
          selectedYear={selectedYear} 
          onYearChange={setSelectedYear} 
        />
      ) : activeTab === 'events' ? (
        <HouseEventsManager 
          selectedYear={selectedYear} 
          onYearChange={setSelectedYear} 
        />
      ) : null}
    </>
  );
}
