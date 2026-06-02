import { FormEvent, useEffect, useMemo, useState } from 'react';
import { PageTitle } from '../../components/common/PageTitle';
import {
  AI_KNOWLEDGE_SOURCE_TYPES,
  AiKnowledgeSnippet,
  AiKnowledgeSourceType,
  aiKnowledgeRepository,
} from '../../data/repos/aiKnowledge';

type StatusFilter = 'all' | 'active' | 'inactive';
type SortMode = 'priority' | 'updated';

interface SnippetFormState {
  title: string;
  category: string;
  content: string;
  tags: string;
  priority: string;
  source_type: AiKnowledgeSourceType;
  source_url: string;
  last_verified_date: string;
  is_active: boolean;
}

const DEFAULT_FORM: SnippetFormState = {
  title: '',
  category: 'general',
  content: '',
  tags: '',
  priority: '0',
  source_type: 'manual',
  source_url: '',
  last_verified_date: '',
  is_active: true,
};

function formatDate(value: string | null | undefined) {
  if (!value) return 'Not verified';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Not verified';
  return date.toLocaleDateString();
}

function toDateInput(value: string | null | undefined) {
  if (!value) return '';
  return value.slice(0, 10);
}

function toFormState(snippet: AiKnowledgeSnippet): SnippetFormState {
  return {
    title: snippet.title ?? '',
    category: snippet.category ?? 'general',
    content: snippet.content ?? '',
    tags: (snippet.tags ?? []).join(', '),
    priority: String(snippet.priority ?? 0),
    source_type: snippet.source_type ?? 'manual',
    source_url: snippet.source_url ?? '',
    last_verified_date: toDateInput(snippet.last_verified_at),
    is_active: snippet.is_active,
  };
}

function parseTags(value: string) {
  return value
    .split(',')
    .map(tag => tag.trim())
    .filter(Boolean);
}

function toTimestamp(value: string) {
  if (!value) return null;
  return new Date(`${value}T12:00:00`).toISOString();
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
  const [sortMode, setSortMode] = useState<SortMode>('priority');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [successText, setSuccessText] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  useEffect(() => {
    let mounted = true;

    async function loadSnippets() {
      setLoading(true);
      setErrorText(null);
      try {
        const data = await aiKnowledgeRepository.listAdminSnippets();
        if (!mounted) return;
        setSnippets(data);
        if (data.length > 0) {
          setSelectedId(data[0].id);
          setForm(toFormState(data[0]));
        }
      } catch (error) {
        if (!mounted) return;
        setErrorText(error instanceof Error ? error.message : 'Failed to load Ask VSA knowledge snippets.');
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

  const filteredSnippets = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();

    return snippets
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
        ]
          .join(' ')
          .toLowerCase();
        return haystack.includes(query);
      })
      .sort((a, b) => {
        if (sortMode === 'priority') {
          const byPriority = (b.priority ?? 0) - (a.priority ?? 0);
          if (byPriority !== 0) return byPriority;
        }
        return Date.parse(b.updated_at ?? '') - Date.parse(a.updated_at ?? '');
      });
  }, [categoryFilter, searchTerm, snippets, sortMode, statusFilter]);

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
      last_verified_at: toTimestamp(form.last_verified_date),
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
    } catch (error) {
      setErrorText(error instanceof Error ? error.message : 'Failed to save Ask VSA knowledge snippet.');
    } finally {
      setSaving(false);
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
      setErrorText(error instanceof Error ? error.message : 'Failed to update Ask VSA knowledge status.');
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
          </div>
          <button
            type="button"
            onClick={startNewSnippet}
            className="inline-flex w-fit rounded-lg bg-[var(--brand)] px-4 py-2.5 font-sans text-[13px] font-semibold text-white transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600"
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
                            </div>
                            <h3 className="mt-2 line-clamp-2 font-sans text-sm font-semibold leading-snug" style={{ color: 'var(--color-text)' }}>
                              {snippet.title}
                            </h3>
                          </div>
                          <span className="shrink-0 rounded border px-2 py-1 font-mono text-[11px] font-bold" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text2)' }}>
                            {snippet.priority}
                          </span>
                        </div>
                        <p className="mt-2 line-clamp-2 font-sans text-xs leading-relaxed" style={{ color: 'var(--color-text2)' }}>
                          {snippet.content}
                        </p>
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
                  className="rounded-lg bg-[var(--brand)] px-5 py-2.5 font-sans text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
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
