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
import { AdminField, AdminFormShell } from '../../components/features/admin/ops/AdminFormShell';
import { applicationLinksRepository } from '../../data/repos/applicationLinks';
import { useAdminForm } from '../../hooks/useAdminForm';
import {
  APPLICATION_KEY_OPTIONS,
  APPLICATION_STATUS_LABELS,
  DEFAULT_APPLICATION_MESSAGES,
  applicationKeyLabel,
  formatApplicationDateTime,
  getApplicationStatus,
  splitLocalDateTime,
} from '../../lib/applicationLinks';
import { ApplicationLinkFormSchema, ApplicationLinkFormValues, applicationLinkPayload, isDriveLink } from '../../schemas/applicationLink';
import { ApplicationKey, ApplicationLink, ApplicationStatus } from '../../types';

type FormState = ApplicationLinkFormValues & { application_key: ApplicationKey };

// Database constraints mapped to the field they belong to, so a server rejection
// lands beside the input instead of as a generic failure.
const SERVER_CONSTRAINTS = {
  application_links_window_check: { field: 'due_date', message: 'Due date/time must be after the open date/time' },
  application_links_key_check: { field: 'application_key', message: 'That application type is not supported' },
};

type StatusFilter = 'all' | ApplicationStatus;

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

const SCHEDULE_HELP_ID = 'application-schedule-help';

function scheduleDescribedBy(existing: string | undefined) {
  return [existing, SCHEDULE_HELP_ID].filter(Boolean).join(' ');
}

/** What deleting this window changes on the public site, based on where it is in its schedule. */
function deleteConsequences(link: ApplicationLink): string[] {
  const status = getApplicationStatus(link.open_at, link.due_at, link.is_enabled, new Date());
  const lines: string[] = [];
  if (status === 'open') {
    lines.push('This window is open right now: the Apply button disappears from the public pages immediately.');
  } else if (status === 'not_open') {
    lines.push(`It is scheduled to open ${formatApplicationDateTime(link.open_at) || 'later'}; that will no longer happen.`);
  } else {
    lines.push('It is not showing publicly right now, so the public pages will not change.');
  }
  lines.push('Its target URL, dates, and before/after messages are lost.');
  return lines;
}

export default function AdminApplications() {
  const queryClient = useQueryClient();
  const { links, loading, error, refetch } = useAdminApplicationLinks();
  const [selected, setSelected] = useState<ApplicationLink | null>(null);
  const [keyFilter, setKeyFilter] = useState<'all' | ApplicationKey>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [deleteTarget, setDeleteTarget] = useState<ApplicationLink | null>(null);
  const [driveConfirmOpen, setDriveConfirmOpen] = useState(false);

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
      if (selected) {
        await applicationLinksRepository.updateApplicationLink(selected.id, payload);
      } else {
        await applicationLinksRepository.createApplicationLink(payload);
      }
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

  // Drive links need an explicit "this is public" acknowledgement, but only once the
  // form is otherwise valid, so the admin is not asked to confirm something that cannot save.
  const handleFormSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isDriveLink(form.getValues('target_url'))) {
      if (await form.trigger()) setDriveConfirmOpen(true);
      return;
    }
    await api.submit(event);
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

  // Runs from the confirm dialog: a failure is re-thrown so the dialog stays open and shows it.
  const handleDelete = async (link: ApplicationLink) => {
    try {
      await applicationLinksRepository.deleteApplicationLink(link.id);
    } catch (err) {
      console.error(err);
      toast.error('Failed to delete application link');
      throw new Error('Failed to delete the application link. Nothing was removed.');
    }
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

  const now = new Date();

  return (
    <div className="flex-1 overflow-y-auto">
      <PageTitle title="Admin Applications" />

      <AdminPageHeader
        description={`${counts.open} open · ${counts.not_open} upcoming · ${counts.closed} closed · ${counts.disabled} disabled. Public pages only show a button while a window is open.`}
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
                        <button type="button" onClick={() => setDeleteTarget(link)} className="rounded border px-2.5 py-1.5 font-sans text-xs" style={{ borderColor: 'var(--color-border)', color: '#dc2626' }}>
                          Delete
                        </button>
                      </div>
                    </article>
                  );
                })}
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
              Dates and times are San Diego (Pacific) time, wherever you are editing from. Open date can be in the past. Due time defaults to 11:59 PM unless you change it.
            </p>
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
        </aside>
      </div>

      <ConfirmDialog
        open={driveConfirmOpen}
        title="Publish a Google Drive link?"
        description="This looks like a Google Drive link. Confirm it is shared publicly and safe to expose to the public when the window is open."
        consequences={['While this window is open, anyone on the public page can follow the link.', 'If the Drive file is private, visitors will hit an access request instead.']}
        confirmLabel="It is public, save"
        danger={false}
        onConfirm={() => api.submit()}
        onClose={() => setDriveConfirmOpen(false)}
      />

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
