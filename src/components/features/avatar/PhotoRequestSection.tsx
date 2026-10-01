import { KeyboardEvent as ReactKeyboardEvent, useEffect, useId, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { Label } from '../../ui/Label';
import { MemberPhotoRequestFormSchema } from '../../../schemas';
import { photoRequestsRepository } from '../../../data/repos/photoRequests';
import { toUserMessage } from '../../../data/errors';

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([tabindex="-1"]), textarea:not([disabled]), select:not([disabled])';

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '8px 10px', fontSize: 13,
  background: 'var(--color-surface)', color: 'var(--color-text)',
  border: '1px solid var(--color-border)', borderRadius: 4, outline: 'none',
};

const DANGER = 'var(--color-danger, #dc2626)';

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} className="mt-1 font-sans text-[11px] leading-snug" style={{ color: DANGER }}>
      {message}
    </p>
  );
}

const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
const PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

type FieldName = 'name' | 'email' | 'file' | 'consent';
type FieldErrors = Partial<Record<FieldName, string>>;

const SCHEMA_FIELD: Record<string, FieldName> = {
  submitted_name: 'name',
  submitted_email: 'email',
  consent_confirmed: 'consent',
};

/** Same limits the upload broker and the private bucket enforce. */
function checkPhoto(file: File | null): string | undefined {
  if (!file) return 'Choose a photo to upload.';
  if (!PHOTO_TYPES.includes(file.type)) {
    return `"${file.name}" isn't a supported photo type. Use a JPEG, PNG, or WebP image (iPhone HEIC photos need to be saved as JPEG first).`;
  }
  if (file.size > MAX_PHOTO_BYTES) {
    return `That photo is ${(file.size / (1024 * 1024)).toFixed(1)} MB. Choose one under 5 MB.`;
  }
  return undefined;
}

interface PhotoRequestSectionProps {
  matchedMemberId?: string | null;
  selectedMemberName?: string;
  defaultName?: string;
  defaultEmail?: string;
  buttonLabel?: string;
}

