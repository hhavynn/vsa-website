import { FormEvent, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { programContentRepository } from '../../../data/repos/programContent';
import { useAllProgramContent } from '../../../hooks/useProgramContent';
import {
  ProgramContent,
  ProgramContentStatus,
  ProgramPageKey,
  ProgramSectionKey,
} from '../../../types';

type Target = {
  page_key: ProgramPageKey;
  section_key: ProgramSectionKey;
  label: string;
  description: string;
  defaultTitle: string;
  display_order: number;
};

type FormState = {
  title: string;
  body: string;
  status: ProgramContentStatus;
  primary_link_label: string;
  primary_link_url: string;
  secondary_link_label: string;
  secondary_link_url: string;
  open_at: string;
  close_at: string;
  deadline_at: string;
  event_date: string;
  venue: string;
  is_published: boolean;
  source_doc_url: string;
  internal_notes: string;
};

const TARGETS: Target[] = [
  {
    page_key: 'ace',
    section_key: 'current_cycle',
    label: 'ACE Current Cycle',
    description: 'Application status, cycle label, form link, and deadline for /ace.',
    defaultTitle: 'Spring 2026 Cycle',
    display_order: 10,
  },
  {
    page_key: 'intern',
    section_key: 'current_cycle',
    label: 'Intern Current Cycle',
    description: 'Application status, form link, and deadline for /intern-program.',
    defaultTitle: 'Current Intern Cycle',
    display_order: 20,
  },
  {
    page_key: 'house',
    section_key: 'current_cycle',
    label: 'House Current Cycle / Reveal',
    description: 'Application or reveal status for /house-system. House names stay in code for this phase.',
    defaultTitle: 'Current House Cycle',
    display_order: 30,
  },
  {
    page_key: 'wnc',
    section_key: 'current_cycle',
    label: "WNC Current Event",
    description: "Event status, date, venue, and ticket link for /wild-n-culture.",
    defaultTitle: "Current Wild N' Culture Event",
    display_order: 40,
  },
];

const inputCls = 'mt-1 block w-full rounded border px-3 py-2 text-sm focus:outline-none focus:border-brand-600 focus:ring-1 focus:ring-brand-600/20 font-sans';
const labelCls = 'block text-[11px] font-semibold uppercase tracking-[0.07em]';
const fieldStyle = {
  borderColor: 'var(--color-border)',
  background: 'var(--color-surface)',
  color: 'var(--color-text)',
};

function toInputDateTime(value: string | null | undefined) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

function fromInputDateTime(value: string) {
  return value ? new Date(value).toISOString() : null;
}

function emptyForm(target: Target): FormState {
  return {
    title: target.defaultTitle,
    body: '',
    status: 'hidden',
    primary_link_label: '',
    primary_link_url: '',
    secondary_link_label: '',
    secondary_link_url: '',
    open_at: '',
    close_at: '',
    deadline_at: '',
    event_date: '',
    venue: '',
    is_published: false,
    source_doc_url: '',
    internal_notes: '',
  };
}

function formFromContent(content: ProgramContent | undefined, target: Target): FormState {
  if (!content) return emptyForm(target);
  return {
    title: content.title ?? target.defaultTitle,
    body: content.body ?? '',
    status: content.status,
    primary_link_label: content.primary_link_label ?? '',
    primary_link_url: content.primary_link_url ?? '',
    secondary_link_label: content.secondary_link_label ?? '',
    secondary_link_url: content.secondary_link_url ?? '',
    open_at: toInputDateTime(content.open_at),
    close_at: toInputDateTime(content.close_at),
    deadline_at: toInputDateTime(content.deadline_at),
    event_date: toInputDateTime(content.event_date),
    venue: content.venue ?? '',
    is_published: content.is_published,
    source_doc_url: content.source_doc_url ?? '',
    internal_notes: content.internal_notes ?? '',
  };
}

function nullable(value: string) {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function ProgramContentManager() {
  const { content, loading, error, refetch } = useAllProgramContent();
  const [selectedKey, setSelectedKey] = useState(TARGETS[0].page_key);
  const selectedTarget = TARGETS.find((target) => target.page_key === selectedKey) ?? TARGETS[0];
  const selectedContent = useMemo(
    () =>
      content.find(
        (item) =>
          item.page_key === selectedTarget.page_key &&
          item.section_key === selectedTarget.section_key,
      ),
    [content, selectedTarget.page_key, selectedTarget.section_key],
  );
  const [form, setForm] = useState<FormState>(() => emptyForm(selectedTarget));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setForm(formFromContent(selectedContent, selectedTarget));
  }, [selectedContent, selectedTarget]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();

    try {
      setSaving(true);
      await programContentRepository.upsertContent({
        page_key: selectedTarget.page_key,
        section_key: selectedTarget.section_key,
        title: nullable(form.title),
        body: nullable(form.body),
        status: form.status,
        primary_link_label: nullable(form.primary_link_label),
        primary_link_url: nullable(form.primary_link_url),
        secondary_link_label: nullable(form.secondary_link_label),
        secondary_link_url: nullable(form.secondary_link_url),
        open_at: fromInputDateTime(form.open_at),
        close_at: fromInputDateTime(form.close_at),
        deadline_at: fromInputDateTime(form.deadline_at),
        event_date: fromInputDateTime(form.event_date),
        venue: nullable(form.venue),
        is_published: form.is_published,
        display_order: selectedTarget.display_order,
        source_doc_url: nullable(form.source_doc_url),
        internal_notes: nullable(form.internal_notes),
      });
      await refetch();
      toast.success('Program content saved');
    } catch (err) {
      console.error(err);
      toast.error('Failed to save program content');
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="mt-8 border rounded overflow-hidden" style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}>
      <div className="border-b px-5 py-4" style={{ borderColor: 'var(--color-border)' }}>
        <h2 className="font-sans font-semibold text-sm" style={{ color: 'var(--color-text)' }}>
          Program Status Content
        </h2>
        <p className="mt-1 font-sans text-xs" style={{ color: 'var(--color-text2)' }}>
          Edit only volatile application, reveal, ticket, and deadline content. Public pages keep their existing layouts.
        </p>
      </div>

      {error ? (
        <div className="px-5 py-8 font-sans text-sm" style={{ color: 'var(--color-text3)' }}>
          Program content could not be loaded. Apply the program_content migration before editing.
        </div>
      ) : (
        <div className="grid gap-0 xl:grid-cols-[280px_minmax(0,1fr)]">
          <div className="border-b xl:border-b-0 xl:border-r" style={{ borderColor: 'var(--color-border)' }}>
            {TARGETS.map((target) => {
              const active = target.page_key === selectedTarget.page_key;
              const row = content.find((item) => item.page_key === target.page_key && item.section_key === target.section_key);
              return (
                <button
                  key={target.page_key}
                  type="button"
                  onClick={() => setSelectedKey(target.page_key)}
                  className="block w-full border-b px-5 py-4 text-left transition-opacity hover:opacity-80 last:border-b-0"
                  style={{
                    borderColor: 'var(--color-border)',
                    background: active ? 'var(--color-surface2)' : 'transparent',
                  }}
                >
                  <div className="font-sans text-sm font-medium" style={{ color: 'var(--color-text)' }}>
                    {target.label}
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-2 font-sans text-[11px]" style={{ color: 'var(--color-text3)' }}>
                    <span>{row?.status ?? 'hidden'}</span>
                    {row?.is_published && <span className="text-brand-600 dark:text-brand-400">Published</span>}
                  </div>
                </button>
              );
            })}
          </div>

          <form onSubmit={handleSubmit} className="space-y-5 p-5">
            <div>
              <h3 className="font-sans text-sm font-semibold" style={{ color: 'var(--color-text)' }}>
                {selectedTarget.label}
              </h3>
              <p className="mt-1 font-sans text-xs" style={{ color: 'var(--color-text2)' }}>
                {selectedTarget.description}
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className={labelCls} style={{ color: 'var(--color-text3)' }}>Status</label>
                <select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as ProgramContentStatus })} className={inputCls} style={fieldStyle}>
                  <option value="hidden">Hidden</option>
                  <option value="coming_soon">Coming Soon</option>
                  <option value="open">Open</option>
                  <option value="closed">Closed</option>
                  <option value="active">Active</option>
                </select>
              </div>
              <div className="flex items-end">
                <label className="flex items-center gap-2 font-sans text-sm" style={{ color: 'var(--color-text2)' }}>
                  <input type="checkbox" checked={form.is_published} onChange={(event) => setForm({ ...form, is_published: event.target.checked })} />
                  Published
                </label>
              </div>
              <div>
                <label className={labelCls} style={{ color: 'var(--color-text3)' }}>Title / Cycle Label</label>
                <input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} className={inputCls} style={fieldStyle} disabled={loading} />
              </div>
              <div>
                <label className={labelCls} style={{ color: 'var(--color-text3)' }}>Venue</label>
                <input value={form.venue} onChange={(event) => setForm({ ...form, venue: event.target.value })} className={inputCls} style={fieldStyle} disabled={loading} />
              </div>
            </div>

            <div>
              <label className={labelCls} style={{ color: 'var(--color-text3)' }}>Body / Notice</label>
              <textarea value={form.body} onChange={(event) => setForm({ ...form, body: event.target.value })} className={`${inputCls} min-h-[88px]`} style={fieldStyle} disabled={loading} />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className={labelCls} style={{ color: 'var(--color-text3)' }}>Primary Link Label</label>
                <input value={form.primary_link_label} onChange={(event) => setForm({ ...form, primary_link_label: event.target.value })} className={inputCls} style={fieldStyle} disabled={loading} />
              </div>
              <div>
                <label className={labelCls} style={{ color: 'var(--color-text3)' }}>Primary Link URL</label>
                <input type="url" value={form.primary_link_url} onChange={(event) => setForm({ ...form, primary_link_url: event.target.value })} className={inputCls} style={fieldStyle} disabled={loading} />
              </div>
              <div>
                <label className={labelCls} style={{ color: 'var(--color-text3)' }}>Secondary Link Label</label>
                <input value={form.secondary_link_label} onChange={(event) => setForm({ ...form, secondary_link_label: event.target.value })} className={inputCls} style={fieldStyle} disabled={loading} />
              </div>
              <div>
                <label className={labelCls} style={{ color: 'var(--color-text3)' }}>Secondary Link URL</label>
                <input type="url" value={form.secondary_link_url} onChange={(event) => setForm({ ...form, secondary_link_url: event.target.value })} className={inputCls} style={fieldStyle} disabled={loading} />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <div>
                <label className={labelCls} style={{ color: 'var(--color-text3)' }}>Opens At</label>
                <input type="datetime-local" value={form.open_at} onChange={(event) => setForm({ ...form, open_at: event.target.value })} className={inputCls} style={fieldStyle} disabled={loading} />
              </div>
              <div>
                <label className={labelCls} style={{ color: 'var(--color-text3)' }}>Closes At</label>
                <input type="datetime-local" value={form.close_at} onChange={(event) => setForm({ ...form, close_at: event.target.value })} className={inputCls} style={fieldStyle} disabled={loading} />
              </div>
              <div>
                <label className={labelCls} style={{ color: 'var(--color-text3)' }}>Deadline At</label>
                <input type="datetime-local" value={form.deadline_at} onChange={(event) => setForm({ ...form, deadline_at: event.target.value })} className={inputCls} style={fieldStyle} disabled={loading} />
              </div>
              <div>
                <label className={labelCls} style={{ color: 'var(--color-text3)' }}>Event Date</label>
                <input type="datetime-local" value={form.event_date} onChange={(event) => setForm({ ...form, event_date: event.target.value })} className={inputCls} style={fieldStyle} disabled={loading} />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className={labelCls} style={{ color: 'var(--color-text3)' }}>Source Doc URL</label>
                <input type="url" value={form.source_doc_url} onChange={(event) => setForm({ ...form, source_doc_url: event.target.value })} className={inputCls} style={fieldStyle} disabled={loading} />
                <p className="mt-1 font-sans text-xs" style={{ color: 'var(--color-text3)' }}>
                  Admin-only. Public pages never select or render this field.
                </p>
              </div>
              <div>
                <label className={labelCls} style={{ color: 'var(--color-text3)' }}>Internal Notes</label>
                <textarea value={form.internal_notes} onChange={(event) => setForm({ ...form, internal_notes: event.target.value })} className={`${inputCls} min-h-[88px]`} style={fieldStyle} disabled={loading} />
              </div>
            </div>

            <button type="submit" disabled={saving || loading} className="rounded px-5 py-2 text-sm font-medium disabled:opacity-50" style={{ background: 'var(--color-text)', color: 'var(--color-bg)' }}>
              {saving ? 'Saving...' : 'Save Program Content'}
            </button>
          </form>
        </div>
      )}
    </section>
  );
}
