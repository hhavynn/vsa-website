import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Event } from '../../../types';
import { EventRecapFormData } from '../../../data/repos/eventRecaps';
import { useAuth } from '../../../hooks/useAuth';
import { useEventRecap } from '../../../hooks/useEventRecap';

const emptyRecap: EventRecapFormData = {
  owner_names: null,
  cabinet_roles: null,
  attendance_notes: null,
  what_worked: null,
  what_failed: null,
  next_time_improvements: null,
  budget_notes: null,
  aftersocial_notes: null,
  risks_issues: null,
  drive_folder_url: null,
  planning_doc_url: null,
  gallery_event_id: null,
  public_highlight: null,
  is_public_highlight_published: false,
};

const inputCls = 'mt-1 block w-full rounded border px-3 py-2.5 text-[15px] sm:py-2 sm:text-sm focus:outline-none focus:border-[var(--brand)] focus:ring-1 focus:ring-[var(--brand)] bg-[var(--color-surface2)] border-[var(--color-border)] text-[var(--color-text)] placeholder-[var(--color-text3)]';
const labelCls = 'block text-[10px] font-bold uppercase tracking-[0.1em] text-[var(--color-text3)]';

type RecapTextFieldKey = Exclude<keyof EventRecapFormData, 'is_public_highlight_published'>;

type TextAreaField = {
  key: RecapTextFieldKey;
  label: string;
  placeholder: string;
  rows?: number;
};

const learningFields: TextAreaField[] = [
  {
    key: 'attendance_notes',
    label: 'Attendance Notes',
    placeholder: 'Turnout, audience mix, check-in notes, retention signals.',
  },
  {
    key: 'what_worked',
    label: 'What Worked',
    placeholder: 'Decisions, formats, outreach, timing, or logistics worth repeating.',
  },
  {
    key: 'what_failed',
    label: 'What Failed',
    placeholder: 'What created friction, confusion, low attendance, or avoidable work.',
  },
  {
    key: 'next_time_improvements',
    label: 'Next Time Improvements',
    placeholder: 'Concrete changes a future Events Chair should make.',
  },
];

const operationsFields: TextAreaField[] = [
  {
    key: 'budget_notes',
    label: 'Budget Notes',
    placeholder: 'Costs, vendors, reimbursements, supply quantities, financial surprises.',
  },
  {
    key: 'aftersocial_notes',
    label: 'Aftersocial Notes',
    placeholder: 'Aftersocial location, turnout, timing, transportation, safety notes.',
  },
  {
    key: 'risks_issues',
    label: 'Risks / Issues',
    placeholder: 'Policy concerns, venue issues, accessibility gaps, safety follow-ups.',
  },
];

function toFormData(recap: ReturnType<typeof useEventRecap>['recap']): EventRecapFormData {
  if (!recap) return emptyRecap;

  return {
    owner_names: recap.owner_names,
    cabinet_roles: recap.cabinet_roles,
    attendance_notes: recap.attendance_notes,
    what_worked: recap.what_worked,
    what_failed: recap.what_failed,
    next_time_improvements: recap.next_time_improvements,
    budget_notes: recap.budget_notes,
    aftersocial_notes: recap.aftersocial_notes,
    risks_issues: recap.risks_issues,
    drive_folder_url: recap.drive_folder_url,
    planning_doc_url: recap.planning_doc_url,
    gallery_event_id: recap.gallery_event_id,
    public_highlight: recap.public_highlight,
    is_public_highlight_published: recap.is_public_highlight_published,
  };
}

function TextArea({
  field,
  value,
  onChange,
}: {
  field: TextAreaField;
  value: string | null;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <label className={labelCls}>{field.label}</label>
      <textarea
        value={value ?? ''}
        onChange={(event) => onChange(event.target.value)}
        className={`${inputCls} min-h-[104px] resize-y leading-relaxed`}
        rows={field.rows ?? 4}
        placeholder={field.placeholder}
      />
    </div>
  );
}

