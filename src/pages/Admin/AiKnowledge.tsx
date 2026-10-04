import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useQueryClient } from 'react-query';
import { Link } from 'react-router-dom';
import { PageTitle } from '../../components/common/PageTitle';
import { FilterChips } from '../../components/features/admin/ops';
import { FreshnessBadge, FreshnessCard } from '../../components/features/admin/KnowledgeFreshness';
import { toUserMessage } from '../../data/errors';
import {
  AI_KNOWLEDGE_CONFIDENCE_LEVELS,
  AI_KNOWLEDGE_FRESHNESS_LEVELS,
  AI_KNOWLEDGE_SOURCE_TYPES,
  AiKnowledgeConfidence,
  AiKnowledgeEntityContext,
  AiKnowledgeFreshness,
  AiKnowledgeLinkedEntityType,
  AiKnowledgeReview,
  AiKnowledgeSnippet,
  AiKnowledgeSourceType,
  aiKnowledgeRepository,
} from '../../data/repos/aiKnowledge';
import { academicTermsRepository } from '../../data/repos/academicTerms';
import { useUrlFilter } from '../../hooks/useUrlFilter';
import { QuickFilter, applyQuickFilter, countByFilter } from '../../lib/adminFilters';
import { ADMIN_HEALTH_QUERY_KEYS } from '../../lib/adminHealthQuery';
import { getAcademicTermMeta } from '../../lib/academicTerms';
import { compareByUrgency, evaluateAllKnowledge } from '../../lib/aiKnowledgeFreshness';
import { APPLICATION_KEY_OPTIONS } from '../../lib/applicationLinks';

type StatusFilter = 'all' | 'active' | 'inactive';
type SortMode = 'priority' | 'updated' | 'urgency';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Reads the results the page computed (see `results` below), so the chip counts and the list agree.
type Reviewable = { snippet: AiKnowledgeSnippet; needsReview: boolean };
const FRESHNESS_FILTERS: ReadonlyArray<QuickFilter<Reviewable>> = [
  { key: 'all', label: 'All', predicate: () => true },
  { key: 'review', label: 'Needs review', hint: 'Stale, expired, or due for another look', predicate: (row) => row.needsReview },
  { key: 'current', label: 'Current', predicate: (row) => !row.needsReview },
];
const FRESHNESS_FILTER_KEYS = FRESHNESS_FILTERS.map((filter) => filter.key);

interface SnippetFormState {
  title: string;
  category: string;
  content: string;
  tags: string;
  aliases: string;
  priority: string;
  source_type: AiKnowledgeSourceType;
  source_url: string;
  confidence: AiKnowledgeConfidence;
  freshness: AiKnowledgeFreshness;
  academic_year: string;
  valid_until_date: string;
  last_verified_date: string;
  linked_entity_type: AiKnowledgeLinkedEntityType | '';
  linked_entity_key: string;
  is_active: boolean;
}

const DEFAULT_FORM: SnippetFormState = {
  title: '',
  category: 'general',
  content: '',
  tags: '',
  aliases: '',
  priority: '0',
  source_type: 'manual',
  source_url: '',
  confidence: 'high',
  freshness: 'stable',
  academic_year: '',
  valid_until_date: '',
  last_verified_date: '',
  linked_entity_type: '',
  linked_entity_key: '',
  is_active: true,
};

function formatDate(value: string | null | undefined) {
  if (!value) return 'Not verified';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Not verified';
  return date.toLocaleDateString();
}

// Every date on this page is a Pacific-time calendar date, like the rest of the site, so
// opening and saving a snippet from any timezone never shifts a review or expiry date.
const SITE_TIMEZONE = 'America/Los_Angeles';

function pacificDate(ms: number) {
  return new Date(ms).toLocaleDateString('en-CA', { timeZone: SITE_TIMEZONE });
}

function toDateInput(value: string | null | undefined) {
  if (!value) return '';
  const at = Date.parse(value);
  return Number.isNaN(at) ? '' : pacificDate(at);
}

// valid_until is stored as the start of the day AFTER the last valid day, so the date to show is one tick earlier.
function validUntilToDateInput(value: string | null | undefined) {
  if (!value) return '';
  const at = Date.parse(value);
  return Number.isNaN(at) ? '' : pacificDate(at - 1);
}

function toFormState(snippet: AiKnowledgeSnippet): SnippetFormState {
  return {
    title: snippet.title ?? '',
    category: snippet.category ?? 'general',
    content: snippet.content ?? '',
    tags: (snippet.tags ?? []).join(', '),
    aliases: (snippet.aliases ?? []).join(', '),
    priority: String(snippet.priority ?? 0),
    source_type: snippet.source_type ?? 'manual',
    source_url: snippet.source_url ?? '',
    confidence: snippet.confidence ?? 'high',
    freshness: snippet.freshness ?? 'stable',
    academic_year: snippet.academic_year ?? '',
    valid_until_date: validUntilToDateInput(snippet.valid_until),
    last_verified_date: toDateInput(snippet.last_verified_at),
    linked_entity_type: snippet.linked_entity_type ?? '',
    linked_entity_key: snippet.linked_entity_key ?? '',
    is_active: snippet.is_active,
  };
}

function parseTags(value: string) {
  return value
    .split(',')
    .map(tag => tag.trim())
    .filter(Boolean);
}

// 19:00 UTC is noon in Pacific daylight time and 11:00 in standard time: the same Pacific date either way.
function toTimestamp(value: string) {
  if (!value) return null;
  return new Date(`${value}T19:00:00Z`).toISOString();
}

