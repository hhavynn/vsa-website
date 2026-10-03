import { useState } from 'react';
import { CTABlock } from '../../common/ApplicationCTA';
import {
  CLOSING_SOON_DAYS,
  closingSoonStartsAt,
  formatPacificDateTime,
  isValidFormUrl,
  projectPublicApplicationLink,
} from '../../../lib/applicationWindows';
import { ApplicationKey } from '../../../types';

export interface PreviewWindow {
  application_key: ApplicationKey;
  title: string;
  description: string | null;
  button_label: string;
  target_url: string;
  /** ISO instants, or '' while the form's schedule is incomplete or invalid. */
  open_at: string;
  due_at: string;
  is_enabled: boolean;
  before_open_message: string | null;
  after_close_message: string | null;
  sort_order: number;
}

type Moment = 'now' | 'open';

/**
 * "What would a student see?" for the window being edited.
 *
 * The card is the site's own CTABlock fed by projectPublicApplicationLink, which
 * applies the same getApplicationStatus / maskTargetUrl pair as the public view,
 * so a closed or scheduled window shows its message and never its URL. The raw
 * form link is shown separately and labelled admin-only: this page is behind the
 * admin gate, and the public projection is not changed to make that possible.
 */
export function ApplicationPublicPreview({ draft, now = new Date() }: { draft: PreviewWindow; now?: Date }) {
  const [moment, setMoment] = useState<Moment>('now');
  const openMs = new Date(draft.open_at).getTime();
  const dueMs = new Date(draft.due_at).getTime();
  const scheduleValid = !Number.isNaN(openMs) && !Number.isNaN(dueMs) && dueMs > openMs;
  const urlValid = isValidFormUrl(draft.target_url);

  // "When open" previews the window at its opening instant as if enabled, so a
  // draft or scheduled window can be checked before it goes live.
  const at = moment === 'open' && scheduleValid ? new Date(openMs) : now;
  const projected = projectPublicApplicationLink(scheduleValid ? draft : { ...draft, open_at: '', due_at: '' }, at, { assumeEnabled: moment === 'open' });
  const showsButton = projected.status === 'open' && !!projected.target_url;
  const homepageNoticeFrom = scheduleValid ? closingSoonStartsAt(draft.due_at) : null;

  return (
    <section aria-labelledby="application-preview-title" className="mt-6 rounded-md border p-4" style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface2)' }}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 id="application-preview-title" className="font-sans text-sm font-semibold" style={{ color: 'var(--color-text)' }}>
          Public preview
        </h3>
        <div role="group" aria-label="Preview moment" className="inline-flex overflow-hidden rounded border text-xs" style={{ borderColor: 'var(--color-border)' }}>
          {(['now', 'open'] as const).map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={moment === value}
              onClick={() => setMoment(value)}
              className="px-2.5 py-1 font-sans font-medium"
              style={{
                background: moment === value ? 'var(--color-surface)' : 'transparent',
                color: moment === value ? 'var(--color-text)' : 'var(--color-text3)',
              }}
            >
              {value === 'now' ? 'Right now' : 'Once open'}
            </button>
          ))}
        </div>
      </div>

      {moment === 'open' && (!scheduleValid || !urlValid) ? (
        <p className="mt-3 font-sans text-xs" style={{ color: 'var(--color-text3)' }}>
          {scheduleValid ? 'Add a complete https:// form link to preview the open state.' : 'Fill in a valid open time and a later due time to preview the open state.'}
        </p>
      ) : (
        <div className="mt-3" data-testid="application-preview-card">
          {moment === 'open' && (
            <p className="mb-2 font-sans text-[11px]" style={{ color: 'var(--color-text3)' }}>
              How it will look once open. Not live{draft.is_enabled ? ' until the open time' : ' until the window is enabled'}.
            </p>
          )}
          <CTABlock link={projected} fallbackKey={draft.application_key} />
        </div>
      )}

      <dl className="mt-3 space-y-1 font-sans text-xs" style={{ color: 'var(--color-text2)' }}>
        <div className="flex gap-2">
          <dt className="font-semibold">Apply button:</dt>
          <dd>{showsButton ? 'Shown' : 'Hidden'}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="font-semibold">Opens:</dt>
          <dd>{scheduleValid ? formatPacificDateTime(draft.open_at) : 'Not set'}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="font-semibold">Closes:</dt>
          <dd>{scheduleValid ? formatPacificDateTime(draft.due_at) : 'Not set'}</dd>
        </div>
        {homepageNoticeFrom && (
          <div className="flex gap-2">
            <dt className="font-semibold">Homepage notice:</dt>
            <dd>{`"Closing soon" shows from ${formatPacificDateTime(homepageNoticeFrom)} (${CLOSING_SOON_DAYS} days before close), while the window is open.`}</dd>
          </div>
        )}
      </dl>

      <p className="mt-3 rounded border px-3 py-2 font-sans text-[11px] leading-relaxed" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text3)', background: 'var(--color-surface)' }}>
        <span className="font-semibold" style={{ color: 'var(--color-text2)' }}>Admins only:</span>{' '}
        {isValidFormUrl(draft.target_url) ? <span className="break-all">{draft.target_url}</span> : 'no valid form link yet'}
        <br />
        Students only ever receive this link while the window is open.
      </p>
    </section>
  );
}