export function EventRecapEditor({ event }: { event: Event }) {
  const { user } = useAuth();
  const { recap, loading, error, saveRecap, saving } = useEventRecap(event.id);
  const [form, setForm] = useState<EventRecapFormData>(emptyRecap);

  useEffect(() => {
    setForm(toFormData(recap));
  }, [event.id, recap]);

  const updateField = <K extends keyof EventRecapFormData>(key: K, value: EventRecapFormData[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const handleSubmit = async (submitEvent: React.FormEvent) => {
    submitEvent.preventDefault();
    if (!user) {
      toast.error('Sign in as an admin to save recaps');
      return;
    }

    try {
      await saveRecap({
        values: form,
        userId: user.id,
        existingRecapId: recap?.id,
      });
      toast.success('Recap saved');
    } catch (saveError) {
      console.error(saveError);
      toast.error('Failed to save recap');
    }
  };

  if (loading) {
    return (
      <section className="border-t p-6 sm:p-8" style={{ borderColor: 'var(--color-border)' }}>
        <div className="h-4 w-32 animate-pulse rounded bg-[var(--color-surface2)]" />
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="h-24 animate-pulse rounded bg-[var(--color-surface2)]" />
          <div className="h-24 animate-pulse rounded bg-[var(--color-surface2)]" />
        </div>
      </section>
    );
  }

  return (
    <section className="border-t p-6 sm:p-8" style={{ borderColor: 'var(--color-border)' }}>
      <>
        <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-serif text-xl font-bold" style={{ color: 'var(--color-text)' }}>
                Event Recap
              </h3>
              {recap && (
                <span className="rounded border px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.08em]" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text3)' }}>
                  Saved
                </span>
              )}
            </div>
            <p className="mt-1 max-w-2xl text-sm leading-relaxed" style={{ color: 'var(--color-text2)' }}>
              Internal notes for future cabinet planning. These fields are admin-only and are not shown on the public Events page.
            </p>
          </div>
          <p className="font-mono text-[10px] uppercase tracking-[0.08em]" style={{ color: 'var(--color-text3)' }}>
            {new Date(event.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
          </p>
        </div>

        {error && (
          <div className="mb-5 rounded border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-700 dark:text-amber-200">
            Recap could not be loaded. Check that the event recap migration has been applied.
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <div>
              <label className={labelCls}>Owner Names</label>
              <input
                type="text"
                value={form.owner_names ?? ''}
                onChange={(changeEvent) => updateField('owner_names', changeEvent.target.value)}
                className={inputCls}
                placeholder="Name(s) of recap owner or event leads"
              />
            </div>
            <div>
              <label className={labelCls}>Cabinet Roles</label>
              <input
                type="text"
                value={form.cabinet_roles ?? ''}
                onChange={(changeEvent) => updateField('cabinet_roles', changeEvent.target.value)}
                className={inputCls}
                placeholder="Events Chair, Culture Chair, Treasurer"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            {learningFields.map((field) => (
              <TextArea
                key={field.key}
                field={field}
                value={form[field.key]}
                onChange={(value) => updateField(field.key, value)}
              />
            ))}
          </div>

          <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
            {operationsFields.map((field) => (
              <TextArea
                key={field.key}
                field={field}
                value={form[field.key]}
                onChange={(value) => updateField(field.key, value)}
              />
            ))}
          </div>

          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <div>
              <label className={labelCls}>Drive Folder URL</label>
              <input
                type="url"
                value={form.drive_folder_url ?? ''}
                onChange={(changeEvent) => updateField('drive_folder_url', changeEvent.target.value)}
                className={inputCls}
                placeholder="https://drive.google.com/..."
              />
            </div>
            <div>
              <label className={labelCls}>Planning Doc URL</label>
              <input
                type="url"
                value={form.planning_doc_url ?? ''}
                onChange={(changeEvent) => updateField('planning_doc_url', changeEvent.target.value)}
                className={inputCls}
                placeholder="https://docs.google.com/..."
              />
            </div>
          </div>

          <div>
            <label className={labelCls}>Public Highlight</label>
            <textarea
              value={form.public_highlight ?? ''}
              onChange={(changeEvent) => updateField('public_highlight', changeEvent.target.value)}
              className={`${inputCls} min-h-[88px] resize-y leading-relaxed`}
              rows={3}
              placeholder="Optional future-facing summary. It is still hidden publicly in this MVP."
            />
            <label className="mt-3 flex cursor-pointer items-start gap-3 rounded border p-3 text-sm" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text2)', background: 'var(--color-surface2)' }}>
              <input
                type="checkbox"
                checked={form.is_public_highlight_published}
                onChange={(changeEvent) => updateField('is_public_highlight_published', changeEvent.target.checked)}
                className="mt-0.5 rounded border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--brand)] focus:ring-[var(--brand)]"
              />
              <span>
                Mark public highlight as ready. The current public Events page still does not render recap content.
              </span>
            </label>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            {recap?.updated_at && (
              <p className="font-mono text-[10px] uppercase tracking-[0.08em]" style={{ color: 'var(--color-text3)' }}>
                Last saved {new Date(recap.updated_at).toLocaleString()}
              </p>
            )}
            <button type="submit" disabled={saving} className="vsa-btn-primary w-full py-3 disabled:opacity-50 sm:ml-auto sm:w-auto sm:px-8">
              {saving ? 'Saving recap...' : recap ? 'Save Recap' : 'Create Recap'}
            </button>
          </div>
        </form>
      </>
    </section>
  );
}
