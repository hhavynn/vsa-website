import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { AdminNav } from '../../components/features/admin/AdminNav';
import toast, { Toaster } from 'react-hot-toast';
import { normalizeYearInput, OFFICIAL_YEARS } from '../../lib/yearNormalizer';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Event {
  id: string;
  name: string;
  date: string;
  points: number;
}

interface Member {
  id: string;
  first_name: string;
  last_name: string;
  college: string | null;
  year: string | null;
  points: number;
  events_attended: number;
  email: string | null;
  needs_review?: boolean;
}

type RowStatus = 'match' | 'new' | 'already' | 'review';

interface RowResult {
  csvRow: Record<string, string>;
  /** Original (capitalised) name from CSV — shown in the table */
  displayName: string;
  /** Cleaned name used for matching (no middle initials, comma-reversed) */
  matchName: string;
  csvCollege: string;
  csvYear: string;
  csvEmail: string;
  /** Existing member if matched or reviewed, null if new */
  matchedMember: Member | null;
  status: RowStatus;
  /** Composite score 0–100 (set when status === 'match' or 'review') */
  score: number;
  nameScore: number;
  collegeMatch: boolean;
  yearMatch: boolean;
  invalidYear: boolean;
  /** True when: status=match, csvEmail non-empty, member.email is null → will write email to DB */
  emailWillEnrich: boolean;
}

// ─── Normalisation helpers ────────────────────────────────────────────────────

const COLLEGE_ALIASES: [RegExp, string][] = [
  [/revelle/i,                        'revelle'],
  [/muir/i,                           'muir'],
  [/marshall|thurgood/i,              'marshall'],
  [/eleanor|erc|roosevelt.*college/i, 'erc'],
  [/sixth|6th/i,                      'sixth'],
  [/seventh|7th/i,                    'seventh'],
  [/eighth|8th/i,                     'eighth'],
];

function normalizeCollege(s: string): string {
  for (const [re, key] of COLLEGE_ALIASES) if (re.test(s)) return key;
  return s.toLowerCase().trim();
}

// ─── Fuzzy name similarity ────────────────────────────────────────────────────

function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length;
  const dp = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  );
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = a[i-1] === b[j-1]
        ? dp[i-1][j-1]
        : 1 + Math.min(dp[i-1][j], dp[i][j-1], dp[i-1][j-1]);
  return dp[m][n];
}

/** Lowercase + strip all punctuation + collapse whitespace for comparison only.
 *  "Lynna, On" and "Lynna On" both → "lynna on" (distance 0, score 100) */
function normalizeForMatch(s: string): string {
  return s.toLowerCase().replace(/[^a-z\s]/g, '').replace(/\s+/g, ' ').trim();
}

function nameSimilarity(a: string, b: string): number {
  const na = normalizeForMatch(a), nb = normalizeForMatch(b);
  if (!na || !nb) return 0;
  if (na === nb) return 100;
  return Math.round((1 - levenshtein(na, nb) / Math.max(na.length, nb.length)) * 100);
}

// Composite: name 60%, college 25%, year 15%
function compositeScore(ns: number, cm: boolean, ym: boolean) {
  return Math.round(ns * 0.6 + (cm ? 25 : 0) + (ym ? 15 : 0));
}

// ─── Name helpers ─────────────────────────────────────────────────────────────

/** Capitalize the first letter of every word, lowercase the rest.
 *  "john doe" → "John Doe", "MARY LOU" → "Mary Lou" */
function capitalizeName(s: string): string {
  return s.trim().split(/\s+/).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
}

/**
 * Normalise a raw name string for matching purposes:
 *  - "Lynna, On"        → "Lynna On"      (comma stripped, order kept)
 *  - "Kevin J. Nguyen"  → "Kevin Nguyen"  (middle initial with period)
 *  - "Kevin J Nguyen"   → "Kevin Nguyen"  (single-letter middle word)
 * Returns a capitalised string. Does NOT mutate the display name.
 */
