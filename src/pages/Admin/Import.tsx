import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { AdminNav } from '../../components/features/admin/AdminNav';
import toast, { Toaster } from 'react-hot-toast';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Event {
  id: string;
  name: string;
  date: string;
  points: number;
}

interface UserProfile {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  college: string | null;
  year: string | null;
}

type MatchStatus = 'high' | 'fuzzy' | 'none' | 'already';

interface RowResult {
  csvRow: Record<string, string>;
  displayName: string;
  csvCollege: string;
  csvYear: string;
  matchedUser: UserProfile | null;
  status: MatchStatus;
  score: number; // composite 0–100
  nameScore: number;
  collegeMatch: boolean;
  yearMatch: boolean;
}

// ─── Normalization helpers ────────────────────────────────────────────────────

// Map messy college strings → canonical short key
const COLLEGE_ALIASES: [RegExp, string][] = [
  [/revelle/i,                       'revelle'],
  [/muir/i,                          'muir'],
  [/marshall|thurgood/i,             'marshall'],
  [/eleanor|erc|roosevelt.*college/i,'erc'],
  [/sixth|6th/i,                     'sixth'],
  [/seventh|7th/i,                   'seventh'],
  [/eighth|8th/i,                    'eighth'],
];

function normalizeCollege(s: string): string {
  if (!s) return '';
  for (const [re, key] of COLLEGE_ALIASES) {
    if (re.test(s)) return key;
  }
  return s.toLowerCase().trim();
}

// Map messy year strings → canonical key
const YEAR_ALIASES: [RegExp, string][] = [
  [/1st|first|fresh/i,    '1'],
  [/2nd|second|soph/i,    '2'],
  [/3rd|third|junior/i,   '3'],
  [/4th|fourth|senior/i,  '4'],
  [/5th|fifth/i,          '5'],
  [/transfer/i,           'transfer'],
];

function normalizeYear(s: string): string {
  if (!s) return '';
  for (const [re, key] of YEAR_ALIASES) {
    if (re.test(s)) return key;
  }
  return s.toLowerCase().trim();
}

// ─── Fuzzy name similarity ────────────────────────────────────────────────────

function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  );
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = a[i-1] === b[j-1]
        ? dp[i-1][j-1]
        : 1 + Math.min(dp[i-1][j], dp[i][j-1], dp[i-1][j-1]);
  return dp[m][n];
}

function nameSimilarity(a: string, b: string): number {
  const na = a.toLowerCase().trim();
  const nb = b.toLowerCase().trim();
  if (!na || !nb) return 0;
  if (na === nb) return 100;
  const dist = levenshtein(na, nb);
  return Math.round((1 - dist / Math.max(na.length, nb.length)) * 100);
}

// ─── Composite score ──────────────────────────────────────────────────────────
// Weights: name 60%, college 25%, year 15%

function compositeScore(nameScore: number, collegeMatch: boolean, yearMatch: boolean): number {
  return Math.round(nameScore * 0.6 + (collegeMatch ? 25 : 0) + (yearMatch ? 15 : 0));
}

// ─── CSV parser ───────────────────────────────────────────────────────────────

function parseCSV(raw: string): Record<string, string>[] {
  const lines = raw.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const headers = splitCSVRow(lines[0]);
  return lines.slice(1).map((line) => {
    const vals = splitCSVRow(line);
    const row: Record<string, string> = {};
    headers.forEach((h, i) => { row[h.trim()] = (vals[i] ?? '').trim(); });
    return row;
  });
}

function splitCSVRow(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (const ch of line) {
    if (ch === '"') { inQuotes = !inQuotes; }
    else if (ch === ',' && !inQuotes) { result.push(current); current = ''; }
    else { current += ch; }
  }
  result.push(current);
  return result;
}

// ─── Auto-detect columns ──────────────────────────────────────────────────────

function detectColumn(headers: string[], hints: string[]): string {
  const h = hints.map(x => x.toLowerCase());
  return headers.find(col => h.some(hint => col.toLowerCase().includes(hint))) ?? '';
}

// ─── Main component ───────────────────────────────────────────────────────────

type Step = 'configure' | 'preview' | 'done';