export function PhotoRequestSection({
  matchedMemberId,
  selectedMemberName = '',
  defaultName = '',
  defaultEmail = '',
  buttonLabel = 'Request photo',
}: PhotoRequestSectionProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ name: defaultName, email: defaultEmail, note: '' });
  const [file, setFile] = useState<File | null>(null);
  const [consent, setConsent] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [submitted, setSubmitted] = useState(false);
  const [middleName, setMiddleName] = useState('');
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const errorRef = useRef<HTMLDivElement | null>(null);
  const titleId = useId();
  const ids = {
    name: `${titleId}-name`,
    email: `${titleId}-email`,
    file: `${titleId}-file`,
    consent: `${titleId}-consent`,
  };

  useEffect(() => {
    setForm(f => ({ ...f, name: f.name || defaultName, email: f.email || defaultEmail }));
  }, [defaultName, defaultEmail]);

  // Escape closes only this modal, not the sheet or bottom sheet behind it.
  useEffect(() => {
    if (!modalOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      if (!submitting) setModalOpen(false);
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [modalOpen, submitting]);

  // The dialog opens over other pages' controls (the ACE tree, the leaderboard),
  // so move focus into it and hand focus back to the trigger when it closes.
  useEffect(() => {
    if (!modalOpen) return;
    const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialogRef.current?.focus();
    return () => trigger?.focus();
  }, [modalOpen]);

  // The dialog scrolls on small screens, so an error set after tapping Submit
  // can land off-screen and the button would look like it did nothing.
  useEffect(() => {
    if (formError) errorRef.current?.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' });
  }, [formError]);

  function focusField(field: FieldName) {
    document.getElementById(ids[field])?.focus();
  }

  function keepFocusInDialog(e: ReactKeyboardEvent<HTMLDivElement>) {
    if (e.key !== 'Tab' || !dialogRef.current) return;
    const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE));
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const active = document.activeElement;
    if (e.shiftKey && (active === first || active === dialogRef.current)) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && active === last) {
      e.preventDefault();
      first.focus();
    }
  }

  const canSubmit = Boolean(matchedMemberId);

  async function handleSubmit() {
    setFormError(null);
    if (middleName) {
      toast.success('Photo request submitted for review!');
      setModalOpen(false);
      setSubmitted(true);
      setFile(null);
      setConsent(false);
      setForm(f => ({ ...f, note: '' }));
      setMiddleName('');
      return;
    }
    if (!matchedMemberId) {
      setFormError('Choose a member before requesting a photo.');
      return;
    }
    const parsed = MemberPhotoRequestFormSchema.safeParse({
      submitted_name: form.name,
      submitted_email: form.email,
      note_to_admins: form.note,
      consent_confirmed: consent,
    });
    const errors: FieldErrors = {};
    if (!parsed.success) {
      for (const issue of parsed.error.errors) {
        const field = SCHEMA_FIELD[String(issue.path[0])];
        if (field && !errors[field]) errors[field] = issue.message;
      }
    }
    const fileError = checkPhoto(file);
    if (fileError) errors.file = fileError;

    const invalid = (['name', 'email', 'file', 'consent'] as FieldName[]).filter(f => errors[f]);
    if (!parsed.success || invalid.length > 0 || !file) {
      setFieldErrors(errors);
      setFormError(
        invalid.length > 0
          ? `Your request hasn't been submitted yet. Fix ${invalid.length === 1 ? 'the highlighted field' : `the ${invalid.length} highlighted fields`} and try again.`
          : (!parsed.success ? parsed.error.errors[0]?.message : null) ?? 'Please check the form.',
      );
      if (invalid[0]) focusField(invalid[0]);
      return;
    }
    setFieldErrors({});

    setSubmitting(true);
    try {
      await photoRequestsRepository.submitPhotoRequest({
        matchedMemberId,
        file,
        submittedName: parsed.data.submitted_name,
        submittedEmail: parsed.data.submitted_email,
        noteToAdmins: parsed.data.note_to_admins,
        consentConfirmed: parsed.data.consent_confirmed,
      });
      toast.success('Photo request submitted for review!');
      setModalOpen(false);
      setSubmitted(true);
      setFile(null);
      setConsent(false);
      setForm(f => ({ ...f, note: '' }));
    } catch (error) {
      console.error('Error submitting photo request:', error);
      setFormError(`Your request wasn't submitted. ${toUserMessage(error, 'Something went wrong on our end. Please try again, or contact VSA if it keeps happening.')}`);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <div className="flex flex-col gap-2">
        <button
          onClick={() => { setFormError(null); setFieldErrors({}); setModalOpen(true); }}
          disabled={!canSubmit || submitted}
          className="font-sans text-xs border rounded px-2.5 py-1.5 transition-colors duration-150 disabled:opacity-50"
          style={{ color: 'var(--color-text2)', borderColor: 'var(--color-border)', background: 'transparent', cursor: !canSubmit || submitted ? 'default' : 'pointer' }}
        >
          {submitted ? 'Request submitted' : buttonLabel}
        </button>
        {submitted && (
          <p className="font-sans text-[11px] leading-snug" style={{ color: 'var(--color-text3)', maxWidth: 200 }}>
            Thanks — a VSA admin will review it before it appears publicly.
          </p>
        )}
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => !submitting && setModalOpen(false)}>
          <div
            className="w-full max-w-md border rounded shadow-xl max-h-[90vh] overflow-y-auto focus:outline-none"
            style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)', padding: 24 }}
            onClick={e => e.stopPropagation()}
            onKeyDown={keepFocusInDialog}
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            tabIndex={-1}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 id={titleId} className="font-sans text-sm font-semibold" style={{ color: 'var(--color-text)' }}>Request Profile Photo</h2>
              <button onClick={() => setModalOpen(false)} aria-label="Close" style={{ color: 'var(--color-text3)', background: 'none', border: 'none', cursor: 'pointer' }}>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {selectedMemberName && (
                <div className="rounded border p-3" style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface2)' }}>
                  <p className="font-sans text-[11px] uppercase tracking-wide" style={{ color: 'var(--color-text3)' }}>
                    Selected member
                  </p>
                  <p className="font-sans text-sm font-semibold" style={{ color: 'var(--color-text)' }}>
                    {selectedMemberName}
                  </p>
                </div>
              )}
              <div>
                <Label id={`${ids.name}-label`} className="mb-1.5">Your name</Label>
                <input
                  id={ids.name}
                  type="text"
                  autoComplete="name"
                  value={form.name}
                  onChange={e => { setForm(f => ({ ...f, name: e.target.value })); setFieldErrors(fe => ({ ...fe, name: undefined })); }}
                  aria-labelledby={`${ids.name}-label`}
                  aria-invalid={Boolean(fieldErrors.name)}
                  aria-describedby={fieldErrors.name ? `${ids.name}-error` : undefined}
                  style={fieldErrors.name ? { ...inputStyle, borderColor: DANGER } : inputStyle}
                />
                <FieldError id={`${ids.name}-error`} message={fieldErrors.name} />
              </div>
              <div className="absolute opacity-0 -z-10 w-0 h-0 pointer-events-none" aria-hidden="true">
                <label htmlFor="middle_name">Middle Name</label>
                <input
                  id="middle_name"
                  type="text"
                  value={middleName}
                  onChange={e => setMiddleName(e.target.value)}
                  tabIndex={-1}
                  autoComplete="off"
                />
              </div>
              <div>
                <Label id={`${ids.email}-label`} className="mb-1.5">UCSD Email</Label>
                <input
                  id={ids.email}
                  type="email"
                  autoComplete="email"
                  placeholder="you@ucsd.edu"
                  value={form.email}
                  onChange={e => { setForm(f => ({ ...f, email: e.target.value })); setFieldErrors(fe => ({ ...fe, email: undefined })); }}
                  aria-labelledby={`${ids.email}-label`}
                  aria-invalid={Boolean(fieldErrors.email)}
                  aria-describedby={fieldErrors.email ? `${ids.email}-error` : undefined}
                  style={fieldErrors.email ? { ...inputStyle, borderColor: DANGER } : inputStyle}
                />
                <FieldError id={`${ids.email}-error`} message={fieldErrors.email} />
              </div>
              <div>
                <Label id={`${ids.file}-label`} className="mb-1.5">Photo</Label>
                <input
                  id={ids.file}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={e => {
                    const chosen = e.target.files?.[0] ?? null;
                    setFile(chosen);
                    setFieldErrors(fe => ({ ...fe, file: chosen ? checkPhoto(chosen) : undefined }));
                  }}
                  aria-labelledby={`${ids.file}-label`}
                  aria-invalid={Boolean(fieldErrors.file)}
                  aria-describedby={fieldErrors.file ? `${ids.file}-error` : undefined}
                  className="font-sans text-xs"
                  style={{ color: 'var(--color-text2)' }}
                />
                <p className="font-sans text-[11px] mt-1" style={{ color: 'var(--color-text3)' }}>
                  JPEG, PNG, or WebP up to 5 MB. It will be resized before display.
                </p>
                <FieldError id={`${ids.file}-error`} message={fieldErrors.file} />
              </div>
              <div>
                <Label className="mb-1.5">Note to admins (optional)</Label>
                <textarea
                  value={form.note}
                  onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
                  rows={2}
                  maxLength={1000}
                  style={{ ...inputStyle, resize: 'vertical' }}
                />
              </div>

              <div className="border rounded p-3" style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface2)' }}>
                <p className="font-sans text-[11px] leading-relaxed mb-2" style={{ color: 'var(--color-text2)' }}>
                  Before you submit:
                </p>
                <ul className="font-sans text-[11px] leading-relaxed list-disc pl-4" style={{ color: 'var(--color-text3)' }}>
                  <li>Your photo is reviewed by a VSA admin before it is published.</li>
                  <li>If approved, it may appear publicly anywhere you appear on the VSA website (e.g., the leaderboard, ACE family trees, and Cabinet).</li>
                  <li>You can request removal at any time.</li>
                  <li>Do not upload a photo of someone else without their permission.</li>
                </ul>
                <label className="mt-3 flex items-start gap-2 font-sans text-xs" style={{ color: 'var(--color-text)', cursor: 'pointer' }}>
                  <input
                    id={ids.consent}
                    type="checkbox"
                    checked={consent}
                    onChange={e => { setConsent(e.target.checked); setFieldErrors(fe => ({ ...fe, consent: undefined })); }}
                    aria-invalid={Boolean(fieldErrors.consent)}
                    aria-describedby={fieldErrors.consent ? `${ids.consent}-error` : undefined}
                    style={{ marginTop: 2 }}
                  />
                  <span>I understand and consent to my photo being reviewed and, if approved, displayed publicly on the VSA website.</span>
                </label>
                <FieldError id={`${ids.consent}-error`} message={fieldErrors.consent} />
              </div>

              {formError && (
                <div
                  ref={errorRef}
                  role="alert"
                  className="rounded border p-3 font-sans text-xs leading-relaxed"
                  style={{ color: DANGER, borderColor: DANGER, background: 'color-mix(in srgb, var(--color-danger, #dc2626) 8%, transparent)' }}
                >
                  {formError}
                </div>
              )}
            </div>

            <div className="mt-5 flex flex-col gap-3 sm:flex-row">
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="flex-1 font-sans text-sm font-medium rounded py-2.5 transition-colors duration-150 disabled:opacity-40"
                style={{ background: 'var(--color-text)', color: 'var(--color-bg)', cursor: submitting ? 'default' : 'pointer', border: 'none' }}
              >
                {submitting ? 'Submitting…' : 'Submit for Review'}
              </button>
              <button
                onClick={() => setModalOpen(false)}
                disabled={submitting}
                className="font-sans text-sm rounded border px-4 py-2.5 transition-colors duration-150"
                style={{ color: 'var(--color-text2)', borderColor: 'var(--color-border)', background: 'transparent', cursor: 'pointer' }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
