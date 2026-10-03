import { FormEvent, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useQueryClient } from 'react-query';
import { ConfirmDialog } from '../../components/common/ConfirmDialog';
import { PageTitle } from '../../components/common/PageTitle';
import { PageLoader } from '../../components/common/PageLoader';
import { PageError } from '../../components/common/PageError';
import {
  ADMIN_APPLICATION_LINKS_QUERY_KEY,
  PUBLIC_APPLICATION_LINKS_QUERY_KEY,
  useAdminApplicationLinks,
} from '../../hooks/useApplicationLinks';
import { AdminPageHeader } from '../../components/features/admin/AdminPageHeader';
import { ApplicationPublicPreview, PreviewWindow } from '../../components/features/admin/ApplicationPublicPreview';
import { ApplicationWindowCard } from '../../components/features/admin/ApplicationWindowCard';
import { AdminField, AdminFormShell } from '../../components/features/admin/ops/AdminFormShell';
import { applicationLinksRepository, ApplicationLinkFormData } from '../../data/repos/applicationLinks';
import { logAdminActivity } from '../../data/repos/adminActivity';
import { useAdminForm } from '../../hooks/useAdminForm';
import { useUrlFilter } from '../../hooks/useUrlFilter';
import {
  APPLICATION_KEY_OPTIONS,
  DEFAULT_APPLICATION_MESSAGES,
  applicationKeyLabel,
  combineLocalDateTime,
  splitLocalDateTime,
} from '../../lib/applicationLinks';
import { applicationWindowActivity } from '../../lib/applicationWindowActivity';
import {
  WINDOW_STATE_LABELS,
  WindowState,
  formatPacificDateTime,
  getAdminWindowState,
  opensInThePast,
  validateApplicationWindow,
} from '../../lib/applicationWindows';
import { ApplicationLinkFormSchema, ApplicationLinkFormValues, applicationLinkPayload, isDriveLink } from '../../schemas/applicationLink';
import { ApplicationKey, ApplicationLink } from '../../types';

type FormState = ApplicationLinkFormValues & { application_key: ApplicationKey };

// Database constraints mapped to the field they belong to, so a server rejection
// lands beside the input instead of as a generic failure.
const SERVER_CONSTRAINTS = {
  application_links_window_check: { field: 'due_date', message: 'Due date/time must be after the open date/time' },
  application_links_key_check: { field: 'application_key', message: 'That application type is not supported' },
};

// `?filter=` values (Admin Overview deep-links here), in the order the dropdown lists them.
const STATE_FILTERS: ReadonlyArray<'all' | WindowState> = ['all', 'open', 'scheduled', 'closed', 'disabled', 'misconfigured'];
type StatusFilter = (typeof STATE_FILTERS)[number];

const inputCls =
  'mt-1 block w-full rounded border px-3 py-2 text-sm font-sans focus:outline-none focus:border-[var(--brand)] focus:ring-1 focus:ring-[var(--brand)]/20';
const labelCls = 'block font-mono text-[10px] font-bold uppercase tracking-[0.1em]';
// AdminField supplies the label gap, so form inputs drop the filter inputs' top margin.
const formInputCls = inputCls.replace('mt-1 ', '');

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

const SCHEDULE_HELP_ID = 'application-schedule-help';

function scheduleDescribedBy(existing: string | undefined) {
  return [existing, SCHEDULE_HELP_ID].filter(Boolean).join(' ');
}

/** What deleting this window changes on the public site, based on where it is in its schedule. */
function deleteConsequences(link: ApplicationLink): string[] {
  const { status } = getAdminWindowState(link, new Date());
  const lines: string[] = [];
  if (status === 'open') {
    lines.push('This window is open right now: the Apply button disappears from the public pages immediately.');
  } else if (status === 'not_open') {
    lines.push(`It is scheduled to open ${formatPacificDateTime(link.open_at) || 'later'}; that will no longer happen.`);
  } else {
    lines.push('It is not showing publicly right now, so the public pages will not change.');
  }
  lines.push('Its target URL, dates, and before/after messages are lost.');
  return lines;
}