export default function AdminImport() {
  const [step, setStep] = useState<Step>('configure');

  // Configure
  const [events, setEvents] = useState<Event[]>([]);
  const [selectedEventId, setSelectedEventId] = useState('');
  const [csvUrl, setCsvUrl] = useState('');
  const [fetchingCsv, setFetchingCsv] = useState(false);
  const [configError, setConfigError] = useState('');

  // Column mapping
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [firstNameCol, setFirstNameCol] = useState('');
  const [lastNameCol, setLastNameCol] = useState('');
  const [fullNameCol, setFullNameCol] = useState('');
  const [useFullName, setUseFullName] = useState(false);
  const [collegeCol, setCollegeCol] = useState('');
  const [yearCol, setYearCol] = useState('');

  // Preview
  const [rows, setRows] = useState<RowResult[]>([]);
  const [importing, setImporting] = useState(false);

  // Cached CSV for re-matching
  const [cachedParsed, setCachedParsed] = useState<Record<string, string>[]>([]);

  useEffect(() => {
    supabase
      .from('events')
      .select('id, name, date, points')
      .order('date', { ascending: false })
      .then(({ data }) => setEvents((data ?? []) as Event[]));
  }, []);

  // ── Normalize a Google Sheets URL to CSV export URL ──
  function toCSVUrl(raw: string): string {
    const url = raw.trim();
    if (url.includes('docs.google.com/spreadsheets') && !url.includes('output=csv') && !url.includes('format=csv')) {
      const match = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
      if (match) return `https://docs.google.com/spreadsheets/d/${match[1]}/export?format=csv`;
    }
    return url;
  }

  // ── Step 1: Fetch CSV ────────────────────────────────────────────────────────
  async function handleFetchCsv() {
    setConfigError('');
    if (!selectedEventId) { setConfigError('Select an event.'); return; }
    if (!csvUrl.trim()) { setConfigError('Paste a CSV URL.'); return; }

    setFetchingCsv(true);
    try {
      const res = await fetch(toCSVUrl(csvUrl));
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const text = await res.text();
      const parsed = parseCSV(text);
      if (parsed.length === 0) throw new Error('No data rows found in CSV.');

      const headers = Object.keys(parsed[0]);
      setCsvHeaders(headers);
      setCachedParsed(parsed);

      // Auto-detect columns
      const dFirst   = detectColumn(headers, ['first name', 'first', 'given name', 'firstname']);
      const dLast    = detectColumn(headers, ['last name', 'last', 'family', 'lastname', 'surname']);
      const dFull    = detectColumn(headers, ['full name', 'name', 'your name', 'student name', 'what is your name']);
      const dCollege = detectColumn(headers, ['college', 'ucsd college', 'residential college']);
      const dYear    = detectColumn(headers, ['year', 'student year', 'year in school', 'academic year', 'standing']);

      const useFull = !dFirst && !dLast && !!dFull;
      setFirstNameCol(dFirst);
      setLastNameCol(dLast);
      setFullNameCol(dFull);
      setUseFullName(useFull);
      setCollegeCol(dCollege);
      setYearCol(dYear);

      await runMatching(parsed, dFirst, dLast, dFull, useFull, dCollege, dYear, selectedEventId);
      setStep('preview');
    } catch (err: unknown) {
      setConfigError(`Failed to fetch CSV: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setFetchingCsv(false);
    }
  }

  // ── Core matching logic ───────────────────────────────────────────────────────
  async function runMatching(
    parsed: Record<string, string>[],
    fCol: string, lCol: string, fullCol: string, useFull: boolean,
    cCol: string, yCol: string,
    eventId: string,
  ) {
    const { data: profiles } = await supabase
      .from('user_profiles')
      .select('id, email, first_name, last_name, college, year');
    const allProfiles = (profiles ?? []) as UserProfile[];

    const { data: attended } = await supabase
      .from('event_attendance')
      .select('user_id')
      .eq('event_id', eventId);
    const attendedIds = new Set((attended ?? []).map((r: { user_id: string }) => r.user_id));

    const results: RowResult[] = parsed.map((row) => {
      // Build name from CSV
      let displayName = '';
      if (useFull) {
        displayName = (fullCol ? row[fullCol] : '').trim();
      } else {
        const fn = (fCol ? row[fCol] : '').trim();
        const ln = (lCol ? row[lCol] : '').trim();
        displayName = [fn, ln].filter(Boolean).join(' ');
      }

      const csvCollege = (cCol ? row[cCol] : '').trim();
      const csvYear    = (yCol ? row[yCol] : '').trim();
      const normCsvCollege = normalizeCollege(csvCollege);
      const normCsvYear    = normalizeYear(csvYear);

      // Score every profile, pick the best
      let best: UserProfile | null = null;
      let bestComposite = 0;
      let bestName = 0;
      let bestCollegeMatch = false;
      let bestYearMatch = false;

      for (const p of allProfiles) {
        const profileFullName = `${p.first_name} ${p.last_name}`;
        const ns = nameSimilarity(displayName, profileFullName);
        if (ns < 55) continue; // fast-reject poor name matches early

        const cm = !!(normCsvCollege && p.college && normalizeCollege(p.college) === normCsvCollege);
        const ym = !!(normCsvYear && p.year && normalizeYear(p.year) === normCsvYear);
        const composite = compositeScore(ns, cm, ym);

        if (composite > bestComposite) {
          bestComposite = composite;
          best = p;
          bestName = ns;
          bestCollegeMatch = cm;
          bestYearMatch = ym;
        }
      }

      // Must clear a minimum bar
      let status: MatchStatus = 'none';
      if (best && bestComposite >= 75) {
        status = bestComposite >= 88 ? 'high' : 'fuzzy';
        if (attendedIds.has(best.id)) status = 'already';
      } else {
        best = null;
      }

      return {
        csvRow: row,
        displayName,
        csvCollege,
        csvYear,
        matchedUser: best,
        status,
        score: bestComposite,
        nameScore: bestName,
        collegeMatch: bestCollegeMatch,
        yearMatch: bestYearMatch,
      };
    });

    setRows(results);
  }

  // ── Re-run matching with updated columns ──────────────────────────────────────
  async function handleRematch() {
    setFetchingCsv(true);
    try {
      await runMatching(cachedParsed, firstNameCol, lastNameCol, fullNameCol, useFullName, collegeCol, yearCol, selectedEventId);
    } finally {
      setFetchingCsv(false);
    }
  }

  // ── Confirm import ────────────────────────────────────────────────────────────
  async function handleImport() {
    const toImport = rows.filter(r => r.status === 'high' || r.status === 'fuzzy');
    if (toImport.length === 0) { toast.error('No rows to import.'); return; }

    setImporting(true);
    const event = events.find(e => e.id === selectedEventId);
    const pointsEarned = event?.points ?? 1;

    try {
      const attendanceRows = toImport.map(r => ({
        event_id: selectedEventId,
        user_id: r.matchedUser!.id,
        points_earned: pointsEarned,
        check_in_type: 'import' as const,
        checked_in_at: new Date().toISOString(),
      }));

      const { error: attErr } = await supabase
        .from('event_attendance')
        .insert(attendanceRows);
      if (attErr) throw attErr;

      // Upsert user_points: read current, add delta, write back
      const userIds = toImport.map(r => r.matchedUser!.id);
      const { data: existingPoints } = await supabase
        .from('user_points')
        .select('user_id, points')
        .in('user_id', userIds);
      const existingMap = new Map(
        (existingPoints ?? []).map((p: { user_id: string; points: number }) => [p.user_id, p.points])
      );
      const pointsUpserts = toImport.map(r => ({
        user_id: r.matchedUser!.id,
        points: (existingMap.get(r.matchedUser!.id) ?? 0) + pointsEarned,
        last_updated: new Date().toISOString(),
      }));
      const { error: ptErr } = await supabase
        .from('user_points')
        .upsert(pointsUpserts, { onConflict: 'user_id' });
      if (ptErr) throw ptErr;

      toast.success(`Imported ${toImport.length} attendee${toImport.length !== 1 ? 's' : ''}!`);
      setStep('done');
    } catch (err: unknown) {
      toast.error(`Import failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setImporting(false);
    }
  }

  // ── Derived counts ────────────────────────────────────────────────────────────
  const summary = {
    high:    rows.filter(r => r.status === 'high').length,
    fuzzy:   rows.filter(r => r.status === 'fuzzy').length,
    none:    rows.filter(r => r.status === 'none').length,
    already: rows.filter(r => r.status === 'already').length,
  };
  const selectedEvent = events.find(e => e.id === selectedEventId);

  // ─── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8 px-4">
      <Toaster position="top-right" />
      <div className="max-w-5xl mx-auto">
        <AdminNav />

        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-8">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Import Attendance</h1>
            <p className="text-gray-500 dark:text-gray-400 mt-1 text-sm">
              Paste a Google Sheets CSV link to bulk-assign points. Members are matched by name, college, and year.
            </p>
          </div>

          {/* Step indicator */}
          <div className="flex items-center gap-3 mb-8">
            {(['configure', 'preview', 'done'] as Step[]).map((s, i) => {
              const past = (s === 'configure' && (step === 'preview' || step === 'done')) ||
                           (s === 'preview' && step === 'done');
              return (
                <div key={s} className="flex items-center gap-2">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold
                    ${step === s ? 'bg-indigo-600 text-white' : past ? 'bg-green-500 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-500'}`}>
                    {past ? '✓' : i + 1}
                  </div>
                  <span className={`text-sm font-medium capitalize
                    ${step === s ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-400 dark:text-gray-500'}`}>
                    {s === 'configure' ? 'Configure' : s === 'preview' ? 'Preview' : 'Done'}
                  </span>
                  {i < 2 && <div className="w-8 h-px bg-gray-200 dark:bg-gray-700 mx-1" />}
                </div>
              );
            })}
          </div>

          {/* ── Step 1: Configure ── */}
          {step === 'configure' && (
            <div className="space-y-6 max-w-2xl">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Event *</label>
                <select
                  value={selectedEventId}
                  onChange={e => setSelectedEventId(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700
                    text-gray-900 dark:text-white px-3 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                >
                  <option value="">— Select an event —</option>
                  {events.map(ev => (
                    <option key={ev.id} value={ev.id}>
                      {ev.name} — {new Date(ev.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} ({ev.points} pts)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  Google Sheets CSV URL *
                </label>
                <input
                  type="url"
                  value={csvUrl}
                  onChange={e => setCsvUrl(e.target.value)}
                  placeholder="https://docs.google.com/spreadsheets/d/..."
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700
                    text-gray-900 dark:text-white px-3 py-2.5 text-sm font-mono focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
                <p className="text-xs text-gray-400 mt-1.5 leading-relaxed">
                  In Google Sheets: <strong>File → Share → Publish to web</strong> → choose the sheet → CSV → Publish.
                  Or paste the normal edit URL — we'll convert it automatically.
                </p>
              </div>

              {/* Tip about member profiles */}
              <div className="rounded-lg bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 px-4 py-3">
                <p className="text-xs text-indigo-700 dark:text-indigo-300 leading-relaxed">
                  <strong>Tip:</strong> Matching accuracy improves when members have set their college and year on their profile page. Remind members to fill these in!
                </p>
              </div>

              {configError && (
                <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-4 py-3 text-sm text-red-700 dark:text-red-300">
                  {configError}
                </div>
              )}

              <button
                onClick={handleFetchCsv}
                disabled={fetchingCsv}
                className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400
                  text-white font-medium px-5 py-2.5 rounded-lg text-sm transition-colors"
              >
                {fetchingCsv ? (
                  <><svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" /></svg>Fetching…</>
                ) : (
                  <><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>Fetch & Preview</>
                )}
              </button>
            </div>
          )}

          {/* ── Step 2: Preview ── */}
          {step === 'preview' && (
            <div className="space-y-6">
              {/* Column mapping */}
              <div className="bg-gray-50 dark:bg-gray-900/50 rounded-xl p-5 border border-gray-200 dark:border-gray-700">
                <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">Column Mapping</h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div className="col-span-2 sm:col-span-1 flex items-end gap-2">
                    <label className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 cursor-pointer select-none">
                      <input type="checkbox" checked={useFullName} onChange={e => setUseFullName(e.target.checked)} className="rounded" />
                      Use single "full name" column
                    </label>
                  </div>
                  {useFullName ? (
                    <ColSelect label="Full name" value={fullNameCol} onChange={setFullNameCol} headers={csvHeaders} />
                  ) : (
                    <>
                      <ColSelect label="First name" value={firstNameCol} onChange={setFirstNameCol} headers={csvHeaders} />
                      <ColSelect label="Last name"  value={lastNameCol}  onChange={setLastNameCol}  headers={csvHeaders} />
                    </>
                  )}
                  <ColSelect label="College" value={collegeCol} onChange={setCollegeCol} headers={csvHeaders} />
                  <ColSelect label="Year"    value={yearCol}    onChange={setYearCol}    headers={csvHeaders} />
                </div>
                <button onClick={handleRematch} disabled={fetchingCsv}
                  className="mt-3 text-xs text-indigo-600 dark:text-indigo-400 hover:underline disabled:opacity-50">
                  {fetchingCsv ? 'Re-matching…' : '↻ Re-run matching with these columns'}
                </button>
              </div>

              {/* Summary badges */}
              <div className="flex flex-wrap gap-3">
                <Badge color="green"  count={summary.high}    label="strong match"  plural="strong matches"  />
                <Badge color="yellow" count={summary.fuzzy}   label="fuzzy match"   plural="fuzzy matches"   />
                <Badge color="gray"   count={summary.already} label="already imported" plural="already imported" />
                <Badge color="red"    count={summary.none}    label="no match"      plural="no matches"      />
              </div>

              {selectedEvent && (
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Will assign <strong>{selectedEvent.points} pt{selectedEvent.points !== 1 ? 's' : ''}</strong> per attendee for <strong>{selectedEvent.name}</strong>.
                </p>
              )}

              {/* Table */}
              <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700 text-sm">
                  <thead>
                    <tr className="bg-gray-50 dark:bg-gray-900/50">
                      {['Status', 'CSV Name', 'CSV College', 'CSV Year', 'Matched Member', 'Score'].map(h => (
                        <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-100 dark:divide-gray-700">
                    {rows.map((row, i) => (
                      <tr key={i} className={
                        row.status === 'high'    ? 'bg-green-50/40 dark:bg-green-900/10' :
                        row.status === 'fuzzy'   ? 'bg-yellow-50/40 dark:bg-yellow-900/10' :
                        row.status === 'already' ? 'bg-gray-50/60 dark:bg-gray-900/20' :
                                                   'bg-red-50/40 dark:bg-red-900/10'
                      }>
                        <td className="px-4 py-2.5 whitespace-nowrap">
                          <StatusBadge status={row.status} />
                        </td>
                        <td className="px-4 py-2.5 font-medium text-gray-900 dark:text-white">
                          {row.displayName || <span className="text-gray-400 italic">—</span>}
                        </td>
                        <td className="px-4 py-2.5 text-gray-500 dark:text-gray-400 text-xs">
                          {row.csvCollege || '—'}
                        </td>
                        <td className="px-4 py-2.5 text-gray-500 dark:text-gray-400 text-xs">
                          {row.csvYear || '—'}
                        </td>
                        <td className="px-4 py-2.5 text-gray-700 dark:text-gray-300">
                          {row.matchedUser ? (
                            <span>
                              {row.matchedUser.first_name} {row.matchedUser.last_name}
                              {row.matchedUser.college && (
                                <span className={`ml-1 text-xs ${row.collegeMatch ? 'text-green-500' : 'text-gray-400'}`}>
                                  · {row.matchedUser.college}
                                </span>
                              )}
                              {row.matchedUser.year && (
                                <span className={`ml-1 text-xs ${row.yearMatch ? 'text-green-500' : 'text-gray-400'}`}>
                                  · {row.matchedUser.year}
                                </span>
                              )}
                            </span>
                          ) : <span className="text-gray-400 italic">—</span>}
                        </td>
                        <td className="px-4 py-2.5 whitespace-nowrap">
                          {row.matchedUser ? (
                            <span className={`text-xs font-mono font-semibold ${
                              row.score >= 88 ? 'text-green-600 dark:text-green-400' :
                              row.score >= 75 ? 'text-yellow-600 dark:text-yellow-400' :
                                               'text-gray-400'
                            }`}>
                              {row.score}%
                            </span>
                          ) : <span className="text-xs text-gray-400">—</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <p className="text-xs text-gray-400 dark:text-gray-500">
                Score = name similarity (60%) + college match (25%) + year match (15%). <strong>Strong</strong> ≥88, <strong>Fuzzy</strong> 75–87. Both are imported; <strong>Already imported</strong> and <strong>No match</strong> are skipped.
              </p>

              <div className="flex items-center gap-3 pt-2">
                <button
                  onClick={handleImport}
                  disabled={importing || (summary.high + summary.fuzzy) === 0}
                  className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700
                    disabled:bg-indigo-300 dark:disabled:bg-indigo-800
                    text-white font-medium px-5 py-2.5 rounded-lg text-sm transition-colors"
                >
                  {importing ? (
                    <><svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" /></svg>Importing…</>
                  ) : (
                    <><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                    Import {summary.high + summary.fuzzy} attendee{(summary.high + summary.fuzzy) !== 1 ? 's' : ''}</>
                  )}
                </button>
                <button onClick={() => { setStep('configure'); setRows([]); }}
                  className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 px-3 py-2.5">
                  ← Back
                </button>
              </div>
            </div>
          )}

          {/* ── Step 3: Done ── */}
          {step === 'done' && (
            <div className="text-center py-12">
              <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Import complete!</h2>
              <p className="text-gray-500 dark:text-gray-400 text-sm mb-8">Attendance and points have been recorded.</p>
              <button
                onClick={() => { setStep('configure'); setRows([]); setCsvUrl(''); setSelectedEventId(''); setCachedParsed([]); }}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium px-5 py-2.5 rounded-lg text-sm transition-colors"
              >
                Import another sheet
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Small helper components ──────────────────────────────────────────────────

function ColSelect({ label, value, onChange, headers }: {
  label: string; value: string; onChange: (v: string) => void; headers: string[];
}) {
  return (
    <div>
      <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">{label}</label>
      <select value={value} onChange={e => onChange(e.target.value)}
        className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700
          text-gray-900 dark:text-white text-xs px-2 py-1.5 focus:ring-2 focus:ring-indigo-500 focus:border-transparent">
        <option value="">(none)</option>
        {headers.map(h => <option key={h} value={h}>{h}</option>)}
      </select>
    </div>
  );
}

function Badge({ color, count, label, plural }: { color: string; count: number; label: string; plural: string }) {
  const colors: Record<string, string> = {
    green:  'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300',
    yellow: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300',
    gray:   'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400',
    red:    'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400',
  };
  const dots: Record<string, string> = {
    green: 'bg-green-500', yellow: 'bg-yellow-400', gray: 'bg-gray-400', red: 'bg-red-400',
  };
  return (
    <span className={`inline-flex items-center gap-1.5 text-sm px-3 py-1 rounded-full font-medium ${colors[color]}`}>
      <span className={`w-2 h-2 rounded-full inline-block ${dots[color]}`} />
      {count} {count === 1 ? label : plural}
    </span>
  );
}

function StatusBadge({ status }: { status: MatchStatus }) {
  if (status === 'high')    return <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700 dark:text-green-400"><span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" /> Strong</span>;
  if (status === 'fuzzy')   return <span className="inline-flex items-center gap-1 text-xs font-medium text-yellow-700 dark:text-yellow-400"><span className="w-1.5 h-1.5 rounded-full bg-yellow-400 inline-block" /> Fuzzy</span>;
  if (status === 'already') return <span className="inline-flex items-center gap-1 text-xs font-medium text-gray-500 dark:text-gray-400"><span className="w-1.5 h-1.5 rounded-full bg-gray-400 inline-block" /> Already</span>;
  return <span className="inline-flex items-center gap-1 text-xs font-medium text-red-600 dark:text-red-400"><span className="w-1.5 h-1.5 rounded-full bg-red-400 inline-block" /> No match</span>;
}
