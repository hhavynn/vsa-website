import { useEffect, useMemo, useState } from 'react';
import toast, { Toaster } from 'react-hot-toast';
import { Link } from 'react-router-dom';
import { PageTitle } from '../../components/common/PageTitle';
import { HouseImagesManager } from '../../components/features/admin/HouseImagesManager';
import { HOUSE_LABELS, HouseName, normalizeHouse } from '../../constants/houses';
import {
  cleanNameForImport,
  detectColumn,
  displayNameFromHouseCell,
  nameSimilarity,
  normalizeEmail,
  parseCSV,
} from '../../lib/memberMatching';
import { supabase } from '../../lib/supabase';

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
type AdminHouseTab = 'assignments' | 'images';

interface ParsedHouseRow {
  rowId: string;
  sourceIndex: number;
  name: string;
  email: string;
  house: HouseName | null;
  year: string;
  college: string;
  status: RowStatus;
  score: number;
  method: 'email' | 'name' | 'none';
  matchedMember: Member | null;
  selectedMemberId: string;
  selected: boolean;
  note: string;
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
  row: Omit<ParsedHouseRow, 'status' | 'score' | 'method' | 'matchedMember' | 'selectedMemberId' | 'selected' | 'note'>,
  members: Member[],
  emailMap: Map<string, Member>,
  useContext: boolean,
): ParsedHouseRow {
  if (!row.house) {
    return {
      ...row,
      status: 'invalid',
      score: 0,
      method: 'none',
      matchedMember: null,
      selectedMemberId: '',
      selected: false,
      note: 'House is missing or not recognized.',
    };
  }

  if (!row.name && !row.email) {
    return {
      ...row,
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
    status: 'unmatched',
    score: bestScore,
    method: 'none',
    matchedMember: best,
    selectedMemberId: '',
    selected: false,
    note: best ? 'Best name match was too weak.' : 'No possible match found.',
  };
}

function parseWideRows(raw: string, members: Member[], emailMap: Map<string, Member>): ParsedHouseRow[] {
  const table = parseTable(raw);
  if (table.length === 0) return [];

  const headers = Object.keys(table[0]);
  const rows: ParsedHouseRow[] = [];

  table.forEach((csvRow, rowIndex) => {
    headers.forEach((header) => {
      const house = normalizeHouse(header);
      if (!house) return;

      const rawCell = csvRow[header] ?? '';
      const name = displayNameFromHouseCell(rawCell);
      if (!name) return;

      rows.push(matchRow({
        rowId: `${rowIndex}-${header}-${name}`,
        sourceIndex: rowIndex + 1,
        name,
        email: '',
        house,
        year: '',
        college: '',
      }, members, emailMap, false));
    });
  });

  return rows;
}

function parseLongRows(raw: string, members: Member[], emailMap: Map<string, Member>): ParsedHouseRow[] {
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
    const house = normalizeHouse(houseCol ? csvRow[houseCol] : '');
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
    }, members, emailMap, true);
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
  const [members, setMembers] = useState<Member[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(true);
  const [rawInput, setRawInput] = useState('');
  const [format, setFormat] = useState<SheetFormat>('wide');
  const [rows, setRows] = useState<ParsedHouseRow[]>([]);
  const [parsing, setParsing] = useState(false);
  const [applying, setApplying] = useState(false);

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

  const emailMap = useMemo(() => {
    const map = new Map<string, Member>();
    members.forEach((member) => {
      const email = normalizeEmail(member.email);
      if (email && !map.has(email)) map.set(email, member);
    });
    return map;
  }, [members]);

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
        ? parseWideRows(rawInput, members, emailMap)
        : parseLongRows(rawInput, members, emailMap);
      setRows(parsed);
      if (parsed.length === 0) toast.error('No assignment rows were parsed.');
    } catch (err) {
      console.error(err);
      toast.error('Failed to parse house assignment sheet.');
    } finally {
      setParsing(false);
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
      for (const row of selectedRows) {
        const { error } = await supabase
          .from('members')
          .update({ house: row.house, updated_at: new Date().toISOString() })
          .eq('id', row.selectedMemberId);
        if (error) throw error;
      }

      toast.success(`Applied ${selectedRows.length} house assignment${selectedRows.length !== 1 ? 's' : ''}.`);
      await loadMembers();
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

      <div className="border-b flex items-center justify-between" style={{ padding: '20px 28px 16px', borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}>
        <div>
          <h1 className="font-sans font-semibold text-base tracking-[-0.01em]" style={{ color: 'var(--color-text)' }}>House Assignments</h1>
          <p className="font-sans text-xs mt-0.5" style={{ color: 'var(--color-text2)' }}>Import House Reveal assignments without changing attendance or points.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="inline-flex overflow-hidden rounded border" style={{ borderColor: 'var(--color-border)' }}>
            {([
              ['assignments', 'Assignment Import'],
              ['images', 'House Page Images'],
            ] as const).map(([tab, label], index) => (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                className="font-sans text-xs transition-colors duration-150"
                style={{
                  padding: '7px 14px',
                  fontWeight: activeTab === tab ? 600 : 400,
                  background: activeTab === tab ? 'var(--color-surface2)' : 'transparent',
                  color: activeTab === tab ? 'var(--color-text)' : 'var(--color-text2)',
                  borderLeft: index > 0 ? '1px solid var(--color-border)' : 'none',
                }}
              >
                {label}
              </button>
            ))}
          </div>
          <Link to="/admin/members" className="font-sans text-xs font-medium border rounded px-3 py-1.5 transition-colors" style={{ color: 'var(--color-text2)', borderColor: 'var(--color-border)' }}>
            Members
          </Link>
        </div>
      </div>

      {activeTab === 'assignments' ? (
      <div className="grid gap-6 xl:grid-cols-[minmax(0,420px)_minmax(0,1fr)]" style={{ padding: '20px 28px' }}>
        <div className="rounded-md border p-5" style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}>
          <div className="mb-5">
            <h2 className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>Import Sheet</h2>
            <p className="mt-1 text-xs leading-relaxed" style={{ color: 'var(--color-text2)' }}>
              Wide sheets use house column headers. Preference labels like (first) and timestamps are stripped from names and never stored as class year.
            </p>
          </div>

          <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--color-text3)' }}>Sheet Format</label>
          <select
            value={format}
            onChange={(event) => { setFormat(event.target.value as SheetFormat); setRows([]); }}
            className="mb-4 w-full rounded border px-3 py-2 text-sm"
            style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text)' }}
          >
            <option value="wide">Wide House sorting sheet</option>
            <option value="long">Long CSV with name/email/house</option>
          </select>

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
              disabled={loadingMembers || parsing || !rawInput.trim()}
              className="flex-1 rounded bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-indigo-700 disabled:opacity-40"
            >
              {parsing ? 'Parsing...' : 'Preview Assignments'}
            </button>
            <button
              type="button"
              onClick={() => { setRawInput(''); setRows([]); }}
              className="rounded border px-4 py-2.5 text-sm font-medium"
              style={{ borderColor: 'var(--color-border)', color: 'var(--color-text2)' }}
            >
              Clear
            </button>
          </div>
        </div>

        <div className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-5">
            {[
              ['Auto Matches', summary.match],
              ['Needs Review', summary.review],
              ['Unmatched', summary.unmatched],
              ['Invalid', summary.invalid],
              ['Selected', summary.selected],
            ].map(([label, value]) => (
              <div key={label} className="rounded-md border px-4 py-3" style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}>
                <p className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: 'var(--color-text3)' }}>{label}</p>
                <p className="mt-1 font-serif text-2xl leading-none" style={{ color: 'var(--color-text)' }}>{value}</p>
              </div>
            ))}
          </div>

          <div className="rounded-md border" style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}>
            <div className="flex items-center justify-between gap-4 border-b px-5 py-4" style={{ borderColor: 'var(--color-border)' }}>
              <div>
                <h2 className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>Preview</h2>
                <p className="mt-0.5 text-xs" style={{ color: 'var(--color-text3)' }}>Only selected rows update member.house. Points and attendance stay untouched.</p>
              </div>
              <button
                type="button"
                onClick={handleApply}
                disabled={applying || summary.selected === 0}
                className="rounded bg-indigo-600 px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-indigo-700 disabled:opacity-40"
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
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b" style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface2)' }}>
                      {['Apply', 'Parsed Name', 'House', 'Match', 'Confidence', 'Resolve'].map((heading) => (
                        <th key={heading} className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--color-text3)' }}>{heading}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y" style={{ borderColor: 'var(--color-border)' }}>
                    {rows.map((row) => (
                      <tr key={row.rowId}>
                        <td className="px-4 py-3">
                          <input
                            type="checkbox"
                            checked={row.selected}
                            disabled={!row.house || (!row.selectedMemberId && row.status !== 'match')}
                            onChange={() => updateRow(row.rowId, (current) => ({ ...current, selected: !current.selected }))}
                            className="rounded"
                            aria-label={`Apply ${row.name}`}
                          />
                        </td>
                        <td className="px-4 py-3">
                          <p className="font-medium" style={{ color: 'var(--color-text)' }}>{row.name || '-'}</p>
                          {row.email && <p className="mt-0.5 text-[11px]" style={{ color: 'var(--color-text3)' }}>{row.email}</p>}
                        </td>
                        <td className="px-4 py-3">
                          {row.house ? HOUSE_LABELS[row.house] : <span className="text-red-500">Unknown</span>}
                        </td>
                        <td className="px-4 py-3">
                          <p className={`font-medium ${statusClass(row.status)}`}>{row.status}</p>
                          <p className="mt-0.5 text-[11px]" style={{ color: 'var(--color-text3)' }}>{row.note}</p>
                        </td>
                        <td className="px-4 py-3 font-mono text-xs" style={{ color: 'var(--color-text2)' }}>
                          {row.method === 'none' ? '-' : `${row.score}% ${row.method}`}
                        </td>
                        <td className="px-4 py-3">
                          <select
                            value={row.selectedMemberId}
                            onChange={(event) => setManualMember(row.rowId, event.target.value)}
                            className="w-64 rounded border px-2 py-1.5 text-xs"
                            style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text)' }}
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
      ) : (
        <HouseImagesManager />
      )}
    </>
  );
}
