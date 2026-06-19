import { FormEvent, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useQueryClient } from 'react-query';
import { PageTitle } from '../../components/common/PageTitle';
import { PageLoader } from '../../components/common/PageLoader';
import { PageError } from '../../components/common/PageError';
import {
  ADMIN_APPLICATION_LINKS_QUERY_KEY,
  PUBLIC_APPLICATION_LINKS_QUERY_KEY,
  useAdminApplicationLinks,
} from '../../hooks/useApplicationLinks';
import {
  ApplicationLinkFormData,
  applicationLinksRepository,
} from '../../data/repos/applicationLinks';
import {
  APPLICATION_KEY_OPTIONS,
  APPLICATION_STATUS_LABELS,
  DEFAULT_APPLICATION_MESSAGES,
  applicationKeyLabel,
  combineLocalDateTime,
  formatApplicationDateTime,
  getApplicationStatus,
  splitLocalDateTime,
} from '../../lib/applicationLinks';
import { ApplicationKey, ApplicationLink, ApplicationStatus } from '../../types';

type FormState = {
  application_key: ApplicationKey;
  title: string;
  description: string;
  button_label: string;
  target_url: string;
  open_date: string;
  open_time: string;
  due_date: string;
  due_time: string;
  is_enabled: boolean;
  before_open_message: string;
  after_close_message: string;
  sort_order: string;
};

type StatusFilter = 'all' | ApplicationStatus;

const inputCls =
  'mt-1 block w-full rounded border px-3 py-2 text-sm font-sans focus:outline-none focus:border-[var(--brand)] focus:ring-1 focus:ring-[var(--brand)]/20';
const labelCls = 'block font-mono text-[10px] font-bold uppercase tracking-[0.1em]';

function fieldStyle() {
  return {
    borderColor: 'var(--color-border)',
    background: 'var(--color-surface)',
    color: 'var(--color-text)',
  } as const;
}

function emptyForm(): FormState {
  const firstKey = APPLICATION_KEY_OPTIONS[0].key;
  return {
    application_key: firstKey,
    title: applicationKeyLabel(firstKey),
    description: '',
    button_label: 'Apply Now',
    target_url: '',
    open_date: '',
    open_time: '00:00',
    due_date: '',
    due_time: '23:59',
    is_enabled: false,
    before_open_message: DEFAULT_APPLICATION_MESSAGES[firstKey].before,
    after_close_message: DEFAULT_APPLICATION_MESSAGES[firstKey].after,
    sort_order: '0',
  };
}

function formFromLink(link: ApplicationLink): FormState {
  const open = splitLocalDateTime(link.open_at);
  const due = splitLocalDateTime(link.due_at);
  return {
    application_key: link.application_key,
    title: link.title,
    description: link.description ?? '',
    button_label: link.button_label,
    target_url: link.target_url,
    open_date: open.date,
    open_time: open.time,
    due_date: due.date,
    due_time: due.time,
    is_enabled: link.is_enabled,
    before_open_message: link.before_open_message ?? '',
    after_close_message: link.after_close_message ?? '',
    sort_order: String(link.sort_order),
  };
}

function statusBadgeColor(status: ApplicationStatus): string {
  switch (status) {
    case 'open':
      return 'var(--brand)';
    case 'not_open':
      return '#d97706';
    case 'closed':
      return 'var(--color-text3)';
    default:
      return 'var(--color-text3)';
  }
}