// valid_until is an expiry boundary (retrieval excludes rows where valid_until <= now()),
// so the snippet should stay valid through the entire selected date rather than expiring
// at noon. Use the start of the next day as the cutoff.
function toEndOfDayTimestamp(value: string) {
  if (!value) return null;
  const [year, month, day] = value.split('-').map(Number);
  const nextDayStart = Date.UTC(year, month - 1, day + 1);
  const nextDate = new Date(nextDayStart).toISOString().slice(0, 10);
  // Midnight Pacific is 07:00 UTC in daylight time and 08:00 UTC in standard time.
  const midnight = [7, 8].map(hour => nextDayStart + hour * 60 * 60 * 1000).find(candidate => pacificDate(candidate) === nextDate);
  return new Date(midnight ?? nextDayStart + 8 * 60 * 60 * 1000).toISOString();
}

function getSafetyWarnings(form: SnippetFormState) {
  const haystack = `${form.content}\n${form.source_url}`;
  const warnings: string[] = [];

  if (/drive\.google\.com/i.test(haystack)) {
    warnings.push('This includes a Google Drive link. Only public website paths or public-safe URLs should be used.');
  }
  if (/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(haystack)) {
    warnings.push('This looks like it includes an email address.');
  }
  if (/\bpayment\b/i.test(haystack)) {
    warnings.push('This mentions payment information.');
  }
  if (/\bcheck-?in code\b|\bcheck in code\b/i.test(haystack)) {
    warnings.push('This mentions check-in codes.');
  }
  if (/\broster\b/i.test(haystack)) {
    warnings.push('This mentions rosters.');
  }

  return warnings;
}

function validateForm(form: SnippetFormState) {
  const errors: string[] = [];
  const priority = Number(form.priority);

  if (form.last_verified_date && form.last_verified_date > pacificDate(Date.now())) errors.push('Last verified date cannot be in the future.');
  if (!form.title.trim()) errors.push('Title is required.');
  if (!form.content.trim()) errors.push('Content is required.');
  if (!form.category.trim()) errors.push('Category is required.');
  if (!Number.isFinite(priority) || priority < -1000 || priority > 1000) {
    errors.push('Priority must be a number between -1000 and 1000.');
  }

  const sourceUrl = form.source_url.trim();
  if (sourceUrl && !sourceUrl.startsWith('/') && !/^https?:\/\//i.test(sourceUrl)) {
    errors.push('Source URL should be a public site path like /events or a full https:// URL.');
  }

  if (form.linked_entity_type && !form.linked_entity_key.trim()) errors.push('Choose what this snippet refers to, or set "Refers to" back to nothing.');
  if (form.linked_entity_type === 'event' && form.linked_entity_key.trim() && !UUID.test(form.linked_entity_key.trim())) {
    errors.push('An event link must be the event\u2019s id (copy it from the event\u2019s page URL in /admin/events).');
  }

  return errors;
}

function StatusBadge({ active }: { active: boolean }) {
  return (
    <span
      className={`rounded-full border px-2.5 py-1 font-sans text-[11px] font-bold ${
        active
          ? 'border-green-200 bg-green-50 text-green-700 dark:border-green-500/40 dark:bg-green-950/30 dark:text-green-300'
          : 'border-zinc-200 bg-zinc-100 text-zinc-600 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-300'
      }`}
    >
      {active ? 'Active' : 'Inactive'}
    </span>
  );
}

