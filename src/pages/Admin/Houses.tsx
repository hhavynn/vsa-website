import { useEffect, useMemo, useState } from 'react';
import toast, { Toaster } from 'react-hot-toast';
import { Link } from 'react-router-dom';
import { PageTitle } from '../../components/common/PageTitle';
import { HouseEventsManager } from '../../components/features/admin/HouseEventsManager';
import { HouseImagesManager } from '../../components/features/admin/HouseImagesManager';
import { HOUSE_LABELS, HouseName, normalizeHouse } from '../../constants/houses';
import { getVerifiedLegacyHouseYears } from '../../data/legacyHouseArchive';
import { useAcademicTerms } from '../../hooks/useAcademicTerms';
import { formatAcademicYear, getAcademicTermMeta } from '../../lib/academicTerms';
import {
  cleanNameForImport,
  detectColumn,
  displayNameFromHouseCell,
  nameSimilarity,
  normalizeEmail,
  parseCSV,
} from '../../lib/memberMatching';
import { supabase } from '../../lib/supabase';
import { HousePageAsset } from '../../types';

interface Member {
  id: string;
  first_name: string;
  last_name: string;
  college: string | null;
  year: string | null;
  house: string | null;
  email: string | null;
  points: number;
  events_attended: number;
}

type SheetFormat = 'wide' | 'long';
type RowStatus = 'match' | 'review' | 'unmatched' | 'invalid';
type AdminHouseTab = 'assignments' | 'backfill' | 'images' | 'events';

interface BackfillPreview {
  totalMembersWithHouse: number;
  detectedHouseNames: string[];
  toCreate: Array<{ memberId: string; memberName: string; house: string; profileId: string }>;
  skippedNoProfile: Array<{ memberId: string; memberName: string; house: string }>;
  skippedAlreadyHasMembership: Array<{ memberId: string; memberName: string; house: string }>;
}