function cleanName(raw: string): string {
  let s = raw.trim();
  // Strip ALL commas — treat as typos/separators, never as Last/First markers
  s = s.replace(/,/g, ' ');
  // Remove middle initials followed by a period: "J." or "J. "
  s = s.replace(/\b[A-Za-z]\.\s*/g, '');
  // Remove lone single-letter middle words between two multi-letter words
  s = s.replace(/(\b\w{2,})\s+\b[A-Za-z]\b\s+(\w{2,}\b)/g, '$1 $2');
  return capitalizeName(s.replace(/\s+/g, ' ').trim());
}

// ─── CSV helpers ──────────────────────────────────────────────────────────────

function parseCSV(raw: string): Record<string, string>[] {
  const lines = raw.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const headers = splitRow(lines[0]);
  return lines.slice(1).map(line => {
    const vals = splitRow(line);
    const row: Record<string, string> = {};
    headers.forEach((h, i) => { row[h.trim()] = (vals[i] ?? '').trim(); });
    return row;
  });
}

function splitRow(line: string): string[] {
  const out: string[] = [];
  let cur = '', inQ = false;
  for (const ch of line) {
    if (ch === '"') inQ = !inQ;
    else if (ch === ',' && !inQ) { out.push(cur); cur = ''; }
    else cur += ch;
  }
  out.push(cur);
  return out;
}

function detectCol(headers: string[], hints: string[]): string {
  const h = hints.map(x => x.toLowerCase());
  return headers.find(c => h.some(hint => c.toLowerCase().includes(hint))) ?? '';
}

function toCSVUrl(raw: string): string {
  const url = raw.trim();
  if (url.includes('docs.google.com/spreadsheets') && !url.includes('output=csv') && !url.includes('format=csv')) {
    const m = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
    if (m) return `https://docs.google.com/spreadsheets/d/${m[1]}/export?format=csv`;
  }
  return url;
}