export default function AdminAiKnowledge() {
  const [snippets, setSnippets] = useState<AiKnowledgeSnippet[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [form, setForm] = useState<SnippetFormState>(DEFAULT_FORM);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [successText, setSuccessText] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const queryClient = useQueryClient();
  const [now] = useState(() => new Date());
  const [freshnessFilter, setFreshnessFilter] = useUrlFilter(FRESHNESS_FILTER_KEYS);
  // Arriving from a Content Health or Overview link (?filter=review) opens on the most urgent first.
  const [sortMode, setSortMode] = useState<SortMode>(freshnessFilter === 'review' ? 'urgency' : 'priority');
  const [currentYearStart, setCurrentYearStart] = useState<number | null>(null);
  const [entityContext, setEntityContext] = useState<AiKnowledgeEntityContext>({ applications: null, events: null });
  const [reviews, setReviews] = useState<Map<string, AiKnowledgeReview>>(new Map());
  const [reviewing, setReviewing] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function loadSnippets() {
      setLoading(true);
      setErrorText(null);
      try {
        const [data, term, latestReviews] = await Promise.all([
          aiKnowledgeRepository.listAdminSnippets(),
          // `undefined` = the lookup failed, so the year rule is skipped rather than guessed.
          academicTermsRepository.getActiveTerm().catch(() => undefined),
          aiKnowledgeRepository.listLatestReviews(),
        ]);
        if (!mounted) return;
        setSnippets(data);
        setReviews(latestReviews);
        setCurrentYearStart(term === undefined ? null : term?.academic_year_start ?? getAcademicTermMeta(new Date())?.academicYearStart ?? null);
        void aiKnowledgeRepository.loadEntityContext(data).then((context) => mounted && setEntityContext(context));
        if (data.length > 0) {
          setSelectedId(data[0].id);
          setForm(toFormState(data[0]));
        }
      } catch (error) {
        if (!mounted) return;
        console.error(error);
        setErrorText(toUserMessage(error, 'Failed to load Ask VSA knowledge snippets.'));
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadSnippets();
    return () => {
      mounted = false;
    };
  }, []);

  const selectedSnippet = useMemo(
    () => snippets.find(snippet => snippet.id === selectedId) ?? null,
    [snippets, selectedId],
  );

  const categories = useMemo(() => {
    return Array.from(new Set(snippets.map(snippet => snippet.category).filter(Boolean))).sort((a, b) =>
      a.localeCompare(b),
    );
  }, [snippets]);

  const safetyWarnings = useMemo(() => getSafetyWarnings(form), [form]);

  // The same rules the Content Health page and the Overview count use.
  const results = useMemo(
    () => evaluateAllKnowledge(snippets, { now, currentAcademicYearStart: currentYearStart, applications: entityContext.applications, events: entityContext.events }),
    [snippets, now, currentYearStart, entityContext],
  );
  const reviewable = useMemo<Reviewable[]>(
    () => snippets.map((snippet) => ({ snippet, needsReview: (results.get(snippet.id)?.status ?? 'current') !== 'current' })),
    [snippets, results],
  );
  const freshnessCounts = useMemo(() => countByFilter(reviewable, FRESHNESS_FILTERS), [reviewable]);
  const selectedResult = selectedId ? results.get(selectedId) : undefined;
  const selectedReview = useMemo(() => {
    const review = selectedId ? reviews.get(selectedId) : undefined;
    const verified = selectedSnippet?.last_verified_at ? Date.parse(selectedSnippet.last_verified_at) : NaN;
    // Show who only when the log entry is that review, not an older one the date has since been edited past.
    return review && Math.abs(Date.parse(review.reviewedAt) - verified) < 5 * 60 * 1000 ? review : null;
  }, [reviews, selectedId, selectedSnippet]);

  const filteredSnippets = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();

    return applyQuickFilter(reviewable, FRESHNESS_FILTERS, freshnessFilter)
      .map(row => row.snippet)
      .filter(snippet => {
        if (categoryFilter !== 'all' && snippet.category !== categoryFilter) return false;
        if (statusFilter === 'active' && !snippet.is_active) return false;
        if (statusFilter === 'inactive' && snippet.is_active) return false;

        if (!query) return true;
        const haystack = [
          snippet.title,
          snippet.content,
          snippet.category,
          snippet.source_type,
          snippet.source_url ?? '',
          ...(snippet.tags ?? []),
          ...(snippet.aliases ?? []),
        ]
          .join(' ')
          .toLowerCase();
        return haystack.includes(query);
      })
      .sort((a, b) => {
        if (sortMode === 'urgency') {
          const rank = (snippet: AiKnowledgeSnippet) => ({ result: results.get(snippet.id)!, reviewedAt: snippet.last_verified_at ?? snippet.created_at });
          const byUrgency = compareByUrgency(rank(a), rank(b));
          if (byUrgency !== 0) return byUrgency;
        }
        if (sortMode === 'priority') {
          const byPriority = (b.priority ?? 0) - (a.priority ?? 0);
          if (byPriority !== 0) return byPriority;
        }
        return Date.parse(b.updated_at ?? '') - Date.parse(a.updated_at ?? '');
      });
  }, [categoryFilter, freshnessFilter, results, reviewable, searchTerm, sortMode, statusFilter]);

  const activeCount = snippets.filter(snippet => snippet.is_active).length;
  const inactiveCount = snippets.length - activeCount;

  function startNewSnippet() {
    setSelectedId(null);
    setForm(DEFAULT_FORM);
    setValidationErrors([]);
    setErrorText(null);
    setSuccessText(null);
  }

  function selectSnippet(snippet: AiKnowledgeSnippet) {
    setSelectedId(snippet.id);
    setForm(toFormState(snippet));
    setValidationErrors([]);
    setErrorText(null);
    setSuccessText(null);
  }

  function updateForm<Key extends keyof SnippetFormState>(key: Key, value: SnippetFormState[Key]) {
    setForm(current => ({ ...current, [key]: value }));
  }

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const errors = validateForm(form);
    setValidationErrors(errors);
    setSuccessText(null);
    setErrorText(null);

    if (errors.length > 0) return;

    const payload = {
      title: form.title,
      content: form.content,
      category: form.category,
      source_type: form.source_type,
      source_url: form.source_url,
      is_active: form.is_active,
      priority: Number(form.priority),
      tags: parseTags(form.tags),
      aliases: parseTags(form.aliases),
      confidence: form.confidence,
      freshness: form.freshness,
      academic_year: form.academic_year,
      valid_until: toEndOfDayTimestamp(form.valid_until_date),
      // Saving other edits must not re-stamp the review date; only an edit to the date field does.
      last_verified_at:
        !selectedSnippet || form.last_verified_date !== toDateInput(selectedSnippet.last_verified_at) ? toTimestamp(form.last_verified_date) : undefined,
      // Named only when there is a link to set or clear, so snippets with no link never touch the column.
      ...(form.linked_entity_type || selectedSnippet?.linked_entity_type
        ? { linked_entity_type: form.linked_entity_type || null, linked_entity_key: form.linked_entity_type ? form.linked_entity_key.trim() : null }
        : {}),
    };

    setSaving(true);
    try {
      const saved = selectedSnippet
        ? await aiKnowledgeRepository.updateSnippet(selectedSnippet.id, payload)
        : await aiKnowledgeRepository.createSnippet(payload);

      setSnippets(current => {
        const exists = current.some(snippet => snippet.id === saved.id);
        if (exists) return current.map(snippet => (snippet.id === saved.id ? saved : snippet));
        return [saved, ...current];
      });
      setSelectedId(saved.id);
      setForm(toFormState(saved));
      setSuccessText(selectedSnippet ? 'Knowledge snippet saved.' : 'Knowledge snippet created.');
      void aiKnowledgeRepository.loadEntityContext([saved]).then((context) =>
        setEntityContext((current) => ({
          applications: context.applications ?? current.applications,
          events: context.events === null ? current.events : Array.from(new Map([...(current.events ?? []), ...context.events].map((event) => [event.id, event])).values()),
        })),
      );
      void queryClient.invalidateQueries(ADMIN_HEALTH_QUERY_KEYS.all);
    } catch (error) {
      console.error(error);
      setErrorText(toUserMessage(error, 'Failed to save Ask VSA knowledge snippet.'));
    } finally {
      setSaving(false);
    }
  }

  async function handleMarkReviewed() {
    if (!selectedSnippet) return;
    setReviewing(true);
    setErrorText(null);
    setSuccessText(null);
    try {
      const updated = await aiKnowledgeRepository.markReviewed(selectedSnippet);
      setSnippets(current => current.map(snippet => (snippet.id === updated.id ? updated : snippet)));
      // Only the review date moves: unsaved edits in the form stay as they are.
      updateForm('last_verified_date', toDateInput(updated.last_verified_at));
      setReviews(current => new Map(current).set(updated.id, { reviewedAt: updated.last_verified_at ?? new Date().toISOString(), reviewer: 'you' }));
      void queryClient.invalidateQueries(ADMIN_HEALTH_QUERY_KEYS.all);
      setSuccessText('Marked as reviewed. The text was not changed.');
    } catch (error) {
      console.error(error);
      setErrorText(toUserMessage(error, 'Failed to mark this snippet as reviewed.'));
    } finally {
      setReviewing(false);
    }
  }

  async function handleSetActive(isActive: boolean) {
    if (!selectedSnippet) return;
    setSaving(true);
    setErrorText(null);
    setSuccessText(null);

    try {
      const updated = await aiKnowledgeRepository.setSnippetActive(selectedSnippet.id, isActive);
      setSnippets(current => current.map(snippet => (snippet.id === updated.id ? updated : snippet)));
      setSelectedId(updated.id);
      setForm(toFormState(updated));
      setSuccessText(isActive ? 'Knowledge snippet reactivated.' : 'Knowledge snippet deactivated.');
    } catch (error) {
      console.error(error);
      setErrorText(toUserMessage(error, 'Failed to update Ask VSA knowledge status.'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <PageTitle title="Ask VSA Knowledge" />

      <div className="border-b px-6 py-6 sm:px-8 sm:py-8" style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}>
        <div className="flex max-w-6xl flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="font-mono text-[10px] font-bold uppercase tracking-[0.14em]" style={{ color: 'var(--color-text3)' }}>
              Ask VSA assistant
            </p>
            <h1 className="mt-2 font-serif text-3xl font-bold tracking-tight sm:text-4xl" style={{ color: 'var(--color-text)' }}>
              Ask VSA Knowledge
            </h1>
            <p className="mt-2 max-w-3xl font-sans text-sm leading-relaxed" style={{ color: 'var(--color-text2)' }}>
              Manage the public-safe facts Ask VSA can use. Do not add rosters, emails, payment info, check-in logs, or private Drive links.
            </p>
            <div className="mt-4 flex max-w-3xl items-start gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 font-sans text-[11px] leading-5 text-blue-900 dark:border-blue-900/30 dark:bg-blue-900/10 dark:text-blue-300">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="mt-0.5 h-4 w-4 shrink-0">
                <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
              </svg>
              <p>
                <strong>Tip:</strong> Review the <Link to="/admin/ai-feedback" className="underline hover:text-blue-700 dark:hover:text-blue-200">Ask VSA Feedback</Link> page regularly to see which questions are missing from this knowledge base. Ensure topics like joining VSA, ACE, House, Intern Program, VCN, and Points are well-covered.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={startNewSnippet}
            className="inline-flex w-fit rounded-lg bg-[var(--brand)] px-4 py-2.5 font-sans text-[13px] font-semibold text-[var(--color-on-brand)] transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600"
          >
            New snippet
          </button>
        </div>
      </div>

      <div className="p-4 sm:p-6 lg:p-8">
        <div className="mb-6 rounded-lg border px-4 py-3" style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}>
          <p className="font-sans text-sm font-semibold" style={{ color: 'var(--color-text)' }}>
            Safety reminder
          </p>
          <p className="mt-1 font-sans text-xs leading-relaxed" style={{ color: 'var(--color-text2)' }}>
            Only add information safe for general members. Do not paste private Google Drive links, rosters, payment info, or check-in data.
          </p>
        </div>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
          <section className="scrapbook-paper overflow-hidden" style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}>
            <div className="border-b p-4 sm:p-5" style={{ borderColor: 'var(--color-border)' }}>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="font-serif text-xl font-bold" style={{ color: 'var(--color-text)' }}>
                    Knowledge snippets
                  </h2>
                  <p className="mt-1 font-sans text-xs" style={{ color: 'var(--color-text3)' }}>
                    {activeCount} active, {inactiveCount} inactive
                  </p>
                </div>
                {loading && (
                  <span className="font-sans text-xs" style={{ color: 'var(--color-text3)' }}>
                    Loading...
                  </span>
                )}
              </div>

              <div className="mt-4 space-y-3">
                <FilterChips filters={FRESHNESS_FILTERS} counts={freshnessCounts} active={freshnessFilter} onChange={setFreshnessFilter} label="Filter by freshness" />
                <label className="block">
                  <span className="sr-only">Search snippets</span>
                  <input
                    type="search"
                    value={searchTerm}
                    onChange={event => setSearchTerm(event.target.value)}
                    placeholder="Search title, content, or tags..."
                    className="w-full rounded-lg border bg-[var(--color-surface2)] px-3 py-2.5 font-sans text-sm outline-none transition-colors placeholder:text-[var(--color-text3)] focus:border-[var(--accent)] focus:bg-[var(--color-surface)]"
                    style={{ borderColor: 'var(--color-border)', color: 'var(--color-text)' }}
                  />
                </label>

                <div className="grid gap-2 sm:grid-cols-3 xl:grid-cols-1 2xl:grid-cols-3">
                  <label className="block">
                    <span className="mb-1 block font-sans text-[11px] font-semibold" style={{ color: 'var(--color-text3)' }}>
                      Category
                    </span>
                    <select
                      value={categoryFilter}
                      onChange={event => setCategoryFilter(event.target.value)}
                      className="w-full rounded-lg border bg-[var(--color-surface2)] px-3 py-2 font-sans text-xs outline-none focus:border-[var(--accent)]"
                      style={{ borderColor: 'var(--color-border)', color: 'var(--color-text)' }}
                    >
                      <option value="all">All categories</option>
                      {categories.map(category => (
                        <option key={category} value={category}>
                          {category}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="block">
                    <span className="mb-1 block font-sans text-[11px] font-semibold" style={{ color: 'var(--color-text3)' }}>
                      Status
                    </span>
                    <select
                      value={statusFilter}
                      onChange={event => setStatusFilter(event.target.value as StatusFilter)}
                      className="w-full rounded-lg border bg-[var(--color-surface2)] px-3 py-2 font-sans text-xs outline-none focus:border-[var(--accent)]"
                      style={{ borderColor: 'var(--color-border)', color: 'var(--color-text)' }}
                    >
                      <option value="all">All</option>
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                    </select>
                  </label>

                  <label className="block">
                    <span className="mb-1 block font-sans text-[11px] font-semibold" style={{ color: 'var(--color-text3)' }}>
                      Sort
                    </span>
                    <select
                      value={sortMode}
                      onChange={event => setSortMode(event.target.value as SortMode)}
                      className="w-full rounded-lg border bg-[var(--color-surface2)] px-3 py-2 font-sans text-xs outline-none focus:border-[var(--accent)]"
                      style={{ borderColor: 'var(--color-border)', color: 'var(--color-text)' }}
                    >
                      <option value="priority">Priority</option>
                      <option value="updated">Updated date</option>
                      <option value="urgency">Most urgent first</option>
                    </select>
                  </label>
                </div>
              </div>
            </div>

            <div className="max-h-[720px] overflow-y-auto p-3">
              {errorText && snippets.length === 0 ? (
                <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 font-sans text-sm text-rose-800 dark:border-rose-500/40 dark:bg-rose-950/30 dark:text-rose-200">
                  {errorText}
                </div>
              ) : filteredSnippets.length === 0 ? (
                <div className="rounded-lg border border-dashed p-6 text-center" style={{ borderColor: 'var(--color-border)' }}>
                  <h3 className="font-sans text-sm font-semibold" style={{ color: 'var(--color-text)' }}>
                    No snippets found
                  </h3>
                  <p className="mt-2 font-sans text-xs leading-relaxed" style={{ color: 'var(--color-text2)' }}>
                    Try a different search or filter, or create a new public-safe snippet.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredSnippets.map(snippet => {
                    const selected = snippet.id === selectedId;
                    return (
                      <button
                        key={snippet.id}
                        type="button"
                        onClick={() => selectSnippet(snippet)}
                        className="w-full rounded-lg border p-3 text-left transition-colors hover:bg-[var(--color-surface2)]"
                        style={{
                          borderColor: selected ? 'var(--accent)' : 'var(--color-border)',
                          background: selected ? 'var(--color-surface2)' : 'var(--color-surface)',
                        }}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="rounded-full border px-2 py-0.5 font-sans text-[10px] font-bold uppercase tracking-[0.08em]" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text3)' }}>
                                {snippet.category}
                              </span>
                              <StatusBadge active={snippet.is_active} />
                              <FreshnessBadge result={results.get(snippet.id)} />
                            </div>
                            <h3 className="mt-2 line-clamp-2 font-sans text-sm font-semibold leading-snug" style={{ color: 'var(--color-text)' }}>
                              {snippet.title}
                            </h3>
                          </div>
                          <span className="shrink-0 rounded border px-2 py-1 font-mono text-[11px] font-bold" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text2)' }}>
                            {snippet.priority}
                          </span>
                        </div>
                        {results.get(snippet.id)?.headline ? (
                          <p className="mt-2 font-sans text-xs font-semibold leading-relaxed text-[var(--color-text)]">{results.get(snippet.id)?.headline}</p>
                        ) : (
                          <p className="mt-2 line-clamp-2 font-sans text-xs leading-relaxed" style={{ color: 'var(--color-text2)' }}>
                            {snippet.content}
                          </p>
                        )}
                        <div className="mt-3 flex flex-wrap gap-2 font-sans text-[11px]" style={{ color: 'var(--color-text3)' }}>
                          <span>Verified: {formatDate(snippet.last_verified_at)}</span>
                          <span>Updated: {formatDate(snippet.updated_at)}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </section>

          <section className="scrapbook-paper overflow-hidden" style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}>
            <div className="border-b p-4 sm:p-5" style={{ borderColor: 'var(--color-border)' }}>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h2 className="font-serif text-xl font-bold" style={{ color: 'var(--color-text)' }}>
                    {selectedSnippet ? 'Edit snippet' : 'Create snippet'}
                  </h2>
                  <p className="mt-1 font-sans text-xs leading-relaxed" style={{ color: 'var(--color-text2)' }}>
                    These facts can appear in Ask VSA answers when they are active and public-safe.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge active={form.is_active} />
                  {selectedSnippet && (
                    <button
                      type="button"
                      onClick={() => handleSetActive(!selectedSnippet.is_active)}
                      disabled={saving}
                      className="rounded-lg border px-3 py-2 font-sans text-xs font-semibold transition-colors hover:bg-[var(--color-surface2)] disabled:cursor-not-allowed disabled:opacity-60"
                      style={{ borderColor: 'var(--color-border)', color: 'var(--color-text2)' }}
                    >
                      {selectedSnippet.is_active ? 'Deactivate' : 'Reactivate'}
                    </button>
                  )}
                </div>
              </div>
            </div>

            {selectedSnippet && (
              <FreshnessCard
                result={selectedResult}
                lastVerifiedAt={selectedSnippet.last_verified_at}
                reviewer={selectedReview?.reviewer ?? null}
                validUntil={selectedSnippet.valid_until}
                busy={reviewing}
                onMarkReviewed={handleMarkReviewed}
              />
            )}

            <form onSubmit={handleSave} className="space-y-5 p-4 sm:p-5">
              {(errorText || successText || validationErrors.length > 0 || safetyWarnings.length > 0) && (
                <div className="space-y-3">
                  {errorText && snippets.length > 0 && (
                    <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 font-sans text-sm text-rose-800 dark:border-rose-500/40 dark:bg-rose-950/30 dark:text-rose-200">
                      {errorText}
                    </div>
                  )}
                  {successText && (
                    <div className="rounded-lg border border-green-200 bg-green-50 p-3 font-sans text-sm text-green-800 dark:border-green-500/40 dark:bg-green-950/30 dark:text-green-200">
                      {successText}
                    </div>
                  )}
                  {validationErrors.length > 0 && (
                    <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 font-sans text-sm text-rose-800 dark:border-rose-500/40 dark:bg-rose-950/30 dark:text-rose-200">
                      <p className="font-semibold">Fix these fields before saving:</p>
                      <ul className="mt-2 list-disc space-y-1 pl-5">
                        {validationErrors.map(error => (
                          <li key={error}>{error}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {safetyWarnings.length > 0 && (
                    <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 font-sans text-sm text-amber-900 dark:border-amber-500/40 dark:bg-amber-950/30 dark:text-amber-100">
                      <p className="font-semibold">Review before saving:</p>
                      <ul className="mt-2 list-disc space-y-1 pl-5">
                        {safetyWarnings.map(warning => (
                          <li key={warning}>{warning}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              <div className="grid gap-4 md:grid-cols-2">
                <label className="block md:col-span-2">
                  <span className="mb-1.5 block font-sans text-xs font-semibold" style={{ color: 'var(--color-text2)' }}>
                    Title
                  </span>
                  <input
                    value={form.title}
                    onChange={event => updateForm('title', event.target.value)}
                    className="w-full rounded-lg border bg-[var(--color-surface2)] px-3 py-2.5 font-sans text-sm outline-none focus:border-[var(--accent)]"
                    style={{ borderColor: 'var(--color-border)', color: 'var(--color-text)' }}
                    placeholder="Example: How House points work"
                  />
                </label>

                <label className="block">
                  <span className="mb-1.5 block font-sans text-xs font-semibold" style={{ color: 'var(--color-text2)' }}>
                    Category
                  </span>
                  <input
                    value={form.category}
                    onChange={event => updateForm('category', event.target.value)}
                    list="ai-knowledge-categories"
                    className="w-full rounded-lg border bg-[var(--color-surface2)] px-3 py-2.5 font-sans text-sm outline-none focus:border-[var(--accent)]"
                    style={{ borderColor: 'var(--color-border)', color: 'var(--color-text)' }}
                    placeholder="general"
                  />
                  <datalist id="ai-knowledge-categories">
                    {categories.map(category => (
                      <option key={category} value={category} />
                    ))}
                  </datalist>
                </label>

                <label className="block">
                  <span className="mb-1.5 block font-sans text-xs font-semibold" style={{ color: 'var(--color-text2)' }}>
                    Source type
                  </span>
                  <select
                    value={form.source_type}
                    onChange={event => updateForm('source_type', event.target.value as AiKnowledgeSourceType)}
                    className="w-full rounded-lg border bg-[var(--color-surface2)] px-3 py-2.5 font-sans text-sm outline-none focus:border-[var(--accent)]"
                    style={{ borderColor: 'var(--color-border)', color: 'var(--color-text)' }}
                  >
                    {AI_KNOWLEDGE_SOURCE_TYPES.map(sourceType => (
                      <option key={sourceType} value={sourceType}>
                        {sourceType}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block md:col-span-2">
                  <span className="mb-1.5 block font-sans text-xs font-semibold" style={{ color: 'var(--color-text2)' }}>
                    Content
                  </span>
                  <textarea
                    value={form.content}
                    onChange={event => updateForm('content', event.target.value)}
                    rows={9}
                    className="w-full resize-y rounded-lg border bg-[var(--color-surface2)] px-3 py-2.5 font-sans text-sm leading-6 outline-none focus:border-[var(--accent)]"
                    style={{ borderColor: 'var(--color-border)', color: 'var(--color-text)' }}
                    placeholder="Write one public-safe fact Ask VSA can use."
                  />
                </label>

                <label className="block">
                  <span className="mb-1.5 block font-sans text-xs font-semibold" style={{ color: 'var(--color-text2)' }}>
                    Priority
                  </span>
                  <input
                    type="number"
                    min={-1000}
                    max={1000}
                    value={form.priority}
                    onChange={event => updateForm('priority', event.target.value)}
                    className="w-full rounded-lg border bg-[var(--color-surface2)] px-3 py-2.5 font-sans text-sm outline-none focus:border-[var(--accent)]"
                    style={{ borderColor: 'var(--color-border)', color: 'var(--color-text)' }}
                  />
                </label>

                <label className="block">
                  <span className="mb-1.5 block font-sans text-xs font-semibold" style={{ color: 'var(--color-text2)' }}>
                    Last verified date
                  </span>
                  <input
                    type="date"
                    value={form.last_verified_date}
                    onChange={event => updateForm('last_verified_date', event.target.value)}
                    className="w-full rounded-lg border bg-[var(--color-surface2)] px-3 py-2.5 font-sans text-sm outline-none focus:border-[var(--accent)]"
                    style={{ borderColor: 'var(--color-border)', color: 'var(--color-text)' }}
                  />
                </label>

                <label className="block md:col-span-2">
                  <span className="mb-1.5 block font-sans text-xs font-semibold" style={{ color: 'var(--color-text2)' }}>
                    Tags
                  </span>
                  <input
                    value={form.tags}
                    onChange={event => updateForm('tags', event.target.value)}
                    className="w-full rounded-lg border bg-[var(--color-surface2)] px-3 py-2.5 font-sans text-sm outline-none focus:border-[var(--accent)]"
                    style={{ borderColor: 'var(--color-border)', color: 'var(--color-text)' }}
                    placeholder="points, leaderboard, events"
                  />
                  <p className="mt-1.5 font-sans text-[11px]" style={{ color: 'var(--color-text3)' }}>
                    Separate tags with commas.
                  </p>
                </label>

                <label className="block md:col-span-2">
                  <span className="mb-1.5 block font-sans text-xs font-semibold" style={{ color: 'var(--color-text2)' }}>
                    Aliases
                  </span>
                  <input
                    value={form.aliases}
                    onChange={event => updateForm('aliases', event.target.value)}
                    className="w-full rounded-lg border bg-[var(--color-surface2)] px-3 py-2.5 font-sans text-sm outline-none focus:border-[var(--accent)]"
                    style={{ borderColor: 'var(--color-border)', color: 'var(--color-text)' }}
                    placeholder="eoyb, banquet, end of year banquet"
                  />
                  <p className="mt-1.5 font-sans text-[11px]" style={{ color: 'var(--color-text3)' }}>
                    Comma-separated nicknames, acronyms, and question phrasings that should retrieve this snippet. Aliases are the strongest retrieval signal after the title.
                  </p>
                </label>

                <label className="block">
                  <span className="mb-1.5 block font-sans text-xs font-semibold" style={{ color: 'var(--color-text2)' }}>
                    Confidence
                  </span>
                  <select
                    value={form.confidence}
                    onChange={event => updateForm('confidence', event.target.value as AiKnowledgeConfidence)}
                    className="w-full rounded-lg border bg-[var(--color-surface2)] px-3 py-2.5 font-sans text-sm outline-none focus:border-[var(--accent)]"
                    style={{ borderColor: 'var(--color-border)', color: 'var(--color-text)' }}
                  >
                    {AI_KNOWLEDGE_CONFIDENCE_LEVELS.map(level => (
                      <option key={level} value={level}>
                        {level}
                      </option>
                    ))}
                  </select>
                  <p className="mt-1.5 font-sans text-[11px]" style={{ color: 'var(--color-text3)' }}>
                    Medium/low makes Ask VSA use uncertainty language.
                  </p>
                </label>

                <label className="block">
                  <span className="mb-1.5 block font-sans text-xs font-semibold" style={{ color: 'var(--color-text2)' }}>
                    Freshness
                  </span>
                  <select
                    value={form.freshness}
                    onChange={event => updateForm('freshness', event.target.value as AiKnowledgeFreshness)}
                    className="w-full rounded-lg border bg-[var(--color-surface2)] px-3 py-2.5 font-sans text-sm outline-none focus:border-[var(--accent)]"
                    style={{ borderColor: 'var(--color-border)', color: 'var(--color-text)' }}
                  >
                    {AI_KNOWLEDGE_FRESHNESS_LEVELS.map(level => (
                      <option key={level} value={level}>
                        {level}
                      </option>
                    ))}
                  </select>
                  <p className="mt-1.5 font-sans text-[11px]" style={{ color: 'var(--color-text3)' }}>
                    How often this fact needs review (stable, yearly, quarterly, event_live).
                  </p>
                </label>

                <label className="block">
                  <span className="mb-1.5 block font-sans text-xs font-semibold" style={{ color: 'var(--color-text2)' }}>
                    Academic year
                  </span>
                  <input
                    value={form.academic_year}
                    onChange={event => updateForm('academic_year', event.target.value)}
                    className="w-full rounded-lg border bg-[var(--color-surface2)] px-3 py-2.5 font-sans text-sm outline-none focus:border-[var(--accent)]"
                    style={{ borderColor: 'var(--color-border)', color: 'var(--color-text)' }}
                    placeholder="2025-2026"
                  />
                  <p className="mt-1.5 font-sans text-[11px]" style={{ color: 'var(--color-text3)' }}>
                    Set for year-specific facts so Ask VSA labels them by year. Leave blank for evergreen facts.
                  </p>
                </label>

                <label className="block">
                  <span className="mb-1.5 block font-sans text-xs font-semibold" style={{ color: 'var(--color-text2)' }}>
                    Valid until
                  </span>
                  <input
                    type="date"
                    value={form.valid_until_date}
                    onChange={event => updateForm('valid_until_date', event.target.value)}
                    className="w-full rounded-lg border bg-[var(--color-surface2)] px-3 py-2.5 font-sans text-sm outline-none focus:border-[var(--accent)]"
                    style={{ borderColor: 'var(--color-border)', color: 'var(--color-text)' }}
                  />
                  <p className="mt-1.5 font-sans text-[11px]" style={{ color: 'var(--color-text3)' }}>
                    Optional expiry. After this date the snippet stays saved but retrieval skips it automatically.
                  </p>
                </label>

                <label className="block">
                  <span className="mb-1.5 block font-sans text-xs font-semibold" style={{ color: 'var(--color-text2)' }}>
                    Refers to
                  </span>
                  <select
                    value={form.linked_entity_type}
                    onChange={event => setForm(current => ({ ...current, linked_entity_type: event.target.value as SnippetFormState['linked_entity_type'], linked_entity_key: '' }))}
                    className="w-full rounded-lg border bg-[var(--color-surface2)] px-3 py-2.5 font-sans text-sm outline-none focus:border-[var(--accent)]"
                    style={{ borderColor: 'var(--color-border)', color: 'var(--color-text)' }}
                  >
                    <option value="">Nothing in particular</option>
                    <option value="application">An application window</option>
                    <option value="event">A published event</option>
                  </select>
                  <p className="mt-1.5 font-sans text-[11px]" style={{ color: 'var(--color-text3)' }}>
                    Optional. Lets Content Health flag this snippet when that window or event changes. It never copies anything from it.
                  </p>
                </label>

                {form.linked_entity_type && (
                  <label className="block">
                    <span className="mb-1.5 block font-sans text-xs font-semibold" style={{ color: 'var(--color-text2)' }}>
                      {form.linked_entity_type === 'application' ? 'Application window' : 'Event id'}
                    </span>
                    {form.linked_entity_type === 'application' ? (
                      <select
                        value={form.linked_entity_key}
                        onChange={event => updateForm('linked_entity_key', event.target.value)}
                        className="w-full rounded-lg border bg-[var(--color-surface2)] px-3 py-2.5 font-sans text-sm outline-none focus:border-[var(--accent)]"
                        style={{ borderColor: 'var(--color-border)', color: 'var(--color-text)' }}
                      >
                        <option value="">Choose a window…</option>
                        {APPLICATION_KEY_OPTIONS.map(option => (
                          <option key={option.key} value={option.key}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        value={form.linked_entity_key}
                        onChange={event => updateForm('linked_entity_key', event.target.value)}
                        className="w-full rounded-lg border bg-[var(--color-surface2)] px-3 py-2.5 font-mono text-xs outline-none focus:border-[var(--accent)]"
                        style={{ borderColor: 'var(--color-border)', color: 'var(--color-text)' }}
                        placeholder="00000000-0000-0000-0000-000000000000"
                      />
                    )}
                    {form.linked_entity_type === 'event' && (
                      <p className="mt-1.5 font-sans text-[11px]" style={{ color: 'var(--color-text3)' }}>
                        The event must be published. Ask VSA never describes a draft event.
                      </p>
                    )}
                  </label>
                )}

                <label className="block md:col-span-2">
                  <span className="mb-1.5 block font-sans text-xs font-semibold" style={{ color: 'var(--color-text2)' }}>
                    Source URL
                  </span>
                  <input
                    value={form.source_url}
                    onChange={event => updateForm('source_url', event.target.value)}
                    className="w-full rounded-lg border bg-[var(--color-surface2)] px-3 py-2.5 font-sans text-sm outline-none focus:border-[var(--accent)]"
                    style={{ borderColor: 'var(--color-border)', color: 'var(--color-text)' }}
                    placeholder="/events"
                  />
                </label>
              </div>

              <label className="flex items-start gap-3 rounded-lg border p-3" style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface2)' }}>
                <input
                  type="checkbox"
                  checked={form.is_active}
                  onChange={event => updateForm('is_active', event.target.checked)}
                  className="mt-1 h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-600"
                />
                <span>
                  <span className="block font-sans text-sm font-semibold" style={{ color: 'var(--color-text)' }}>
                    Active in Ask VSA
                  </span>
                  <span className="mt-1 block font-sans text-xs leading-relaxed" style={{ color: 'var(--color-text2)' }}>
                    Inactive snippets stay saved for admins, but the assistant retrieval function will not use them.
                  </span>
                </span>
              </label>

              <div className="flex flex-col-reverse gap-3 border-t pt-5 sm:flex-row sm:items-center sm:justify-between" style={{ borderColor: 'var(--color-border)' }}>
                <button
                  type="button"
                  onClick={selectedSnippet ? () => selectSnippet(selectedSnippet) : startNewSnippet}
                  disabled={saving}
                  className="rounded-lg border px-4 py-2.5 font-sans text-sm font-semibold transition-colors hover:bg-[var(--color-surface2)] disabled:cursor-not-allowed disabled:opacity-60"
                  style={{ borderColor: 'var(--color-border)', color: 'var(--color-text2)' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-lg bg-[var(--brand)] px-5 py-2.5 font-sans text-sm font-semibold text-[var(--color-on-brand)] transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {saving ? 'Saving...' : 'Save'}
                </button>
              </div>
            </form>
          </section>
        </div>
      </div>
    </div>
  );
}
