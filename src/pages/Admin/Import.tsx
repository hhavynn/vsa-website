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
}

type MatchStatus = 'email' | 'name' | 'none' | 'already';

interface RowResult {
  csvRow: Record<string, string>;
  displayName: string;
  csvEmail: string;
  matchedUser: UserProfile | null;
  status: MatchStatus;
  score?: number; // fuzzy score 0–100 (100 = perfect)
}

// ─── Fuzzy helpers ────────────────────────────────────────────────────────────

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  );
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

function nameSimilarity(a: string, b: string): number {
  const norm = (s: string) => s.toLowerCase().trim();
  const na = norm(a);
  const nb = norm(b);
  if (na === nb) return 100;
  const dist = levenshtein(na, nb);
  const maxLen = Math.max(na.length, nb.length);
  return Math.round((1 - dist / maxLen) * 100);
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
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

// ─── Column auto-detection ────────────────────────────────────────────────────

function detectColumn(headers: string[], hints: string[]): string | null {
  const h = hints.map((x) => x.toLowerCase());
  const found = headers.find((col) => h.some((hint) => col.toLowerCase().includes(hint)));
  return found ?? null;
}

// ─── Main component ───────────────────────────────────────────────────────────

type Step = 'configure' | 'preview' | 'done';

export default function AdminImport() {
  // Step state
  const [step, setStep] = useState<Step>('configure');

  // Configure step
  const [events, setEvents] = useState<Event[]>([]);
  const [selectedEventId, setSelectedEventId] = useState('');
  const [csvUrl, setCsvUrl] = useState('');
  const [fetchingCsv, setFetchingCsv] = useState(false);
  const [configError, setConfigError] = useState('');

  // Column mapping (auto-detected, user can override)
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [emailCol, setEmailCol] = useState('');
  const [firstNameCol, setFirstNameCol] = useState('');
  const [lastNameCol, setLastNameCol] = useState('');
  const [fullNameCol, setFullNameCol] = useState('');
  const [useFullName, setUseFullName] = useState(false);

  // Preview step
  const [rows, setRows] = useState<RowResult[]>([]);
  const [importing, setImporting] = useState(false);

  // ── Load events ──────────────────────────────────────────────────────────────
  useEffect(() => {
    supabase
      .from('events')
      .select('id, name, date, points')
      .order('date', { ascending: false })
      .then(({ data }) => setEvents((data ?? []) as Event[]));
  }, []);

  // ── Step 1: Fetch CSV ────────────────────────────────────────────────────────
  async function handleFetchCsv() {
    setConfigError('');
    if (!selectedEventId) { setConfigError('Select an event.'); return; }
    if (!csvUrl.trim()) { setConfigError('Paste a CSV URL.'); return; }

    // Convert Google Sheets share URL → published CSV export if needed
    let url = csvUrl.trim();
    // "published to web" CSV: https://docs.google.com/spreadsheets/d/ID/pub?output=csv
    // edit URL: https://docs.google.com/spreadsheets/d/ID/edit...
    if (url.includes('docs.google.com/spreadsheets') && !url.includes('output=csv')) {
      const match = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
      if (match) {
        url = `https://docs.google.com/spreadsheets/d/${match[1]}/export?format=csv&id=${match[1]}`;
      }
    }

    setFetchingCsv(true);
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const text = await res.text();
      const parsed = parseCSV(text);
      if (parsed.length === 0) throw new Error('No data rows found in CSV.');

      const headers = Object.keys(parsed[0]);
      setCsvHeaders(headers);

      // Auto-detect columns
      const detectedEmail = detectColumn(headers, ['email', 'e-mail', 'mail']);
      const detectedFirst = detectColumn(headers, ['first name', 'first', 'given name', 'firstname']);
      const detectedLast = detectColumn(headers, ['last name', 'last', 'family name', 'lastname', 'surname']);
      const detectedFull = detectColumn(headers, ['full name', 'name', 'your name', 'student name']);

      setEmailCol(detectedEmail ?? '');
      setFirstNameCol(detectedFirst ?? '');
      setLastNameCol(detectedLast ?? '');
      setFullNameCol(detectedFull ?? '');
      // Prefer split first/last; fall back to full name
      setUseFullName(!detectedFirst && !detectedLast && !!detectedFull);

      await buildPreview(parsed, detectedEmail ?? '', detectedFirst ?? '', detectedLast ?? '', detectedFull ?? '', !detectedFirst && !detectedLast && !!detectedFull, selectedEventId);
      setStep('preview');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setConfigError(`Failed to fetch CSV: ${msg}`);
    } finally {
      setFetchingCsv(false);
    }
  }

  // ── Build preview (match rows to users) ──────────────────────────────────────
  async function buildPreview(
    parsed: Record<string, string>[],
    eCol: string,
    fCol: string,
    lCol: string,
    fullCol: string,
    useFull: boolean,
    eventId: string,
  ) {
    // Fetch all user profiles once
    const { data: profiles } = await supabase
      .from('user_profiles')
      .select('id, email, first_name, last_name');
    const allProfiles = (profiles ?? []) as UserProfile[];

    // Fetch already-attended user IDs for this event
    const { data: attended } = await supabase
      .from('event_attendance')
      .select('user_id')
      .eq('event_id', eventId);
    const attendedIds = new Set((attended ?? []).map((r: { user_id: string }) => r.user_id));

    const results: RowResult[] = parsed.map((row) => {
      const csvEmail = (eCol ? row[eCol] : '').trim().toLowerCase();
      let displayName = '';
      if (useFull) {
        displayName = (fullCol ? row[fullCol] : '').trim();
      } else {
        const fn = (fCol ? row[fCol] : '').trim();
        const ln = (lCol ? row[lCol] : '').trim();
        displayName = [fn, ln].filter(Boolean).join(' ');
      }

      // 1. Try email match
      let matched: UserProfile | null = null;
      let status: MatchStatus = 'none';
      let score: number | undefined;

      if (csvEmail) {
        matched = allProfiles.find((p) => p.email.toLowerCase() === csvEmail) ?? null;
        if (matched) status = 'email';
      }

      // 2. Fuzzy name match
      if (!matched && displayName) {
        let bestScore = 0;
        let bestProfile: UserProfile | null = null;
        for (const p of allProfiles) {
          const fullName = `${p.first_name} ${p.last_name}`;
          const s = nameSimilarity(displayName, fullName);
          if (s > bestScore) {
            bestScore = s;
            bestProfile = p;
          }
        }
        if (bestScore >= 70) {
          matched = bestProfile;
          status = 'name';
          score = bestScore;
        }
      }

      // 3. Already attended?
      if (matched && attendedIds.has(matched.id)) {
        status = 'already';
      }

      return { csvRow: row, displayName, csvEmail, matchedUser: matched, status, score };
    });

    setRows(results);
  }

  // ── Re-run preview with updated column mapping ────────────────────────────────
  async function handleRematch() {
    setFetchingCsv(true);
    try {
      let url = csvUrl.trim();
      if (url.includes('docs.google.com/spreadsheets') && !url.includes('output=csv')) {
        const match = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
        if (match) url = `https://docs.google.com/spreadsheets/d/${match[1]}/export?format=csv&id=${match[1]}`;
      }
      const res = await fetch(url);
      const text = await res.text();
      const parsed = parseCSV(text);
      await buildPreview(parsed, emailCol, firstNameCol, lastNameCol, fullNameCol, useFullName, selectedEventId);
    } finally {
      setFetchingCsv(false);
    }
  }

  // ── Step 3: Confirm import ────────────────────────────────────────────────────
  async function handleImport() {
    const toImport = rows.filter((r) => r.status === 'email' || r.status === 'name');
    if (toImport.length === 0) { toast.error('No rows to import.'); return; }

    setImporting(true);
    const event = events.find((e) => e.id === selectedEventId);
    const pointsEarned = event?.points ?? 1;

    try {
      // Build attendance inserts
      const attendanceRows = toImport.map((r) => ({
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

      // Upsert user_points: fetch existing, add delta, upsert
      const userIds = toImport.map((r) => r.matchedUser!.id);
      const { data: existingPoints } = await supabase
        .from('user_points')
        .select('user_id, points')
        .in('user_id', userIds);
      const existingMap = new Map((existingPoints ?? []).map((p: { user_id: string; points: number }) => [p.user_id, p.points]));

      const pointsUpserts = toImport.map((r) => ({
        user_id: r.matchedUser!.id,
        points: (existingMap.get(r.matchedUser!.id) ?? 0) + pointsEarned,
        last_updated: new Date().toISOString(),
      }));

      const { error: pointsErr } = await supabase
        .from('user_points')
        .upsert(pointsUpserts, { onConflict: 'user_id' });
      if (pointsErr) throw pointsErr;

      toast.success(`Imported ${toImport.length} attendee${toImport.length !== 1 ? 's' : ''}!`);
      setStep('done');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(`Import failed: ${msg}`);
    } finally {
      setImporting(false);
    }
  }

  // ── Render helpers ────────────────────────────────────────────────────────────

  const summary = {
    email: rows.filter((r) => r.status === 'email').length,
    name: rows.filter((r) => r.status === 'name').length,
    none: rows.filter((r) => r.status === 'none').length,
    already: rows.filter((r) => r.status === 'already').length,
  };

  const selectedEvent = events.find((e) => e.id === selectedEventId);

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
              Paste a Google Sheets "Publish to web" CSV link to bulk-assign points from a form response sheet.
            </p>
          </div>

          {/* Steps indicator */}
          <div className="flex items-center gap-3 mb-8">
            {(['configure', 'preview', 'done'] as Step[]).map((s, i) => (
              <div key={s} className="flex items-center gap-2">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold
                  ${step === s ? 'bg-indigo-600 text-white' :
                    (step === 'preview' && s === 'configure') || step === 'done'
                      ? 'bg-green-500 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-500'}`}>
                  {(step === 'preview' && s === 'configure') || (step === 'done' && s !== 'done') ? '✓' : i + 1}
                </div>
                <span className={`text-sm font-medium capitalize
                  ${step === s ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-400 dark:text-gray-500'}`}>
                  {s === 'configure' ? 'Configure' : s === 'preview' ? 'Preview' : 'Done'}
                </span>
                {i < 2 && <div className="w-8 h-px bg-gray-200 dark:bg-gray-700 mx-1" />}
              </div>
            ))}
          </div>

          {/* ── Step 1: Configure ── */}
          {step === 'configure' && (
            <div className="space-y-6 max-w-2xl">
              {/* Event selector */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  Event *
                </label>
                <select
                  value={selectedEventId}
                  onChange={(e) => setSelectedEventId(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700
                    text-gray-900 dark:text-white px-3 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                >
                  <option value="">— Select an event —</option>
                  {events.map((ev) => (
                    <option key={ev.id} value={ev.id}>
                      {ev.name} — {new Date(ev.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} ({ev.points} pts)
                    </option>
                  ))}
                </select>
              </div>

              {/* CSV URL */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  Google Sheets CSV URL *
                </label>
                <input
                  type="url"
                  value={csvUrl}
                  onChange={(e) => setCsvUrl(e.target.value)}
                  placeholder="https://docs.google.com/spreadsheets/d/..."
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700
                    text-gray-900 dark:text-white px-3 py-2.5 text-sm font-mono focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
                <p className="text-xs text-gray-400 mt-1.5 leading-relaxed">
                  In Google Sheets: <strong>File → Share → Publish to web</strong> → choose the sheet → format: CSV → click Publish. Paste the link here.
                  <br />
                  Or paste the normal edit URL — we'll convert it automatically.
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
                  <>
                    <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                    </svg>
                    Fetching…
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    Fetch & Preview
                  </>
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
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Email column</label>
                    <select value={emailCol} onChange={(e) => setEmailCol(e.target.value)}
                      className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700
                        text-gray-900 dark:text-white text-xs px-2 py-1.5 focus:ring-2 focus:ring-indigo-500 focus:border-transparent">
                      <option value="">(none)</option>
                      {csvHeaders.map((h) => <option key={h} value={h}>{h}</option>)}
                    </select>
                  </div>
                  <div className="flex items-end gap-2">
                    <label className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 cursor-pointer select-none">
                      <input type="checkbox" checked={useFullName} onChange={(e) => setUseFullName(e.target.checked)} className="rounded" />
                      Use full name column
                    </label>
                  </div>
                  {useFullName ? (
                    <div>
                      <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Full name column</label>
                      <select value={fullNameCol} onChange={(e) => setFullNameCol(e.target.value)}
                        className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700
                          text-gray-900 dark:text-white text-xs px-2 py-1.5 focus:ring-2 focus:ring-indigo-500 focus:border-transparent">
                        <option value="">(none)</option>
                        {csvHeaders.map((h) => <option key={h} value={h}>{h}</option>)}
                      </select>
                    </div>
                  ) : (
                    <>
                      <div>
                        <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">First name column</label>
                        <select value={firstNameCol} onChange={(e) => setFirstNameCol(e.target.value)}
                          className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700
                            text-gray-900 dark:text-white text-xs px-2 py-1.5 focus:ring-2 focus:ring-indigo-500 focus:border-transparent">
                          <option value="">(none)</option>
                          {csvHeaders.map((h) => <option key={h} value={h}>{h}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Last name column</label>
                        <select value={lastNameCol} onChange={(e) => setLastNameCol(e.target.value)}
                          className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700
                            text-gray-900 dark:text-white text-xs px-2 py-1.5 focus:ring-2 focus:ring-indigo-500 focus:border-transparent">
                          <option value="">(none)</option>
                          {csvHeaders.map((h) => <option key={h} value={h}>{h}</option>)}
                        </select>
                      </div>
                    </>
                  )}
                </div>
                <button onClick={handleRematch} disabled={fetchingCsv}
                  className="mt-3 text-xs text-indigo-600 dark:text-indigo-400 hover:underline disabled:opacity-50">
                  {fetchingCsv ? 'Re-matching…' : 'Re-run matching with these columns →'}
                </button>
              </div>

              {/* Summary badges */}
              <div className="flex flex-wrap gap-3">
                <span className="inline-flex items-center gap-1.5 text-sm px-3 py-1 rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 font-medium">
                  <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />
                  {summary.email} email match{summary.email !== 1 ? 'es' : ''}
                </span>
                <span className="inline-flex items-center gap-1.5 text-sm px-3 py-1 rounded-full bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 font-medium">
                  <span className="w-2 h-2 rounded-full bg-yellow-400 inline-block" />
                  {summary.name} fuzzy name match{summary.name !== 1 ? 'es' : ''}
                </span>
                <span className="inline-flex items-center gap-1.5 text-sm px-3 py-1 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 font-medium">
                  <span className="w-2 h-2 rounded-full bg-gray-400 inline-block" />
                  {summary.already} already imported
                </span>
                <span className="inline-flex items-center gap-1.5 text-sm px-3 py-1 rounded-full bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 font-medium">
                  <span className="w-2 h-2 rounded-full bg-red-400 inline-block" />
                  {summary.none} no match
                </span>
              </div>

              {selectedEvent && (
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Will assign <strong>{selectedEvent.points} point{selectedEvent.points !== 1 ? 's' : ''}</strong> per attendee for <strong>{selectedEvent.name}</strong>.
                </p>
              )}

              {/* Preview table */}
              <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700 text-sm">
                  <thead>
                    <tr className="bg-gray-50 dark:bg-gray-900/50">
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">CSV Name</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">CSV Email</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Matched Member</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Confidence</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-100 dark:divide-gray-700">
                    {rows.map((row, i) => (
                      <tr key={i} className={
                        row.status === 'email' ? 'bg-green-50/40 dark:bg-green-900/10' :
                        row.status === 'name' ? 'bg-yellow-50/40 dark:bg-yellow-900/10' :
                        row.status === 'already' ? 'bg-gray-50/60 dark:bg-gray-900/20' :
                        'bg-red-50/40 dark:bg-red-900/10'
                      }>
                        <td className="px-4 py-2.5 whitespace-nowrap">
                          {row.status === 'email' && (
                            <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700 dark:text-green-400">
                              <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" /> Email
                            </span>
                          )}
                          {row.status === 'name' && (
                            <span className="inline-flex items-center gap-1 text-xs font-medium text-yellow-700 dark:text-yellow-400">
                              <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 inline-block" /> Fuzzy
                            </span>
                          )}
                          {row.status === 'already' && (
                            <span className="inline-flex items-center gap-1 text-xs font-medium text-gray-500 dark:text-gray-400">
                              <span className="w-1.5 h-1.5 rounded-full bg-gray-400 inline-block" /> Already
                            </span>
                          )}
                          {row.status === 'none' && (
                            <span className="inline-flex items-center gap-1 text-xs font-medium text-red-600 dark:text-red-400">
                              <span className="w-1.5 h-1.5 rounded-full bg-red-400 inline-block" /> No match
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-gray-900 dark:text-white font-medium">
                          {row.displayName || <span className="text-gray-400 italic">—</span>}
                        </td>
                        <td className="px-4 py-2.5 text-gray-500 dark:text-gray-400 font-mono text-xs">
                          {row.csvEmail || <span className="italic">—</span>}
                        </td>
                        <td className="px-4 py-2.5 text-gray-700 dark:text-gray-300">
                          {row.matchedUser ? (
                            <span>
                              {row.matchedUser.first_name} {row.matchedUser.last_name}
                              <span className="ml-1.5 text-gray-400 dark:text-gray-500 text-xs font-mono">
                                ({row.matchedUser.email})
                              </span>
                            </span>
                          ) : (
                            <span className="text-gray-400 italic">—</span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-gray-500 dark:text-gray-400 text-xs">
                          {row.status === 'email' && '100% (email)'}
                          {row.status === 'name' && `${row.score ?? '?'}%`}
                          {row.status === 'already' && (
                            row.matchedUser
                              ? (row.score ? `${row.score}%` : '100%')
                              : '—'
                          )}
                          {row.status === 'none' && '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Legend */}
              <p className="text-xs text-gray-400 dark:text-gray-500">
                <strong>Email</strong> rows are imported. <strong>Fuzzy</strong> rows are imported (≥70% name similarity). <strong>Already</strong> and <strong>No match</strong> rows are skipped.
              </p>

              {/* Action buttons */}
              <div className="flex items-center gap-3 pt-2">
                <button
                  onClick={handleImport}
                  disabled={importing || (summary.email + summary.name) === 0}
                  className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700
                    disabled:bg-indigo-300 dark:disabled:bg-indigo-800
                    text-white font-medium px-5 py-2.5 rounded-lg text-sm transition-colors"
                >
                  {importing ? (
                    <>
                      <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                      </svg>
                      Importing…
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                      Import {summary.email + summary.name} attendee{(summary.email + summary.name) !== 1 ? 's' : ''}
                    </>
                  )}
                </button>
                <button
                  onClick={() => { setStep('configure'); setRows([]); }}
                  className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 px-3 py-2.5"
                >
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
              <p className="text-gray-500 dark:text-gray-400 text-sm mb-8">
                Attendance and points have been recorded.
              </p>
              <div className="flex items-center justify-center gap-3">
                <button
                  onClick={() => { setStep('configure'); setRows([]); setCsvUrl(''); setSelectedEventId(''); }}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium px-5 py-2.5 rounded-lg text-sm transition-colors"
                >
                  Import another sheet
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