// ─── Component ────────────────────────────────────────────────────────────────

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
  const [emailCol, setEmailCol] = useState('');

  // Preview
  const [rows, setRows] = useState<RowResult[]>([]);
  const [cachedParsed, setCachedParsed] = useState<Record<string, string>[]>([]);
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    supabase
      .from('events')
      .select('id, name, date, points')
      .order('date', { ascending: false })
      .then(({ data }) => setEvents((data ?? []) as Event[]));
  }, []);

  // ── Fetch CSV ────────────────────────────────────────────────────────────────
  async function handleFetchCsv() {
    setConfigError('');
    if (!selectedEventId) { setConfigError('Select an event.'); return; }
    if (!csvUrl.trim())   { setConfigError('Paste a CSV URL.'); return; }

    setFetchingCsv(true);
    try {
      const res = await fetch(toCSVUrl(csvUrl));
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const parsed = parseCSV(await res.text());
      if (!parsed.length) throw new Error('No data rows found in CSV.');

      const headers = Object.keys(parsed[0]);
      setCsvHeaders(headers);
      setCachedParsed(parsed);

      const dFirst   = detectCol(headers, ['first name', 'first', 'given name', 'firstname']);
      const dLast    = detectCol(headers, ['last name', 'last', 'family', 'lastname', 'surname']);
      const dFull    = detectCol(headers, ['full name', 'name', 'your name', 'student name', 'what is your name']);
      const dCollege = detectCol(headers, ['college', 'ucsd college', 'residential college']);
      const dYear    = detectCol(headers, ['year', 'student year', 'year in school', 'academic year', 'standing']);
      const dEmail   = detectCol(headers, ['email', 'email address', 'e-mail', 'contact email', 'gmail']);
      const useFull  = !dFirst && !dLast && !!dFull;

      setFirstNameCol(dFirst); setLastNameCol(dLast); setFullNameCol(dFull);
      setUseFullName(useFull); setCollegeCol(dCollege); setYearCol(dYear); setEmailCol(dEmail);

      await runMatching(parsed, dFirst, dLast, dFull, useFull, dCollege, dYear, dEmail, selectedEventId);
      setStep('preview');
    } catch (err: unknown) {
      setConfigError(`Failed to fetch CSV: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setFetchingCsv(false);
    }
  }

  // ── Matching engine ───────────────────────────────────────────────────────────
  async function runMatching(
    parsed: Record<string, string>[],
    fCol: string, lCol: string, fullCol: string, useFull: boolean,
    cCol: string, yCol: string, eCol: string, eventId: string,
  ) {
    // Load all existing members
    const { data: membersData } = await supabase
      .from('members')
      .select('id, first_name, last_name, college, year, points, events_attended, email');
    const allMembers = (membersData ?? []) as Member[];

    // Load which members already have attendance for this event
    const { data: existingAtt } = await supabase
      .from('member_event_attendance')
      .select('member_id')
      .eq('event_id', eventId);
    const alreadySet = new Set((existingAtt ?? []).map((r: { member_id: string }) => r.member_id));

    const results: RowResult[] = parsed.map(row => {
      // Build display name (capitalised, shown in table)
      let displayName = '';
      if (useFull) {
        displayName = capitalizeName(fullCol ? row[fullCol] : '');
      } else {
        const fn = capitalizeName(fCol ? row[fCol] : '');
        const ln = capitalizeName(lCol ? row[lCol] : '');
        displayName = [fn, ln].filter(Boolean).join(' ');
      }

      // Build match name (cleaned: no middle initials, comma-reversed)
      const matchName = cleanName(displayName);

      const csvCollege    = (cCol ? row[cCol] : '').trim();
      const csvYear       = normalizeYearInput(yCol ? row[yCol] : '');
      const csvEmail      = (eCol ? row[eCol] : '').trim().toLowerCase();
      const normCsvCollege = normalizeCollege(csvCollege);
      
      const invalidYear = csvYear !== '' && !OFFICIAL_YEARS.includes(csvYear);

      // Score against every member using the cleaned match name
      let best: Member | null = null;
      let bestScore = 0, bestNS = 0;
      let bestCM = false, bestYM = false;

      for (const m of allMembers) {
        const memberFullName = cleanName(`${m.first_name} ${m.last_name}`);
        const ns = nameSimilarity(matchName, memberFullName);
        if (ns < 50) continue; // fast-reject
        const cm = !!(normCsvCollege && m.college && normalizeCollege(m.college) === normCsvCollege);
        const ym = !!(csvYear && m.year && m.year === csvYear);
        const cs = compositeScore(ns, cm, ym);
        if (cs > bestScore) { bestScore = cs; best = m; bestNS = ns; bestCM = cm; bestYM = ym; }
      }

      // Name similarity 50-94% OR composite score 50-94% → flag for manual review
      if (best && bestScore >= 50 && bestScore < 95) {
        return {
          csvRow: row, displayName, matchName, csvCollege, csvYear, csvEmail,
          matchedMember: best, status: 'review' as RowStatus,
          score: bestScore, nameScore: bestNS, collegeMatch: bestCM, yearMatch: bestYM,
          invalidYear, emailWillEnrich: false,
        };
      }

      // Full match threshold: composite >= 95
      if (best && bestScore >= 95) {
        const status: RowStatus = alreadySet.has(best.id) ? 'already' : 'match';
        const emailWillEnrich = status === 'match' && !!csvEmail && !best.email;
        return {
          csvRow: row, displayName, matchName, csvCollege, csvYear, csvEmail,
          matchedMember: best, status, score: bestScore, nameScore: bestNS,
          collegeMatch: bestCM, yearMatch: bestYM, invalidYear, emailWillEnrich,
        };
      }

      // No match → create new member
      return {
        csvRow: row, displayName, matchName, csvCollege, csvYear, csvEmail,
        matchedMember: null, status: 'new', score: 0, nameScore: 0,
        collegeMatch: false, yearMatch: false, invalidYear, emailWillEnrich: false,
      };
    });

    setRows(results);
  }

  async function handleRematch() {
    setFetchingCsv(true);
    try {
      await runMatching(cachedParsed, firstNameCol, lastNameCol, fullNameCol, useFullName, collegeCol, yearCol, emailCol, selectedEventId);
    } finally {
      setFetchingCsv(false);
    }
  }

  // ── Confirm import ────────────────────────────────────────────────────────────
  async function handleImport() {
    const toUpdate = rows.filter(r => r.status === 'match');
    const toCreate = rows.filter(r => (r.status === 'new' || r.status === 'review') && r.displayName.trim());

    if (!toUpdate.length && !toCreate.length) {
      toast.error('Nothing to import.'); return;
    }

    setImporting(true);
    const event = events.find(e => e.id === selectedEventId);
    const pts = event?.points ?? 1;

    try {
      // 1. Create new member rows (points/events_attended computed by DB trigger)
      const newNames = toCreate.map(r => {
        const parts = r.displayName.trim().split(/\s+/);
        const first = parts[0] ?? '';
        const last  = parts.slice(1).join(' ') || '—';
        return {
          first_name: first,
          last_name:  last,
          college:    r.csvCollege || null,
          year:       r.csvYear    || null,
          email:      r.csvEmail   || null,
          needs_review: r.status === 'review',
        };
      });

      let newMemberIds: string[] = [];
      if (newNames.length) {
        const { data: inserted, error } = await supabase
          .from('members')
          .insert(newNames)
          .select('id');
        if (error) throw error;
        newMemberIds = (inserted ?? []).map((m: { id: string }) => m.id);
      }

      // 2. Insert attendance records — DB trigger recalculates member points automatically
      const attendanceRows = [
        ...toUpdate.map(r => ({ member_id: r.matchedMember!.id, event_id: selectedEventId, points_earned: pts })),
        ...newMemberIds.map(id => ({ member_id: id, event_id: selectedEventId, points_earned: pts })),
      ];

      if (attendanceRows.length) {
        const { error } = await supabase
          .from('member_event_attendance')
          .upsert(attendanceRows, { onConflict: 'member_id,event_id', ignoreDuplicates: true });
        if (error) throw error;
      }

      // 3. Enrich email for matched members who didn't have one
      const toEnrich = toUpdate.filter(r => r.emailWillEnrich);
      for (const r of toEnrich) {
        await supabase
          .from('members')
          .update({ email: r.csvEmail, updated_at: new Date().toISOString() })
          .eq('id', r.matchedMember!.id);
      }

      const enrichMsg = toEnrich.length ? `, enriched ${toEnrich.length} email${toEnrich.length !== 1 ? 's' : ''}` : '';
      toast.success(`Done! Updated ${toUpdate.length} member${toUpdate.length !== 1 ? 's' : ''}, created ${toCreate.length} new${enrichMsg}.`);
      setStep('done');
    } catch (err: unknown) {
      toast.error(`Import failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setImporting(false);
    }
  }

  // ── Counts ────────────────────────────────────────────────────────────────────
  const summary = {
    match:    rows.filter(r => r.status === 'match').length,
    new:      rows.filter(r => r.status === 'new').length,
    already:  rows.filter(r => r.status === 'already').length,
    review:   rows.filter(r => r.status === 'review').length,
    invalidYear: rows.filter(r => r.invalidYear).length,
    enrich:   rows.filter(r => r.emailWillEnrich).length,
  };
  const selectedEvent = events.find(e => e.id === selectedEventId);

  // ─── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8 px-4">
      <Toaster position="top-right" />
      <div className="max-w-5xl mx-auto">
        <AdminNav />

        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-8">
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Import Attendance</h1>
            <p className="text-gray-500 dark:text-gray-400 mt-1 text-sm">
              Paste a Google Sheets CSV link. Matched members get their points updated; unmatched people are added as new members.
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

          {/* ── Step 1 ── */}
          {step === 'configure' && (
            <div className="space-y-6 max-w-2xl">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Event *</label>
                <select value={selectedEventId} onChange={e => setSelectedEventId(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700
                    text-gray-900 dark:text-white px-3 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent">
                  <option value="">— Select an event —</option>
                  {events.map(ev => (
                    <option key={ev.id} value={ev.id}>
                      {ev.name} — {new Date(ev.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} ({ev.points} pts)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Google Sheets CSV URL *</label>
                <input type="url" value={csvUrl} onChange={e => setCsvUrl(e.target.value)}
                  placeholder="https://docs.google.com/spreadsheets/d/..."
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700
                    text-gray-900 dark:text-white px-3 py-2.5 text-sm font-mono focus:ring-2 focus:ring-indigo-500 focus:border-transparent" />
                <p className="text-xs text-gray-400 mt-1.5 leading-relaxed">
                  <strong>File → Share → Publish to web</strong> → sheet → CSV → Publish. Or paste the edit URL — we convert it automatically.
                </p>
              </div>

              {configError && (
                <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-4 py-3 text-sm text-red-700 dark:text-red-300">
                  {configError}
                </div>
              )}

              <button onClick={handleFetchCsv} disabled={fetchingCsv}
                className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-medium px-5 py-2.5 rounded-lg text-sm transition-colors">
                {fetchingCsv
                  ? <><Spinner />Fetching…</>
                  : <><DownloadIcon />Fetch & Preview</>}
              </button>
            </div>
          )}

          {/* ── Step 2 ── */}
          {step === 'preview' && (
            <div className="space-y-6">
              {/* Column mapping */}
              <div className="bg-gray-50 dark:bg-gray-900/50 rounded-xl p-5 border border-gray-200 dark:border-gray-700">
                <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">Column Mapping</h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div className="col-span-2 sm:col-span-1 flex items-end">
                    <label className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 cursor-pointer select-none">
                      <input type="checkbox" checked={useFullName} onChange={e => setUseFullName(e.target.checked)} className="rounded" />
                      Use single "full name" column
                    </label>
                  </div>
                  {useFullName
                    ? <ColSelect label="Full name"  value={fullNameCol}  onChange={setFullNameCol}  headers={csvHeaders} />
                    : <><ColSelect label="First name" value={firstNameCol} onChange={setFirstNameCol} headers={csvHeaders} />
                        <ColSelect label="Last name"  value={lastNameCol}  onChange={setLastNameCol}  headers={csvHeaders} /></>}
                  <ColSelect label="College" value={collegeCol} onChange={setCollegeCol} headers={csvHeaders} />
                  <ColSelect label="Year"    value={yearCol}    onChange={setYearCol}    headers={csvHeaders} />
                  <ColSelect label="Email"   value={emailCol}   onChange={setEmailCol}   headers={csvHeaders} />
                </div>
                <button onClick={handleRematch} disabled={fetchingCsv}
                  className="mt-3 text-xs text-indigo-600 dark:text-indigo-400 hover:underline disabled:opacity-50">
                  {fetchingCsv ? 'Re-matching…' : '↻ Re-run matching with these columns'}
                </button>
              </div>

              {/* Summary */}
              <div className="flex flex-wrap gap-3">
                <SummaryBadge color="green"  count={summary.match}    label="will update existing member"    plural="will update existing members" />
                <SummaryBadge color="blue"   count={summary.new}      label="will be added as a new member"  plural="will be added as new members" />
                <SummaryBadge color="amber"  count={summary.review}   label="added as new, flag as potential duplicate" plural="added as new, flag as potential duplicates" />
                <SummaryBadge color="gray"   count={summary.already}  label="already imported for this event" plural="already imported for this event" />
                {summary.invalidYear > 0 && (
                  <SummaryBadge color="red" count={summary.invalidYear} label="year unrecognized, review manually" plural="years unrecognized, review manually" />
                )}
                {summary.enrich > 0 && (
                  <SummaryBadge color="purple" count={summary.enrich} label="email will be added to profile" plural="emails will be added to profiles" />
                )}
              </div>

              {selectedEvent && (
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Each matched or new member gets <strong className="text-gray-700 dark:text-gray-200">{selectedEvent.points} pt{selectedEvent.points !== 1 ? 's' : ''}</strong> for <strong className="text-gray-700 dark:text-gray-200">{selectedEvent.name}</strong>.
                </p>
              )}

              {/* Preview table */}
              <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700 text-sm">
                  <thead>
                    <tr className="bg-gray-50 dark:bg-gray-900/50">
                      {['Action', 'CSV Name', 'CSV College', 'CSV Year', 'Matched Member', 'Confidence'].map(h => (
                        <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-100 dark:divide-gray-700">
                    {rows.map((row, i) => (
                      <tr key={i} className={
                        row.status === 'match'    ? 'bg-green-50/40 dark:bg-green-900/10' :
                        row.status === 'new'      ? 'bg-blue-50/40 dark:bg-blue-900/10' :
                        row.status === 'review'   ? 'bg-amber-50/60 dark:bg-amber-900/10' :
                                                    'bg-gray-50/60 dark:bg-gray-900/20'
                      }>
                        <td className="px-4 py-2.5 whitespace-nowrap">
                          {row.status === 'match'    && (
                            <span className="inline-flex items-center gap-1">
                              <ActionBadge color="green" label="Update" />
                              {row.emailWillEnrich && (
                                <span className="ml-1 text-[10px] text-purple-500 dark:text-purple-400" title="Email will be added to this member's profile">✉</span>
                              )}
                            </span>
                          )}
                          {row.status === 'new'      && <ActionBadge color="blue"  label="Create" />}
                          {row.status === 'already'  && <ActionBadge color="gray"  label="Skip" />}
                          {row.status === 'review'   && <ActionBadge color="amber" label="Review" />}
                        </td>
                        <td className="px-4 py-2.5 font-medium text-gray-900 dark:text-white">
                          <div>{row.displayName || <span className="text-gray-400 italic">—</span>}</div>
                          {row.matchName !== row.displayName && (
                            <div className="text-[10px] text-gray-400 mt-0.5">matched as: {row.matchName}</div>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-gray-500 dark:text-gray-400 text-xs">{row.csvCollege || '—'}</td>
                        <td className="px-4 py-2.5 text-gray-500 dark:text-gray-400 text-xs">
                          {row.csvYear || '—'}
                          {row.invalidYear && (
                            <span className="ml-1 text-[10px] text-red-500 font-medium" title="Unrecognized year format">⚠️</span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-gray-700 dark:text-gray-300">
                          {row.matchedMember ? (
                            <span>
                              {row.matchedMember.first_name} {row.matchedMember.last_name}
                              {row.matchedMember.college && (
                                <span className={`ml-1 text-xs ${row.collegeMatch ? 'text-green-500' : 'text-gray-400'}`}>
                                  · {row.matchedMember.college}
                                </span>
                              )}
                              {row.matchedMember.year && (
                                <span className={`ml-1 text-xs ${row.yearMatch ? 'text-green-500' : 'text-gray-400'}`}>
                                  · {row.matchedMember.year}
                                </span>
                              )}
                              {row.status === 'review' && (
                                <div className="text-[10px] text-amber-600 dark:text-amber-400 mt-0.5">Similarity {row.score}% — adding as new</div>
                              )}
                            </span>
                          ) : (
                            <span className="text-blue-500 dark:text-blue-400 text-xs italic">new member</span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 whitespace-nowrap">
                          {(row.status === 'match' || row.status === 'review') ? (
                            <span className={`text-xs font-mono font-semibold ${
                              row.status === 'review'    ? 'text-amber-600 dark:text-amber-400' :
                              row.score >= 95            ? 'text-green-600 dark:text-green-400' :
                                                           'text-yellow-600 dark:text-yellow-400'
                            }`}>{row.score}%</span>
                          ) : row.status === 'new' ? (
                            <span className="text-xs text-gray-400">—</span>
                          ) : (
                            <span className="text-xs text-gray-400">already done</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <p className="text-xs text-gray-400 dark:text-gray-500">
                Score = name (60%) + college (25%) + year (15%). ≥95% → exact match. 50-94% → flagged as duplicate but added as new. &lt;50% → new member.
              </p>

              <div className="flex items-center gap-3 pt-2">
                <button onClick={handleImport}
                  disabled={importing || (summary.match + summary.new) === 0}
                  className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700
                    disabled:bg-indigo-300 dark:disabled:bg-indigo-800
                    text-white font-medium px-5 py-2.5 rounded-lg text-sm transition-colors">
                  {importing
                    ? <><Spinner />Importing…</>
                    : <><CheckIcon />Import ({summary.match} update{summary.match !== 1 ? 's' : ''} + {summary.new} new)</>}
                </button>
                <button onClick={() => { setStep('configure'); setRows([]); }}
                  className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 px-3 py-2.5">
                  ← Back
                </button>
              </div>
            </div>
          )}

          {/* ── Step 3 ── */}
          {step === 'done' && (
            <div className="text-center py-12">
              <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto mb-4">
                <CheckIcon className="w-8 h-8 text-green-500" />
              </div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Import complete!</h2>
              <p className="text-gray-500 dark:text-gray-400 text-sm mb-8">Points and new members have been added to the leaderboard.</p>
              <button
                onClick={() => { setStep('configure'); setRows([]); setCsvUrl(''); setSelectedEventId(''); setCachedParsed([]); }}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium px-5 py-2.5 rounded-lg text-sm transition-colors">
                Import another sheet
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Tiny helpers ─────────────────────────────────────────────────────────────

function ColSelect({ label, value, onChange, headers }: { label: string; value: string; onChange: (v: string) => void; headers: string[] }) {
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

function SummaryBadge({ color, count, label, plural }: { color: string; count: number; label: string; plural: string }) {
  const cls: Record<string, string> = {
    green:  'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300',
    blue:   'bg-blue-100  dark:bg-blue-900/30  text-blue-700  dark:text-blue-300',
    gray:   'bg-gray-100  dark:bg-gray-700      text-gray-500  dark:text-gray-400',
    amber:  'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300',
    purple: 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300',
  };
  const dot: Record<string, string> = {
    green: 'bg-green-500', blue: 'bg-blue-500', gray: 'bg-gray-400',
    amber: 'bg-amber-500', purple: 'bg-purple-500',
  };
  return (
    <span className={`inline-flex items-center gap-1.5 text-sm px-3 py-1 rounded-full font-medium ${cls[color]}`}>
      <span className={`w-2 h-2 rounded-full inline-block ${dot[color]}`} />
      {count} {count === 1 ? label : plural}
    </span>
  );
}

function ActionBadge({ color, label }: { color: string; label: string }) {
  const cls: Record<string, string> = {
    green: 'text-green-700 dark:text-green-400',
    blue:  'text-blue-700  dark:text-blue-400',
    gray:  'text-gray-500  dark:text-gray-400',
    amber: 'text-amber-700 dark:text-amber-400',
  };
  const dot: Record<string, string> = {
    green: 'bg-green-500', blue: 'bg-blue-500', gray: 'bg-gray-400', amber: 'bg-amber-500',
  };
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium ${cls[color]}`}>
      <span className={`w-1.5 h-1.5 rounded-full inline-block ${dot[color]}`} />
      {label}
    </span>
  );
}

function Spinner() {
  return <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" /></svg>;
}

function DownloadIcon() {
  return <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>;
}

function CheckIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>;
}