/** The form's current values as the window students would see, or an incomplete one while the schedule is blank. */
function previewFromValues(values: FormState): PreviewWindow {
  return {
    application_key: values.application_key,
    title: values.title.trim() || applicationKeyLabel(values.application_key),
    description: values.description.trim() || null,
    button_label: values.button_label.trim(),
    target_url: values.target_url.trim(),
    open_at: combineLocalDateTime(values.open_date, values.open_time, '00:00') ?? '',
    due_at: combineLocalDateTime(values.due_date, values.due_time, '23:59') ?? '',
    is_enabled: values.is_enabled,
    before_open_message: values.before_open_message.trim() || null,
    after_close_message: values.after_close_message.trim() || null,
    sort_order: Number(values.sort_order) || 0,
  };
}

// The insert payload types is_enabled as optional; the form always sets it.
const asFacts = (payload: ApplicationLinkFormData) => ({
  ...payload,
  application_key: payload.application_key as ApplicationKey,
  is_enabled: payload.is_enabled === true,
});

type PublishChange = 'publish' | 'relink' | null;

/**
 * What a save does to the public site. 'publish': the form link becomes reachable
 * by students and was not before. 'relink': it already was, and the link itself
 * changes, so a typo goes live immediately. Anything else (copy, a window that
 * stays private) is null and saves without asking.
 */
function publishChange(before: ApplicationLink | null, values: FormState, now: Date): PublishChange {
  let payload;
  try {
    payload = applicationLinkPayload(values);
  } catch {
    return null;
  }
  const wasPublic = before ? getAdminWindowState(before, now).isPublic : false;
  const willBePublic = getAdminWindowState(asFacts(payload), now).isPublic;
  if (!wasPublic && willBePublic) return 'publish';
  if (wasPublic && willBePublic && before && before.target_url.trim() !== payload.target_url.trim()) return 'relink';
  return null;
}

const hasPlaceholderUrl = (facts: { open_at: string; due_at: string; is_enabled: boolean; target_url: string }) =>
  validateApplicationWindow(facts).some((issue) => issue.code === 'placeholder_url');

interface PublishConfirm {
  title: string;
  closes: string;
  change: PublishChange;
  /** The link is a Google Drive file that must be shared publicly. */
  drive: boolean;
  /** The link still looks like the seeded example.com placeholder. */
  placeholder: boolean;
}

