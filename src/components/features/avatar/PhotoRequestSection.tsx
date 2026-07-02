import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Label } from '../../ui/Label';
import { MemberPhotoRequestFormSchema } from '../../../schemas';
import { photoRequestsRepository } from '../../../data/repos/photoRequests';

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '8px 10px', fontSize: 13,
  background: 'var(--color-surface)', color: 'var(--color-text)',
  border: '1px solid var(--color-border)', borderRadius: 4, outline: 'none',
};

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
  const [submitted, setSubmitted] = useState(false);
  const [middleName, setMiddleName] = useState('');

  useEffect(() => {
    setForm(f => ({ ...f, name: f.name || defaultName, email: f.email || defaultEmail }));
  }, [defaultName, defaultEmail]);

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
      setFormError('Choose a member from the leaderboard before requesting a photo.');
      return;
    }
    const parsed = MemberPhotoRequestFormSchema.safeParse({
      submitted_name: form.name,
      submitted_email: form.email,
      note_to_admins: form.note,
      consent_confirmed: consent,
    });
    if (!parsed.success) {
      setFormError(parsed.error.errors[0]?.message ?? 'Please check the form.');
      return;
    }
    if (!file) {
      setFormError('Please choose a photo to upload.');
      return;
    }

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
      const message = error instanceof Error ? error.message : 'Failed to submit photo request.';
      setFormError(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <div className="flex flex-col gap-2">
        <button
          onClick={() => setModalOpen(true)}
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
            className="w-full max-w-md border rounded shadow-xl max-h-[90vh] overflow-y-auto"
            style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)', padding: 24 }}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-sans text-sm font-semibold" style={{ color: 'var(--color-text)' }}>Request Profile Photo</h2>
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
                <Label className="mb-1.5">Your name</Label>
                <input type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} style={inputStyle} />
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
                <Label className="mb-1.5">UCSD Email</Label>
                <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} style={inputStyle} />
              </div>
              <div>
                <Label className="mb-1.5">Photo</Label>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={e => setFile(e.target.files?.[0] ?? null)}
                  className="font-sans text-xs"
                  style={{ color: 'var(--color-text2)' }}
                />
                <p className="font-sans text-[11px] mt-1" style={{ color: 'var(--color-text3)' }}>
                  JPEG, PNG, or WebP up to 5 MB. It will be resized before display.
                </p>
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
                  <li>If approved, it may appear publicly on the VSA website (e.g., the leaderboard).</li>
                  <li>You can request removal at any time.</li>
                  <li>Do not upload a photo of someone else without their permission.</li>
                </ul>
                <label className="mt-3 flex items-start gap-2 font-sans text-xs" style={{ color: 'var(--color-text)', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={consent}
                    onChange={e => setConsent(e.target.checked)}
                    style={{ marginTop: 2 }}
                  />
                  <span>I understand and consent to my photo being reviewed and, if approved, displayed publicly on the VSA website.</span>
                </label>
              </div>

              {formError && (
                <p className="font-sans text-xs" role="alert" style={{ color: 'var(--color-danger, #dc2626)' }}>{formError}</p>
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