export default function AdminApplications() {
  const queryClient = useQueryClient();
  const { links, loading, error, refetch } = useAdminApplicationLinks();
  const [selected, setSelected] = useState<ApplicationLink | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [keyFilter, setKeyFilter] = useState<'all' | ApplicationKey>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  const visibleLinks = useMemo(() => {
    const now = new Date();
    return links.filter((link) => {
      if (keyFilter !== 'all' && link.application_key !== keyFilter) return false;
      if (statusFilter !== 'all') {
        const status = getApplicationStatus(link.open_at, link.due_at, link.is_enabled, now);
        if (status !== statusFilter) return false;
      }
      return true;
    });
  }, [links, keyFilter, statusFilter]);

  const counts = useMemo(() => {
    const now = new Date();
    const acc = { open: 0, not_open: 0, closed: 0, disabled: 0 };
    links.forEach((link) => {
      acc[getApplicationStatus(link.open_at, link.due_at, link.is_enabled, now)] += 1;
    });
    return acc;
  }, [links]);

  const resetForm = () => {
    setSelected(null);
    setForm(emptyForm());
  };

  const selectLink = (link: ApplicationLink) => {
    setSelected(link);
    setForm(formFromLink(link));
  };

  const onKeyChange = (key: ApplicationKey) => {
    setForm((prev) => ({
      ...prev,
      application_key: key,
      // Refresh defaults only when the admin hasn't customized them.
      title:
        !prev.title || prev.title === applicationKeyLabel(prev.application_key)
          ? applicationKeyLabel(key)
          : prev.title,
      before_open_message:
        !prev.before_open_message ||
        prev.before_open_message === DEFAULT_APPLICATION_MESSAGES[prev.application_key].before
          ? DEFAULT_APPLICATION_MESSAGES[key].before
          : prev.before_open_message,
      after_close_message:
        !prev.after_close_message ||
        prev.after_close_message === DEFAULT_APPLICATION_MESSAGES[prev.application_key].after
          ? DEFAULT_APPLICATION_MESSAGES[key].after
          : prev.after_close_message,
    }));
  };

  const refresh = async () => {
    await queryClient.invalidateQueries(ADMIN_APPLICATION_LINKS_QUERY_KEY);
    await queryClient.invalidateQueries(PUBLIC_APPLICATION_LINKS_QUERY_KEY);
    await refetch();
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();

    if (!form.title.trim()) return toast.error('Title is required');
    if (!form.button_label.trim()) return toast.error('Button label is required');
    if (!form.target_url.trim()) return toast.error('Target URL is required');
    if (!/^https:\/\//i.test(form.target_url.trim()))
      return toast.error('Target URL must start with https://');
    if (!form.open_date) return toast.error('Open date is required');
    if (!form.due_date) return toast.error('Due date is required');

    const openIso = combineLocalDateTime(form.open_date, form.open_time, '00:00');
    const dueIso = combineLocalDateTime(form.due_date, form.due_time, '23:59');
    if (!openIso || !dueIso) return toast.error('Invalid open or due date');
    if (new Date(dueIso).getTime() <= new Date(openIso).getTime())
      return toast.error('Due date/time must be after the open date/time');

    if (/drive\.google\.com/i.test(form.target_url)) {
      const ok = window.confirm(
        'This looks like a Google Drive link. Confirm it is shared publicly and safe to expose to the public when the window is open.',
      );
      if (!ok) return;
    }

    const payload: ApplicationLinkFormData = {
      application_key: form.application_key,
      title: form.title.trim(),
      description: form.description.trim() || null,
      button_label: form.button_label.trim(),
      target_url: form.target_url.trim(),
      open_at: openIso,
      due_at: dueIso,
      is_enabled: form.is_enabled,
      before_open_message: form.before_open_message.trim() || null,
      after_close_message: form.after_close_message.trim() || null,
      sort_order: Number(form.sort_order) || 0,
    };

    try {
      setSaving(true);
      if (selected) {
        await applicationLinksRepository.updateApplicationLink(selected.id, payload);
        toast.success('Application link updated');
      } else {
        await applicationLinksRepository.createApplicationLink(payload);
        toast.success('Application link created');
      }
      resetForm();
      await refresh();
    } catch (err) {
      console.error(err);
      toast.error('Failed to save application link');
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (link: ApplicationLink) => {
    try {
      await applicationLinksRepository.setApplicationLinkEnabled(link.id, !link.is_enabled);
      toast.success(link.is_enabled ? 'Disabled' : 'Enabled');
      await refresh();
    } catch (err) {
      console.error(err);
      toast.error('Failed to update status');
    }
  };

  const handleDelete = async (link: ApplicationLink) => {
    if (
      !window.confirm(
        `Delete "${link.title}"? Disabling is usually safer than deleting. This cannot be undone.`,
      )
    )
      return;
    try {
      await applicationLinksRepository.deleteApplicationLink(link.id);
      toast.success('Application link deleted');
      if (selected?.id === link.id) resetForm();
      await refresh();
    } catch (err) {
      console.error(err);
      toast.error('Failed to delete application link');
    }
  };

  if (loading) {
    return (
      <div className="flex-1 overflow-y-auto">
        <PageTitle title="Admin Applications" />
        <PageLoader message="Loading application links..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 overflow-y-auto">
        <PageTitle title="Admin Applications" />
        <PageError message="Failed to load application links" />
      </div>
    );
  }

  const now = new Date();

  return (
    <div className="flex-1 overflow-y-auto">
      <PageTitle title="Admin Applications" />

      <div
        className="border-b px-5 py-5 sm:flex sm:items-center sm:justify-between sm:gap-4 sm:px-8 sm:py-7"
        style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}
      >
        <div>
          <h1 className="font-serif text-3xl font-bold tracking-tight sm:text-4xl" style={{ color: 'var(--color-text)' }}>
            Applications
          </h1>
          <p className="mt-1 font-sans text-xs" style={{ color: 'var(--color-text2)' }}>
            {counts.open} open · {counts.not_open} upcoming · {counts.closed} closed · {counts.disabled} disabled.
            Public pages only show a button while a window is open.
          </p>
        </div>
        <button
          type="button"
          onClick={resetForm}
          className="mt-4 inline-flex items-center gap-2 rounded border px-3 py-2 font-sans text-xs font-medium transition-colors sm:mt-0"
          style={{ borderColor: 'var(--color-border)', color: 'var(--color-text2)', background: 'transparent' }}
        >
          New Application Link
        </button>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(340px,440px)]" style={{ padding: '20px 28px' }}>
        <main className="min-w-0 space-y-4">
          <section aria-label="Filter application windows" className="rounded-md border p-4" style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor="application-type-filter" className={labelCls} style={{ color: 'var(--color-text3)' }}>Application type</label>
                <select id="application-type-filter" value={keyFilter} onChange={(e) => setKeyFilter(e.target.value as 'all' | ApplicationKey)} className={inputCls} style={fieldStyle()}>
                  <option value="all">All types</option>
                  {APPLICATION_KEY_OPTIONS.map((o) => (
                    <option key={o.key} value={o.key}>{o.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="application-status-filter" className={labelCls} style={{ color: 'var(--color-text3)' }}>Status</label>
                <select id="application-status-filter" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as StatusFilter)} className={inputCls} style={fieldStyle()}>
                  <option value="all">All statuses</option>
                  <option value="open">Open</option>
                  <option value="not_open">Not open yet</option>
                  <option value="closed">Closed</option>
                  <option value="disabled">Disabled</option>
                </select>
              </div>
            </div>
          </section>

          <section aria-labelledby="application-window-list-title" className="rounded-md border" style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}>
            <div className="flex items-center justify-between gap-3 border-b px-4 py-3" style={{ borderColor: 'var(--color-border)' }}>
              <h2 id="application-window-list-title" aria-live="polite" className="font-sans text-sm font-semibold" style={{ color: 'var(--color-text)' }}>
                {visibleLinks.length} application window{visibleLinks.length === 1 ? '' : 's'}
              </h2>
            </div>

            {visibleLinks.length === 0 ? (
              <div className="px-5 py-12 text-center">
                <p className="font-sans text-sm font-medium" style={{ color: 'var(--color-text)' }}>No application windows</p>
                <p className="mt-1 font-sans text-xs" style={{ color: 'var(--color-text3)' }}>
                  Create one, or adjust the filters.
                </p>
              </div>
            ) : (
              <div className="divide-y" style={{ borderColor: 'var(--color-border)' }}>
                {visibleLinks.map((link) => {
                  const status = getApplicationStatus(link.open_at, link.due_at, link.is_enabled, now);
                  const hasUrl = !!link.target_url && /^https:\/\//i.test(link.target_url);
                  return (
                    <article
                      key={link.id}
                      className="px-4 py-4"
                      style={{ background: selected?.id === link.id ? 'var(--color-surface2)' : 'transparent' }}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="font-sans text-sm font-semibold" style={{ color: 'var(--color-text)' }}>{link.title}</h3>
                            <span className="rounded border px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.08em]" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text3)' }}>
                              {applicationKeyLabel(link.application_key)}
                            </span>
                          </div>
                          <p className="mt-1 font-sans text-xs" style={{ color: 'var(--color-text3)' }}>
                            Button: “{link.button_label}” · {hasUrl ? 'URL set' : 'No URL'}
                          </p>
                          <p className="mt-1 font-sans text-xs" style={{ color: 'var(--color-text3)' }}>
                            Opens {formatApplicationDateTime(link.open_at) || '—'} · Closes {formatApplicationDateTime(link.due_at) || '—'}
                          </p>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <span className="rounded px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-[0.08em]" style={{ color: statusBadgeColor(status) }}>
                            {APPLICATION_STATUS_LABELS[status]}
                          </span>
                          <span className="font-mono text-[10px]" style={{ color: link.is_enabled ? 'var(--brand)' : 'var(--color-text3)' }}>
                            {link.is_enabled ? 'Enabled' : 'Disabled'}
                          </span>
                        </div>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button type="button" onClick={() => selectLink(link)} className="rounded border px-2.5 py-1.5 font-sans text-xs" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text2)' }}>
                          Edit
                        </button>
                        <button type="button" onClick={() => handleToggle(link)} className="rounded border px-2.5 py-1.5 font-sans text-xs" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text2)' }}>
                          {link.is_enabled ? 'Disable' : 'Enable'}
                        </button>
                        <button type="button" onClick={() => handleDelete(link)} className="rounded border px-2.5 py-1.5 font-sans text-xs" style={{ borderColor: 'var(--color-border)', color: '#dc2626' }}>
                          Delete
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        </main>

        <aside className="h-fit rounded-md border p-5" style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}>
          <div className="mb-5 flex items-start justify-between gap-4">
            <div>
              <h2 id="application-window-editor-title" className="font-sans text-base font-semibold" style={{ color: 'var(--color-text)' }}>
                {selected ? 'Edit Application Link' : 'Add Application Link'}
              </h2>
              <p className="mt-1 font-sans text-xs" style={{ color: 'var(--color-text2)' }}>
                The public button only appears while the window is open.
              </p>
            </div>
            {selected && (
              <button type="button" onClick={resetForm} className="font-sans text-xs" style={{ color: 'var(--color-text3)' }}>
                Clear
              </button>
            )}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4" aria-labelledby="application-window-editor-title">
            <div>
              <label htmlFor="application-key" className={labelCls} style={{ color: 'var(--color-text3)' }}>Application type *</label>
              <select id="application-key" aria-required="true" value={form.application_key} onChange={(e) => onKeyChange(e.target.value as ApplicationKey)} className={inputCls} style={fieldStyle()}>
                {APPLICATION_KEY_OPTIONS.map((o) => (
                  <option key={o.key} value={o.key}>{o.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="application-title" className={labelCls} style={{ color: 'var(--color-text3)' }}>Title *</label>
              <input id="application-title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className={inputCls} style={fieldStyle()} required />
            </div>
            <div>
              <label htmlFor="application-button-label" className={labelCls} style={{ color: 'var(--color-text3)' }}>Button label *</label>
              <input id="application-button-label" value={form.button_label} onChange={(e) => setForm({ ...form, button_label: e.target.value })} className={inputCls} style={fieldStyle()} required />
            </div>
            <div>
              <label htmlFor="application-target-url" className={labelCls} style={{ color: 'var(--color-text3)' }}>Target URL *</label>
              <input id="application-target-url" type="url" aria-required="true" aria-describedby="application-target-url-help" value={form.target_url} onChange={(e) => setForm({ ...form, target_url: e.target.value })} className={inputCls} style={fieldStyle()} placeholder="https://forms.gle/..." />
              <p id="application-target-url-help" className="mt-1 font-sans text-[11px]" style={{ color: 'var(--color-text3)' }}>
                Must start with https://. Only exposed publicly while the window is open.
              </p>
            </div>
            <div>
              <label htmlFor="application-description" className={labelCls} style={{ color: 'var(--color-text3)' }}>Description</label>
              <textarea id="application-description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className={`${inputCls} min-h-[60px]`} style={fieldStyle()} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="application-open-date" className={labelCls} style={{ color: 'var(--color-text3)' }}>Open date *</label>
                <input id="application-open-date" type="date" aria-required="true" aria-describedby="application-schedule-help" value={form.open_date} onChange={(e) => setForm({ ...form, open_date: e.target.value })} className={inputCls} style={fieldStyle()} />
              </div>
              <div>
                <label htmlFor="application-open-time" className={labelCls} style={{ color: 'var(--color-text3)' }}>Open time</label>
                <input id="application-open-time" type="time" aria-describedby="application-schedule-help" value={form.open_time} onChange={(e) => setForm({ ...form, open_time: e.target.value })} className={inputCls} style={fieldStyle()} />
              </div>
              <div>
                <label htmlFor="application-due-date" className={labelCls} style={{ color: 'var(--color-text3)' }}>Due date *</label>
                <input id="application-due-date" type="date" aria-required="true" aria-describedby="application-schedule-help" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} className={inputCls} style={fieldStyle()} />
              </div>
              <div>
                <label htmlFor="application-due-time" className={labelCls} style={{ color: 'var(--color-text3)' }}>Due time</label>
                <input id="application-due-time" type="time" aria-describedby="application-schedule-help" value={form.due_time} onChange={(e) => setForm({ ...form, due_time: e.target.value })} className={inputCls} style={fieldStyle()} />
              </div>
            </div>
            <p id="application-schedule-help" className="font-sans text-[11px]" style={{ color: 'var(--color-text3)' }}>
              Open date can be in the past. Due time defaults to 11:59 PM unless you change it.
            </p>
            <div>
              <label htmlFor="application-before-open-message" className={labelCls} style={{ color: 'var(--color-text3)' }}>Before-open message</label>
              <textarea id="application-before-open-message" value={form.before_open_message} onChange={(e) => setForm({ ...form, before_open_message: e.target.value })} className={`${inputCls} min-h-[52px]`} style={fieldStyle()} />
            </div>
            <div>
              <label htmlFor="application-after-close-message" className={labelCls} style={{ color: 'var(--color-text3)' }}>After-close message</label>
              <textarea id="application-after-close-message" value={form.after_close_message} onChange={(e) => setForm({ ...form, after_close_message: e.target.value })} className={`${inputCls} min-h-[52px]`} style={fieldStyle()} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="application-sort-order" className={labelCls} style={{ color: 'var(--color-text3)' }}>Sort order</label>
                <input id="application-sort-order" type="number" value={form.sort_order} onChange={(e) => setForm({ ...form, sort_order: e.target.value })} className={inputCls} style={fieldStyle()} />
              </div>
              <label className="flex items-end gap-2 pb-2 font-sans text-sm" style={{ color: 'var(--color-text2)' }}>
                <input type="checkbox" checked={form.is_enabled} onChange={(e) => setForm({ ...form, is_enabled: e.target.checked })} />
                Enabled
              </label>
            </div>

            <div className="flex flex-wrap gap-2 pt-1">
              <button type="submit" disabled={saving} aria-busy={saving} className="inline-flex items-center gap-2 rounded px-4 py-2 font-sans text-sm font-medium transition-colors disabled:opacity-50" style={{ background: 'var(--color-text)', color: 'var(--color-bg)', border: 'none' }}>
                {saving ? 'Saving...' : selected ? 'Save Changes' : 'Create Link'}
              </button>
              {selected && (
                <button type="button" onClick={resetForm} className="rounded border px-4 py-2 font-sans text-sm" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text2)', background: 'transparent' }}>
                  Cancel
                </button>
              )}
            </div>
          </form>
        </aside>
      </div>
    </div>
  );
}