interface ParsedHouseRow {
  rowId: string;
  sourceIndex: number;
  name: string;
  email: string;
  house: string | null;
  year: string;
  college: string;
  status: RowStatus;
  score: number;
  method: 'email' | 'name' | 'none';
  matchedMember: Member | null;
  selectedMemberId: string;
  selected: boolean;
  note: string;
  houseProfile: HousePageAsset | null;
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

function normalizeHouseLookup(value: string | null | undefined) {
  return (value ?? '')
    .toLowerCase()
    .replace(/^house\s+/, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function profileMapByName(profiles: HousePageAsset[]) {
  const map = new Map<string, HousePageAsset>();
  profiles.forEach((profile) => {
    [
      profile.house,
      profile.house_key,
      profile.display_name,
      HOUSE_LABELS[profile.house as HouseName],
    ].filter(Boolean).forEach((value) => map.set(normalizeHouseLookup(value), profile));
  });
  return map;
}


const EMPTY_SUMMARY = {
  match: 0,
  review: 0,
  unmatched: 0,
  invalid: 0,
  selected: 0,
};

function parseTable(raw: string): Record<string, string>[] {
  const trimmed = raw.trim();
  if (!trimmed) return [];
  const firstLine = trimmed.split(/\r?\n/)[0] ?? '';
  if (!firstLine.includes('\t')) return parseCSV(trimmed);

  const lines = trimmed.split(/\r?\n/).filter((line) => line.trim().length > 0);
  const headers = lines[0].split('\t').map((header) => header.trim());
  return lines.slice(1).map((line) => {
    const values = line.split('\t');
    const row: Record<string, string> = {};
    headers.forEach((header, index) => {
      row[header] = (values[index] ?? '').trim();
    });
    return row;
  });
}

function getMemberName(member: Member) {
  return `${member.first_name} ${member.last_name}`.trim();
}

function collegeKey(value: string | null | undefined) {
  const v = (value ?? '').toLowerCase();
  if (/revelle/.test(v)) return 'revelle';
  if (/muir/.test(v)) return 'muir';
  if (/marshall|thurgood/.test(v)) return 'marshall';
  if (/warren/.test(v)) return 'warren';
  if (/eleanor|erc|roosevelt/.test(v)) return 'erc';
  if (/sixth|6th/.test(v)) return 'sixth';
  if (/seventh|7th/.test(v)) return 'seventh';
  if (/eighth|8th/.test(v)) return 'eighth';
  return v.trim();
}

function buildLongName(row: Record<string, string>, fullNameCol: string, firstNameCol: string, lastNameCol: string) {
  if (fullNameCol) return cleanNameForImport(row[fullNameCol] ?? '');
  const first = row[firstNameCol] ?? '';
  const last = row[lastNameCol] ?? '';
  return cleanNameForImport(`${first} ${last}`);
}

function matchRow(
  row: Omit<ParsedHouseRow, 'status' | 'score' | 'method' | 'matchedMember' | 'selectedMemberId' | 'selected' | 'note' | 'houseProfile'>,
  members: Member[],
  emailMap: Map<string, Member>,
  houseProfilesByName: Map<string, HousePageAsset>,
  useContext: boolean,
): ParsedHouseRow {
  const houseProfile = row.house ? houseProfilesByName.get(normalizeHouseLookup(row.house)) ?? null : null;

  if (!row.house) {
    return {
      ...row,
      houseProfile: null,
      status: 'invalid',
      score: 0,
      method: 'none',
      matchedMember: null,
      selectedMemberId: '',
      selected: false,
      note: 'House is missing or not recognized.',
    };
  }

  if (!houseProfile) {
    return {
      ...row,
      houseProfile: null,
      status: 'invalid',
      score: 0,
      method: 'none',
      matchedMember: null,
      selectedMemberId: '',
      selected: false,
      note: 'No house profile exists for this academic year.',
    };
  }

  if (!row.name && !row.email) {
    return {
      ...row,
      houseProfile,
      status: 'invalid',
      score: 0,
      method: 'none',
      matchedMember: null,
      selectedMemberId: '',
      selected: false,
      note: 'Name or email is required.',
    };
  }

  if (row.email) {
    const emailMatch = emailMap.get(row.email);
    if (emailMatch) {
      return {
        ...row,
        houseProfile,
        status: 'match',
        score: 100,
        method: 'email',
        matchedMember: emailMatch,
        selectedMemberId: emailMatch.id,
        selected: true,
        note: 'Matched by normalized email.',
      };
    }
  }

  let best: Member | null = null;
  let bestScore = 0;

  for (const member of members) {
    const memberName = cleanNameForImport(getMemberName(member));
    let score = nameSimilarity(row.name, memberName);

    if (useContext && row.college && member.college && collegeKey(row.college) === collegeKey(member.college)) {
      score += 8;
    }
    if (useContext && row.year && member.year && row.year.toLowerCase() === member.year.toLowerCase()) {
      score += 8;
    }

    score = Math.min(score, 100);
    if (score > bestScore) {
      bestScore = score;
      best = member;
    }
  }

  if (best && bestScore >= 86) {
    return {
      ...row,
      houseProfile,
      status: 'match',
      score: bestScore,
      method: 'name',
      matchedMember: best,
      selectedMemberId: best.id,
      selected: true,
      note: 'Matched by name.',
    };
  }

  if (best && bestScore >= 70) {
    return {
      ...row,
      houseProfile,
      status: 'review',
      score: bestScore,
      method: 'name',
      matchedMember: best,
      selectedMemberId: best.id,
      selected: false,
      note: 'Possible name match. Review before applying.',
    };
  }

  return {
    ...row,
    houseProfile,
    status: 'unmatched',
    score: bestScore,
    method: 'none',
    matchedMember: best,
    selectedMemberId: '',
    selected: false,
    note: best ? 'Best name match was too weak.' : 'No possible match found.',
  };
}

function parseWideRows(raw: string, members: Member[], emailMap: Map<string, Member>, houseProfilesByName: Map<string, HousePageAsset>): ParsedHouseRow[] {
  const table = parseTable(raw);
  if (table.length === 0) return [];

  const headers = Object.keys(table[0]);
  const rows: ParsedHouseRow[] = [];

  table.forEach((csvRow, rowIndex) => {
    headers.forEach((header) => {
      const house = normalizeHouse(header);
      const dynamicHouse = house ?? (houseProfilesByName.has(normalizeHouseLookup(header)) ? header.trim() : null);
      if (!dynamicHouse) return;

      const rawCell = csvRow[header] ?? '';
      const name = displayNameFromHouseCell(rawCell);
      if (!name) return;

      rows.push(matchRow({
        rowId: `${rowIndex}-${header}-${name}`,
        sourceIndex: rowIndex + 1,
        name,
        email: '',
        house: dynamicHouse,
        year: '',
        college: '',
      }, members, emailMap, houseProfilesByName, false));
    });
  });

  return rows;
}

function parseLongRows(raw: string, members: Member[], emailMap: Map<string, Member>, houseProfilesByName: Map<string, HousePageAsset>): ParsedHouseRow[] {
  const table = parseTable(raw);
  if (table.length === 0) return [];

  const headers = Object.keys(table[0]);
  const fullNameCol = detectColumn(headers, ['full name', 'name', 'student name']);
  const firstNameCol = detectColumn(headers, ['first name', 'first', 'given name']);
  const lastNameCol = detectColumn(headers, ['last name', 'last', 'family', 'surname']);
  const emailCol = detectColumn(headers, ['email', 'school email', 'ucsd email']);
  const houseCol = detectColumn(headers, ['house']);
  const yearCol = detectColumn(headers, ['year', 'class standing', 'standing']);
  const collegeCol = detectColumn(headers, ['college', 'ucsd college']);

  return table.map((csvRow, rowIndex) => {
    const name = buildLongName(csvRow, fullNameCol, firstNameCol, lastNameCol);
    const email = normalizeEmail(emailCol ? csvRow[emailCol] : '');
    const rawHouse = houseCol ? (csvRow[houseCol] ?? '').trim() : '';
    const house = normalizeHouse(rawHouse) ?? (rawHouse ? rawHouse : null);
    const year = yearCol ? (csvRow[yearCol] ?? '').trim() : '';
    const college = collegeCol ? (csvRow[collegeCol] ?? '').trim() : '';

    return matchRow({
      rowId: `${rowIndex}-${email || name}`,
      sourceIndex: rowIndex + 1,
      name,
      email,
      house,
      year,
      college,
    }, members, emailMap, houseProfilesByName, true);
  });
}

function statusClass(status: RowStatus) {
  if (status === 'match') return 'text-emerald-700 dark:text-emerald-400';
  if (status === 'review') return 'text-amber-700 dark:text-amber-400';
  if (status === 'unmatched') return 'text-zinc-500 dark:text-zinc-400';
  return 'text-red-600 dark:text-red-400';
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
  const [csvUrl, setCsvUrl] = useState('');
  const [fetchingCsv, setFetchingCsv] = useState(false);
  const [rawInput, setRawInput] = useState('');
  const [format, setFormat] = useState<SheetFormat>('wide');
  const [rows, setRows] = useState<ParsedHouseRow[]>([]);
  const [parsing, setParsing] = useState(false);
  const [applying, setApplying] = useState(false);
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

  const emailMap = useMemo(() => {
    const map = new Map<string, Member>();
    members.forEach((member) => {
      const email = normalizeEmail(member.email);
      if (email && !map.has(email)) map.set(email, member);
    });
    return map;
  }, [members]);

  const houseProfilesByName = useMemo(() => profileMapByName(houseProfiles), [houseProfiles]);

  const summary = useMemo(() => {
    if (rows.length === 0) return EMPTY_SUMMARY;
    return rows.reduce((acc, row) => {
      acc[row.status] += 1;
      if (row.selected && row.selectedMemberId && row.house) acc.selected += 1;
      return acc;
    }, { ...EMPTY_SUMMARY });
  }, [rows]);

  function handleParse() {
    setParsing(true);
    try {
      const parsed = format === 'wide'
        ? parseWideRows(rawInput, members, emailMap, houseProfilesByName)
        : parseLongRows(rawInput, members, emailMap, houseProfilesByName);
      setRows(parsed);
      if (parsed.length === 0) toast.error('No assignment rows were parsed.');
    } catch (err) {
      console.error(err);
      toast.error('Failed to parse house assignment sheet.');
    } finally {
      setParsing(false);
    }
  }

  async function handleFetchCsv() {
    if (!csvUrl.trim()) {
      toast.error('Enter a CSV URL first.');
      return;
    }

    setFetchingCsv(true);
    try {
      const response = await fetch(csvUrl.trim());
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      setRawInput(await response.text());
      toast.success('CSV loaded.');
    } catch (err) {
      console.error(err);
      toast.error('Failed to load CSV URL. Make sure it is publicly accessible.');
    } finally {
      setFetchingCsv(false);
    }
  }

  function updateRow(rowId: string, updater: (row: ParsedHouseRow) => ParsedHouseRow) {
    setRows((current) => current.map((row) => row.rowId === rowId ? updater(row) : row));
  }

  function setManualMember(rowId: string, memberId: string) {
    const member = members.find((item) => item.id === memberId) ?? null;
    updateRow(rowId, (row) => ({
      ...row,
      selectedMemberId: memberId,
      matchedMember: member,
      status: member ? 'match' : row.status,
      selected: !!member,
      note: member ? 'Manually selected by admin.' : row.note,
    }));
  }

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

  async function handleApply() {
    const selectedRows = rows.filter((row) => row.selected && row.selectedMemberId && row.house);
    if (selectedRows.length === 0) {
      toast.error('Select at least one matched row to apply.');
      return;
    }

    const selectedByMember = new Map<string, ParsedHouseRow[]>();
    selectedRows.forEach((row) => {
      selectedByMember.set(row.selectedMemberId, [...(selectedByMember.get(row.selectedMemberId) ?? []), row]);
    });
    const conflictingMember = Array.from(selectedByMember.values()).find((memberRows) => {
      const houses = new Set(memberRows.map((row) => row.house));
      return houses.size > 1;
    });
    if (conflictingMember) {
      toast.error(`Resolve duplicate assignments for ${conflictingMember[0].matchedMember ? getMemberName(conflictingMember[0].matchedMember) : conflictingMember[0].name}.`);
      return;
    }

    setApplying(true);
    try {
      if (!selectedYear || !effectiveStartDate) {
        toast.error('Choose an academic year and effective start date.');
        return;
      }

      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id ?? null;
      const startedAt = effectiveStartDate;

      for (const row of selectedRows) {
        if (!row.houseProfile || !selectedYear) continue;

        const { data: existingMemberships, error: existingError } = await supabase
          .from('house_memberships')
          .select('id, house_profile_id, effective_start_date')
          .eq('member_id', row.selectedMemberId)
          .eq('academic_year_start', selectedYear)
          .is('effective_end_date', null)
          .gte('effective_start_date', startedAt);
        if (existingError) throw existingError;

        const sameStartingMembership = (existingMemberships ?? []).find((membership) => membership.effective_start_date === startedAt);
        if (sameStartingMembership?.house_profile_id === row.houseProfile.id) {
          continue;
        }
        if (sameStartingMembership) {
          throw new Error(`Existing active membership starts on ${startedAt} for ${row.matchedMember ? getMemberName(row.matchedMember) : row.name}. Resolve manually before re-importing.`);
        }
        const nextMembershipStart = (existingMemberships ?? [])
          .map((membership) => membership.effective_start_date)
          .filter((date) => date > startedAt)
          .sort()[0] ?? null;

        const { error: closeError } = await supabase
          .from('house_memberships')
          .update({
            effective_end_date: startedAt,
            updated_by: userId,
            updated_at: new Date().toISOString(),
          })
          .eq('member_id', row.selectedMemberId)
          .eq('academic_year_start', selectedYear)
          .is('effective_end_date', null)
          .lt('effective_start_date', startedAt);
        if (closeError) throw closeError;

        const { error: insertError } = await supabase
          .from('house_memberships')
          .insert({
            member_id: row.selectedMemberId,
            house_profile_id: row.houseProfile.id,
            academic_year_start: selectedYear,
            academic_year_end: selectedYear + 1,
            effective_start_date: startedAt,
            effective_end_date: nextMembershipStart,
            source: csvUrl.trim() ? 'house_csv_url' : 'house_csv_paste',
            notes: `Imported from admin House assignment sheet row ${row.sourceIndex}.`,
            created_by: userId,
            updated_by: userId,
          });
        if (insertError) throw insertError;

        const { error: cacheError } = await supabase
          .from('members')
          .update({ house: row.houseProfile.house_key ?? row.house, updated_at: new Date().toISOString() })
          .eq('id', row.selectedMemberId);
        if (cacheError) throw cacheError;
      }

      toast.success(`Applied ${selectedRows.length} house assignment${selectedRows.length !== 1 ? 's' : ''}.`);
      await loadMembers();
      await loadHouseProfiles(selectedYear);
      setRows((current) => current.map((row) => row.selected ? { ...row, selected: false } : row));
    } catch (err) {
      console.error(err);
      toast.error('Failed to apply house assignments.');
    } finally {
      setApplying(false);
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
            Manage the selected academic year's House assignments, public House profiles/images, House parents, and House events. Assignment imports do not change attendance records or point calculations.
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
                    onChange={(e) => { setSelectedYear(Number(e.target.value)); setRows([]); }}
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
      <div className="grid gap-6 p-4 sm:p-6 lg:p-8 xl:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
        <div className="scrapbook-paper p-6 sm:p-8" style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}>
          <div className="mb-6">
            <h2 className="font-serif text-xl font-bold" style={{ color: 'var(--color-text)' }}>Import Sheet</h2>
            <p className="mt-2 font-sans text-sm leading-relaxed" style={{ color: 'var(--color-text2)' }}>
              Memberships start on the effective date. Earlier event attendance keeps individual points but does not earn house points.
            </p>
            <p className="mt-2 font-sans text-xs leading-relaxed" style={{ color: 'var(--color-text3)' }}>
              Selected year: {selectedYear ? formatAcademicYear(selectedYear) : 'choose a year'}. Applied memberships affect House pages and standings for this year only.
            </p>
          </div>

          <div className="mb-5 grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block font-mono text-[10px] font-bold uppercase tracking-[0.1em]" style={{ color: 'var(--color-text3)' }}>Academic Year</label>
              <select
                value={selectedYear ?? ''}
                onChange={(event) => { setSelectedYear(Number(event.target.value)); setRows([]); }}
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
                onChange={(event) => { setEffectiveStartDate(event.target.value); setRows([]); }}
                className="w-full rounded border bg-[var(--color-surface2)] px-3 py-2 text-sm text-[var(--color-text)] focus:border-[var(--brand)] focus:outline-none focus:ring-1 focus:ring-[var(--brand)]"
                style={{ borderColor: 'var(--color-border)' }}
              />
            </div>
          </div>

          <div className="mb-5 rounded border p-3 text-xs" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text2)', background: 'var(--color-surface2)' }}>
            {loadingProfiles ? 'Loading house profiles...' : `${houseProfiles.length} house profile${houseProfiles.length !== 1 ? 's' : ''} found for ${selectedYear ? formatAcademicYear(selectedYear) : 'the selected year'}. Create profiles in Profiles & Images before importing memberships.`}
          </div>

          <label className="mb-1 block font-mono text-[10px] font-bold uppercase tracking-[0.1em]" style={{ color: 'var(--color-text3)' }}>Sheet Format</label>
          <select
            value={format}
            onChange={(event) => { setFormat(event.target.value as SheetFormat); setRows([]); }}
            className="mb-5 w-full rounded border bg-[var(--color-surface2)] px-3 py-2 text-sm text-[var(--color-text)] focus:border-[var(--brand)] focus:outline-none focus:ring-1 focus:ring-[var(--brand)]"
            style={{ borderColor: 'var(--color-border)' }}
          >
            <option value="wide">Wide House sorting sheet</option>
            <option value="long">Long CSV with name/email/house</option>
          </select>

          <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--color-text3)' }}>Public CSV URL</label>
          <div className="mb-5 flex gap-2">
            <input
              type="url"
              value={csvUrl}
              onChange={(event) => setCsvUrl(event.target.value)}
              placeholder="https://docs.google.com/spreadsheets/.../pub?output=csv"
              className="min-w-0 flex-1 rounded border px-3 py-2 text-xs"
              style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface2)', color: 'var(--color-text)' }}
            />
            <button
              type="button"
              onClick={handleFetchCsv}
              disabled={fetchingCsv || !csvUrl.trim()}
              className="rounded border px-3 py-2 text-xs font-semibold disabled:opacity-50"
              style={{ borderColor: 'var(--color-border)', color: 'var(--color-text2)' }}
            >
              {fetchingCsv ? 'Loading...' : 'Load'}
            </button>
          </div>

          <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--color-text3)' }}>CSV or Pasted Sheet</label>
          <textarea
            value={rawInput}
            onChange={(event) => setRawInput(event.target.value)}
            rows={14}
            placeholder={format === 'wide'
              ? 'Bowser,Toad,Donkey Kong,Boo\nAi E Phan (first) (2025-10-15 20:55:54),Adriel Luis Abaoag (second) - Sat 10/18/2025 14:37:49,,Alyssa, Nott (first) (2025-10-15 21:05:46)'
              : 'name,email,house,year,college\nAi E Phan,aiphan@ucsd.edu,Bowser,Second Year,Muir'}
            className="w-full rounded border px-3 py-2 font-mono text-xs"
            style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface2)', color: 'var(--color-text)' }}
          />

          <div className="mt-4 flex gap-3">
            <button
              type="button"
              onClick={handleParse}
              disabled={loadingMembers || loadingProfiles || parsing || !rawInput.trim() || !selectedYear || !effectiveStartDate}
              className="vsa-btn-primary flex-1 py-3 text-xs disabled:opacity-50"
            >
              {parsing ? 'Parsing...' : 'Preview Assignments'}
            </button>
            <button
              type="button"
              onClick={() => { setRawInput(''); setRows([]); }}
              className="rounded border bg-transparent px-5 py-3 text-xs font-semibold transition-colors hover:bg-[var(--color-surface2)]"
              style={{ borderColor: 'var(--color-border)', color: 'var(--color-text2)' }}
            >
              Clear
            </button>
          </div>
        </div>

        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-5 lg:gap-6">
            {[
              ['Auto Matches', summary.match],
              ['Needs Review', summary.review],
              ['Unmatched', summary.unmatched],
              ['Invalid', summary.invalid],
              ['Selected', summary.selected],
            ].map(([label, value]) => (
              <div key={label} className="scrapbook-note flex flex-col justify-center px-4 py-4">
                <p className="mb-2 font-mono text-[10px] font-bold uppercase tracking-[0.1em]" style={{ color: 'var(--color-text3)' }}>{label}</p>
                <p className="font-serif text-[32px] leading-none" style={{ color: 'var(--color-text)' }}>{value}</p>
              </div>
            ))}
          </div>

          <div className="scrapbook-paper overflow-hidden" style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}>
            <div className="flex flex-col gap-3 border-b px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:px-6 sm:py-5" style={{ borderColor: 'var(--color-border)' }}>
              <div>
                <h2 className="font-serif text-xl font-bold" style={{ color: 'var(--color-text)' }}>Preview</h2>
                <p className="mt-1 font-sans text-xs" style={{ color: 'var(--color-text3)' }}>Only selected rows create dated memberships. Points and attendance stay untouched.</p>
              </div>
              <button
                type="button"
                onClick={handleApply}
                disabled={applying || summary.selected === 0 || !selectedYear || !effectiveStartDate}
                className="vsa-btn-primary w-full py-2.5 text-xs disabled:opacity-50 sm:w-auto sm:px-6"
              >
                {applying ? 'Applying...' : `Apply ${summary.selected}`}
              </button>
            </div>

            {rows.length === 0 ? (
              <div className="px-5 py-16 text-center text-sm" style={{ color: 'var(--color-text3)' }}>
                Paste a sheet and preview assignments.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-[800px] w-full text-sm">
                  <thead>
                    <tr className="border-b bg-[var(--color-surface2)]" style={{ borderColor: 'var(--color-border)' }}>
                      {['Apply', 'Parsed Name', 'House Profile', 'Match', 'Confidence', 'Resolve'].map((heading) => (
                        <th key={heading} className="px-4 py-3 text-left font-mono text-[10px] font-bold uppercase tracking-[0.1em]" style={{ color: 'var(--color-text3)' }}>{heading}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y bg-[var(--color-surface)]" style={{ borderColor: 'var(--color-border)' }}>
                    {rows.map((row) => (
                      <tr key={row.rowId} className="transition-colors hover:bg-[var(--color-surface2)]">
                        <td className="px-4 py-3">
                          <input
                            type="checkbox"
                            checked={row.selected}
                            disabled={!row.houseProfile || (!row.selectedMemberId && row.status !== 'match')}
                            onChange={() => updateRow(row.rowId, (current) => ({ ...current, selected: !current.selected }))}
                            className="cursor-pointer rounded border-[var(--color-border)] bg-transparent text-[var(--brand)] focus:ring-[var(--brand)]"
                            aria-label={`Apply ${row.name}`}
                          />
                        </td>
                        <td className="px-4 py-3">
                          <p className="font-sans text-[13px] font-semibold" style={{ color: 'var(--color-text)' }}>{row.name || '-'}</p>
                          {row.email && <p className="mt-0.5 text-[11px]" style={{ color: 'var(--color-text3)' }}>{row.email}</p>}
                        </td>
                        <td className="px-4 py-3">
                          {row.houseProfile ? (
                            <span className="inline-flex items-center rounded border px-1.5 py-0.5 font-mono text-[10px] text-[var(--color-text2)]" style={{ borderColor: 'var(--color-border)' }}>
                              {row.houseProfile.display_name ?? HOUSE_LABELS[row.house as HouseName] ?? row.house}
                            </span>
                          ) : (
                            <span className="text-red-500">Unknown</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <p className={`font-mono text-[11px] font-bold uppercase ${statusClass(row.status)}`}>{row.status}</p>
                          <p className="mt-1 text-[11px]" style={{ color: 'var(--color-text3)' }}>{row.note}</p>
                        </td>
                        <td className="px-4 py-3 font-mono text-xs" style={{ color: 'var(--color-text2)' }}>
                          {row.method === 'none' ? '-' : `${row.score}% ${row.method}`}
                        </td>
                        <td className="px-4 py-3">
                          <select
                            value={row.selectedMemberId}
                            onChange={(event) => setManualMember(row.rowId, event.target.value)}
                            className="w-full min-w-[200px] rounded border bg-[var(--color-surface2)] px-2 py-1.5 text-xs text-[var(--color-text)] focus:border-[var(--brand)] focus:outline-none focus:ring-1 focus:ring-[var(--brand)]"
                            style={{ borderColor: 'var(--color-border)' }}
                          >
                            <option value="">Skip / unresolved</option>
                            {row.matchedMember && (
                              <option value={row.matchedMember.id}>
                                {getMemberName(row.matchedMember)} ({row.matchedMember.points} pts)
                              </option>
                            )}
                            {members
                              .filter((member) => member.id !== row.matchedMember?.id)
                              .slice(0, 200)
                              .map((member) => (
                                <option key={member.id} value={member.id}>
                                  {getMemberName(member)} {member.email ? `- ${member.email}` : ''}
                                </option>
                              ))}
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
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