export default function AdminApplications() {
  const queryClient = useQueryClient();
  const { links, loading, error, refetch } = useAdminApplicationLinks();
  const [selected, setSelected] = useState<ApplicationLink | null>(null);
  const [keyFilter, setKeyFilter] = useState<'all' | ApplicationKey>('all');
  const [statusFilter, setStatusFilter] = useUrlFilter(STATE_FILTERS) as [StatusFilter, (key: StatusFilter) => void];
  const [deleteTarget, setDeleteTarget] = useState<ApplicationLink | null>(null);
  const [publishConfirm, setPublishConfirm] = useState<PublishConfirm | null>(null);
  const [enableTarget, setEnableTarget] = useState<ApplicationLink | null>(null);

  // One clock for the filter, the counts, and the cards, so a window cannot read
  // Closed on its card while the "Open" filter still lists it.
  const nowMs = Math.floor(Date.now() / 60_000) * 60_000;
  const now = useMemo(() => new Date(nowMs), [nowMs]);

  const visibleLinks = useMemo(() => {
    return links.filter((link) => {
      if (keyFilter !== 'all' && link.application_key !== keyFilter) return false;
      if (statusFilter !== 'all' && getAdminWindowState(link, now).state !== statusFilter) return false;
      return true;
    });
  }, [links, keyFilter, statusFilter, now]);

  const counts = useMemo(() => {
    const acc: Record<WindowState, number> = { open: 0, scheduled: 0, closed: 0, disabled: 0, misconfigured: 0 };
    links.forEach((link) => {
      acc[getAdminWindowState(link, now).state] += 1;
    });
    return acc;
  }, [links, now]);

  const refresh = async () => {
    await queryClient.invalidateQueries(ADMIN_APPLICATION_LINKS_QUERY_KEY);
    await queryClient.invalidateQueries(PUBLIC_APPLICATION_LINKS_QUERY_KEY);
    await refetch();
  };

  const api = useAdminForm({
    schema: ApplicationLinkFormSchema,
    defaultValues: emptyForm(),
    constraints: SERVER_CONSTRAINTS,
    successMessage: selected ? 'Application link updated' : 'Application link created',
    onSubmit: async (values) => {
      const payload = applicationLinkPayload(values);
      const before = selected;
      const saved = before
        ? await applicationLinksRepository.updateApplicationLink(before.id, payload)
        : await applicationLinksRepository.createApplicationLink(payload);
      // Best effort and never blocks the save: the entry reuses Recent Changes.
      logAdminActivity({
        ...applicationWindowActivity(before ? 'updated' : 'created', before, asFacts(payload)),
        entityId: saved?.id ?? before?.id ?? null,
      });
      try {
        await refresh();
      } catch (err) {
        // The save itself succeeded; a failed refetch must not read as a failed save.
        console.error(err);
      }
    },
    onSuccess: () => resetForm(),
  });
  const { form } = api;
  const { register, formState } = form;
  const errors = formState.errors;
  const watched = form.watch() as FormState;
  const draft = previewFromValues(watched);
  const nowForForm = new Date();
  const liveIssues = watched.open_date && watched.due_date ? validateApplicationWindow(draft).filter((issue) => issue.code !== 'placeholder_url') : [];
  const savedState = selected ? getAdminWindowState(selected, nowForForm).state : null;
  const showPastOpen = opensInThePast(draft.open_at, nowForForm) && savedState !== 'open';

  // Clears the editor without asking. Used after a save or delete, when nothing is unsaved.
  function resetForm() {
    setSelected(null);
    form.reset(emptyForm());
  }

  // Leaving edits behind (New, Clear, Cancel, or picking another window) asks first.
  const requestReset = () => {
    if (api.confirmDiscard()) resetForm();
  };

  const selectLink = (link: ApplicationLink) => {
    if (!api.confirmDiscard()) return;
    setSelected(link);
    form.reset(formFromLink(link));
  };

  const onKeyChange = (previous: ApplicationKey, key: ApplicationKey) => {
    const values = form.getValues();
    const touch = { shouldDirty: true } as const;
    // Refresh defaults only when the admin hasn't customized them.
    if (!values.title || values.title === applicationKeyLabel(previous)) form.setValue('title', applicationKeyLabel(key), touch);
    if (!values.before_open_message || values.before_open_message === DEFAULT_APPLICATION_MESSAGES[previous].before) {
      form.setValue('before_open_message', DEFAULT_APPLICATION_MESSAGES[key].before, touch);
    }
    if (!values.after_close_message || values.after_close_message === DEFAULT_APPLICATION_MESSAGES[previous].after) {
      form.setValue('after_close_message', DEFAULT_APPLICATION_MESSAGES[key].after, touch);
    }
  };

  // Two things need an explicit "yes" first, but only once the form is otherwise
  // valid (so nobody confirms something that cannot save): a save that makes the
  // form link reachable by students, and a Google Drive link that must be shared
  // publicly. Copy-only edits and saves that publish nothing go straight through.
  const handleFormSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const values = form.getValues() as FormState;
    const change = publishChange(selected, values, new Date());
    const drive = isDriveLink(values.target_url);
    if (change || drive) {
      if (await form.trigger()) {
        const preview = previewFromValues(values);
        setPublishConfirm({
          title: values.title.trim(),
          closes: formatPacificDateTime(preview.due_at),
          change,
          drive,
          placeholder: change !== null && hasPlaceholderUrl(preview),
        });
      }
      return;
    }
    await api.submit(event);
  };

  // Rejects when the write fails, so a confirmation dialog stays open and shows the
  // error instead of closing as if it had worked. A failed refetch afterwards does not
  // count: the write itself succeeded.
  const applyToggle = async (link: ApplicationLink) => {
    try {
      await applicationLinksRepository.setApplicationLinkEnabled(link.id, !link.is_enabled);
    } catch (err) {
      console.error(err);
      throw new Error('Failed to update the window. Nothing changed.');
    }
    logAdminActivity({
      ...applicationWindowActivity('toggled', link, { ...link, is_enabled: !link.is_enabled }),
      entityId: link.id,
    });
    toast.success(link.is_enabled ? 'Disabled' : 'Enabled');
    try {
      await refresh();
    } catch (err) {
      console.error(err);
    }
  };

  // The no-dialog path: nothing to keep open, so report the failure as a toast.
  const toggleWithToast = async (link: ApplicationLink) => {
    try {
      await applyToggle(link);
    } catch {
      toast.error('Failed to update status');
    }
  };

  const handleToggle = async (link: ApplicationLink) => {
    if (!link.is_enabled) {
      // Enabling is the one toggle that can publish. Refuse a window that is broken,
      // and ask first when it would go live immediately.
      const next = getAdminWindowState({ ...link, is_enabled: true }, new Date());
      const blocking = next.issues.find((issue) => issue.severity === 'error');
      if (blocking) {
        toast.error(`Not enabled. ${blocking.message}`);
        return;
      }
      if (next.isPublic) {
        setEnableTarget(link);
        return;
      }
    }
    await toggleWithToast(link);
  };

  // Runs from the confirm dialog: a failure is re-thrown so the dialog stays open and shows it.
  const handleDelete = async (link: ApplicationLink) => {
    try {
      await applicationLinksRepository.deleteApplicationLink(link.id);
    } catch (err) {
      console.error(err);
      toast.error('Failed to delete application link');
      throw new Error('Failed to delete the application link. Nothing was removed.');
    }
    logAdminActivity({ ...applicationWindowActivity('deleted', link, null), entityId: link.id });
    toast.success('Application link deleted');
    if (selected?.id === link.id) resetForm();
    try {
      await refresh();
    } catch (err) {
      console.error(err);
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

  return (
    <div className="flex-1 overflow-y-auto">
      <PageTitle title="Admin Applications" />

      <AdminPageHeader
        description={`${counts.open} open · ${counts.scheduled} scheduled · ${counts.closed} closed · ${counts.disabled} disabled${counts.misconfigured > 0 ? ` · ${counts.misconfigured} need fixing` : ''}. Public pages only show a button while a window is open. All times are Pacific Time (PT).`}
        actions={
          <button
            type="button"
            onClick={requestReset}
            className="inline-flex items-center gap-2 rounded border px-3 py-2 font-sans text-xs font-medium transition-colors"
            style={{ borderColor: 'var(--color-border)', color: 'var(--color-text2)', background: 'transparent' }}
          >
            New Application Link
          </button>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(340px,440px)]" style={{ padding: '20px 28px' }}>
        <div className="min-w-0 space-y-4">
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
                  {STATE_FILTERS.filter((key): key is WindowState => key !== 'all').map((key) => (
                    <option key={key} value={key}>{WINDOW_STATE_LABELS[key]}</option>
                  ))}
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
                {visibleLinks.map((link) => (
                  <ApplicationWindowCard
                    key={link.id}
                    link={link}
                    now={now}
                    selected={selected?.id === link.id}
                    onEdit={selectLink}
                    onToggle={handleToggle}
                    onDelete={setDeleteTarget}
                  />
                ))}
              </div>
            )}
          </section>
        </div>

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
              <button type="button" onClick={requestReset} className="font-sans text-xs" style={{ color: 'var(--color-text3)' }}>
                Clear
              </button>
            )}
          </div>

          <AdminFormShell
            onSubmit={handleFormSubmit}
            status={api.status}
            formError={api.formError}
            errors={errors}
            onDiscard={api.discard}
            saveLabel={selected ? 'Save Changes' : 'Create Link'}
            label={selected ? 'Edit Application Link' : 'Add Application Link'}
            actions={
              selected && (
                <button type="button" onClick={requestReset} className="rounded border px-4 py-2 font-sans text-sm" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text2)', background: 'transparent' }}>
                  Cancel
                </button>
              )
            }
          >
            <AdminField label="Application type" required error={errors.application_key?.message}>
              {(p) => {
                const { onChange, ...rest } = register('application_key');
                return (
                  <select
                    {...p}
                    {...rest}
                    onChange={(event) => {
                      // Read the outgoing key before RHF records the new one.
                      const previous = form.getValues('application_key');
                      void onChange(event);
                      onKeyChange(previous, event.target.value as ApplicationKey);
                    }}
                    className={formInputCls}
                    style={fieldStyle()}
                  >
                    {APPLICATION_KEY_OPTIONS.map((o) => (
                      <option key={o.key} value={o.key}>{o.label}</option>
                    ))}
                  </select>
                );
              }}
            </AdminField>
            <AdminField label="Title" required error={errors.title?.message}>
              {(p) => <input {...p} {...register('title')} className={formInputCls} style={fieldStyle()} />}
            </AdminField>
            <AdminField label="Button label" required error={errors.button_label?.message}>
              {(p) => <input {...p} {...register('button_label')} className={formInputCls} style={fieldStyle()} />}
            </AdminField>
            <AdminField label="Target URL" required error={errors.target_url?.message} hint="Must start with https://. Only exposed publicly while the window is open.">
              {(p) => <input {...p} {...register('target_url')} type="url" className={formInputCls} style={fieldStyle()} placeholder="https://forms.gle/..." />}
            </AdminField>
            <AdminField label="Description" error={errors.description?.message}>
              {(p) => <textarea {...p} {...register('description')} className={`${formInputCls} min-h-[60px]`} style={fieldStyle()} />}
            </AdminField>
            <div className="grid grid-cols-2 gap-3">
              <AdminField label="Open date" required error={errors.open_date?.message}>
                {(p) => <input {...p} {...register('open_date')} type="date" aria-describedby={scheduleDescribedBy(p['aria-describedby'])} className={formInputCls} style={fieldStyle()} />}
              </AdminField>
              <AdminField label="Open time" error={errors.open_time?.message}>
                {(p) => <input {...p} {...register('open_time')} type="time" aria-describedby={scheduleDescribedBy(p['aria-describedby'])} className={formInputCls} style={fieldStyle()} />}
              </AdminField>
              <AdminField label="Due date" required error={errors.due_date?.message}>
                {(p) => <input {...p} {...register('due_date')} type="date" aria-describedby={scheduleDescribedBy(p['aria-describedby'])} className={formInputCls} style={fieldStyle()} />}
              </AdminField>
              <AdminField label="Due time" error={errors.due_time?.message}>
                {(p) => <input {...p} {...register('due_time')} type="time" aria-describedby={scheduleDescribedBy(p['aria-describedby'])} className={formInputCls} style={fieldStyle()} />}
              </AdminField>
            </div>
            <p id="application-schedule-help" className="font-sans text-[11px]" style={{ color: 'var(--color-text3)' }}>
              Dates and times are Pacific Time (PT, San Diego), wherever you are editing from. Due time defaults to 11:59 PM PT unless you change it.
            </p>
            {showPastOpen && (
              <p role="status" className="rounded border px-3 py-2 font-sans text-xs" style={{ borderColor: '#d97706', color: '#b45309', background: 'var(--color-surface2)' }}>
                The open time ({formatPacificDateTime(draft.open_at)}) is already in the past.
                {watched.is_enabled ? ' This window opens for students as soon as you save.' : ' Once this window is enabled, it opens immediately.'}
              </p>
            )}
            {liveIssues.filter((issue) => issue.severity === 'error').map((issue) => (
              <p key={issue.code} role="status" className="font-sans text-xs" style={{ color: '#dc2626' }}>
                {issue.message}
              </p>
            ))}
            <AdminField label="Before-open message" error={errors.before_open_message?.message}>
              {(p) => <textarea {...p} {...register('before_open_message')} className={`${formInputCls} min-h-[52px]`} style={fieldStyle()} />}
            </AdminField>
            <AdminField label="After-close message" error={errors.after_close_message?.message}>
              {(p) => <textarea {...p} {...register('after_close_message')} className={`${formInputCls} min-h-[52px]`} style={fieldStyle()} />}
            </AdminField>
            <div className="grid grid-cols-2 gap-3">
              <AdminField label="Sort order" error={errors.sort_order?.message}>
                {(p) => <input {...p} {...register('sort_order')} type="number" className={formInputCls} style={fieldStyle()} />}
              </AdminField>
              <label className="flex items-end gap-2 pb-2 font-sans text-sm" style={{ color: 'var(--color-text2)' }}>
                <input type="checkbox" {...register('is_enabled')} />
                Enabled
              </label>
            </div>
          </AdminFormShell>

          <ApplicationPublicPreview draft={draft} now={nowForForm} />
        </aside>
      </div>

      <ConfirmDialog
        open={publishConfirm !== null}
        title={
          publishConfirm?.change === 'publish'
            ? `Make “${publishConfirm.title}” public?`
            : publishConfirm?.change === 'relink'
              ? `Change the live form link for “${publishConfirm.title}”?`
              : 'Publish a Google Drive link?'
        }
        description={
          publishConfirm?.change === 'publish'
            ? `Saving opens this window now, so the form URL becomes publicly reachable from the VSA website until it closes ${publishConfirm.closes}.`
            : publishConfirm?.change === 'relink'
              ? 'This window is open right now. Saving points the public Apply button at the new link immediately.'
              : 'This looks like a Google Drive link. Confirm it is shared publicly and safe to expose to the public when the window is open.'
        }
        consequences={[
          ...(publishConfirm?.change === 'publish' ? ['Anyone on the public pages can follow the form link as soon as you save.', 'You can switch it back off with Disable, but anyone who already has the link keeps it.'] : []),
          ...(publishConfirm?.change === 'relink' ? ['Students who open the form after you save go to the new link.', 'Check the new link before saving; a typo goes live at once.'] : []),
          ...(publishConfirm?.placeholder ? ['The link still looks like a placeholder (example.com). Students would land on it.'] : []),
          ...(publishConfirm?.drive
            ? ['While this window is open, anyone on the public page can follow the link.', 'If the Drive file is private, visitors will hit an access request instead.']
            : []),
        ]}
        confirmLabel={publishConfirm?.change === 'publish' ? 'Save and make public' : publishConfirm?.change === 'relink' ? 'Save new link' : 'It is public, save'}
        danger={false}
        onConfirm={() => api.submit()}
        onClose={() => setPublishConfirm(null)}
      />

      {enableTarget && (
        <ConfirmDialog
          open
          title={`Enable “${enableTarget.title}”?`}
          description={`This window is inside its open dates, so enabling it makes the form URL publicly reachable now, until it closes ${formatPacificDateTime(enableTarget.due_at)}.`}
          consequences={[
            'The Apply button appears on the public pages immediately.',
            ...(hasPlaceholderUrl(enableTarget) ? ['The link still looks like a placeholder (example.com). Students would land on it.'] : []),
            'You can switch it back off with Disable, but anyone who already has the link keeps it.',
          ]}
          confirmLabel="Enable and make public"
          danger={false}
          onConfirm={() => applyToggle(enableTarget)}
          onClose={() => setEnableTarget(null)}
        />
      )}

      {deleteTarget && (
        <ConfirmDialog
          open
          title={`Delete “${deleteTarget.title}”?`}
          description="This permanently removes the application window, its link, dates, and messages. It cannot be undone."
          consequences={deleteConsequences(deleteTarget)}
          confirmLabel="Delete link"
          onConfirm={() => handleDelete(deleteTarget)}
          onClose={() => setDeleteTarget(null)}
        >
          {deleteTarget.is_enabled && (
            <button
              type="button"
              className="mt-3 font-sans text-xs font-semibold underline underline-offset-2"
              style={{ color: 'var(--color-text)', background: 'transparent', border: 'none', padding: 0 }}
              onClick={async () => {
                const target = deleteTarget;
                setDeleteTarget(null);
                await handleToggle(target);
              }}
            >
              Disable it instead (keeps everything, easy to turn back on)
            </button>
          )}
        </ConfirmDialog>
      )}
    </div>
  );
}
