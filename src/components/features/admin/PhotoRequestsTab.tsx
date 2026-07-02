import { useCallback, useEffect, useState } from 'react';
import toast, { Toaster } from 'react-hot-toast';
import { format } from 'date-fns';
import {
  photoRequestsRepository,
  MemberPhotoRequest,
  MemberPhotoRequestEvent,
  MemberMatchOption,
} from '../../../data/repos/photoRequests';
import { Label } from '../../ui/Label';

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '8px 10px', fontSize: 13,
  background: 'var(--color-surface)', color: 'var(--color-text)',
  border: '1px solid var(--color-border)', borderRadius: 4, outline: 'none',
};

const STATUS_BADGE: Record<MemberPhotoRequest['status'], { label: string; color: string }> = {
  pending: { label: 'Pending', color: '#d97706' },
  approved: { label: 'Approved', color: '#16a34a' },
  rejected: { label: 'Rejected', color: '#dc2626' },
  removed: { label: 'Removed', color: 'var(--color-text3)' },
};

type StatusFilter = 'pending' | 'all';

export default function PhotoRequestsTab() {
  const [requests, setRequests] = useState<MemberPhotoRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<StatusFilter>('pending');
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRequests(await photoRequestsRepository.listPhotoRequests());
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to load photo requests.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const visible = filter === 'pending' ? requests.filter(r => r.status === 'pending') : requests;
  const pendingCount = requests.filter(r => r.status === 'pending').length;

  return (
    <div>
      <Toaster position="top-right" />

      <div className="mb-4 flex gap-2">
        {(['pending', 'all'] as StatusFilter[]).map(value => (
          <button
            key={value}
            onClick={() => setFilter(value)}
            className="font-sans text-xs rounded border px-3 py-1.5 transition-colors"
            style={{
              borderColor: 'var(--color-border)',
              background: filter === value ? 'var(--color-text)' : 'transparent',
              color: filter === value ? 'var(--color-bg)' : 'var(--color-text2)',
              cursor: 'pointer',
            }}
          >
            {value === 'pending' ? `Pending · ${pendingCount}` : `All · ${requests.length}`}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="font-sans text-sm" style={{ color: 'var(--color-text3)' }}>Loading photo requests…</p>
      ) : visible.length === 0 ? (
        <p className="font-sans text-sm" style={{ color: 'var(--color-text3)' }}>
          {filter === 'pending' ? 'No pending photo requests.' : 'No photo requests yet.'}
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          {visible.map(request => (
            <RequestCard
              key={request.id}
              request={request}
              busy={busyId === request.id}
              setBusy={(b) => setBusyId(b ? request.id : null)}
              onChanged={load}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function RequestCard({
  request,
  busy,
  setBusy,
  onChanged,
}: {
  request: MemberPhotoRequest;
  busy: boolean;
  setBusy: (busy: boolean) => void;
  onChanged: () => void;
}) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [autoMatch, setAutoMatch] = useState<MemberMatchOption | null>(null);
  const [autoMatchChecked, setAutoMatchChecked] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<MemberMatchOption[]>([]);
  const [manualMatch, setManualMatch] = useState<MemberMatchOption | null>(null);
  const [rejectNote, setRejectNote] = useState('');
  const [showRejectNote, setShowRejectNote] = useState(false);
  const [events, setEvents] = useState<MemberPhotoRequestEvent[] | null>(null);

  const badge = STATUS_BADGE[request.status];
  const isPending = request.status === 'pending';
  const isApproved = request.status === 'approved';

  useEffect(() => {
    if (!isPending || autoMatchChecked) return;
    const matchPromise = request.matched_member_id
      ? photoRequestsRepository.findMemberById(request.matched_member_id)
      : photoRequestsRepository.findMemberForUser(request.user_id);
    matchPromise
      .then(setAutoMatch)
      .catch(() => setAutoMatch(null))
      .finally(() => setAutoMatchChecked(true));
  }, [isPending, autoMatchChecked, request.matched_member_id, request.user_id]);

  async function loadPreview() {
    try {
      setPreviewUrl(await photoRequestsRepository.getPendingPreviewUrl(request.storage_path_pending));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to load preview.');
    }
  }

  async function runSearch(term: string) {
    setSearchTerm(term);
    if (term.trim().length < 2) {
      setSearchResults([]);
      return;
    }
    try {
      setSearchResults(await photoRequestsRepository.searchMembers(term));
    } catch {
      setSearchResults([]);
    }
  }

  async function handleApprove() {
    setBusy(true);
    try {
      const match = manualMatch ?? autoMatch;
      await photoRequestsRepository.approveRequest(request, match?.id ?? null);
      toast.success('Photo approved and published.');
      onChanged();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to approve.');
    } finally {
      setBusy(false);
    }
  }

  async function handleReject() {
    setBusy(true);
    try {
      await photoRequestsRepository.rejectRequest(request, rejectNote);
      toast.success('Photo request rejected. Pending file deleted.');
      onChanged();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to reject.');
    } finally {
      setBusy(false);
    }
  }

  async function handleRemove() {
    if (!window.confirm('Remove this approved photo from public display? This clears the member’s avatar and deletes the published thumbnail.')) return;
    setBusy(true);
    try {
      await photoRequestsRepository.removeApprovedAvatar(request, rejectNote || 'Privacy removal');
      toast.success('Approved photo removed.');
      onChanged();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to remove.');
    } finally {
      setBusy(false);
    }
  }

  async function toggleAuditTrail() {
    if (events) {
      setEvents(null);
      return;
    }
    try {
      setEvents(await photoRequestsRepository.listRequestEvents(request.id));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to load audit trail.');
    }
  }

  const effectiveMatch = manualMatch ?? autoMatch;

  return (
    <div className="border rounded" style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)', padding: 16 }}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-sans text-sm font-semibold" style={{ color: 'var(--color-text)' }}>
              {request.submitted_name}
            </span>
            <span
              className="font-sans text-[10px] font-semibold uppercase tracking-wide rounded px-1.5 py-0.5"
              style={{ color: badge.color, border: `1px solid ${badge.color}` }}
            >
              {badge.label}
            </span>
          </div>
          <p className="font-sans text-xs mt-0.5" style={{ color: 'var(--color-text2)' }}>{request.submitted_email}</p>
          <p className="font-mono text-[10px] mt-1" style={{ color: 'var(--color-text3)' }}>
            Submitted {format(new Date(request.created_at), 'MMM d, yyyy h:mm a')}
            {request.reviewed_at && ` · Reviewed ${format(new Date(request.reviewed_at), 'MMM d, yyyy h:mm a')}`}
          </p>
          {request.note_to_admins && (
            <p className="font-sans text-xs mt-2 italic" style={{ color: 'var(--color-text2)' }}>
              “{request.note_to_admins}”
            </p>
          )}
          {request.admin_notes && (
            <p className="font-sans text-xs mt-1" style={{ color: 'var(--color-text3)' }}>
              Admin note: {request.admin_notes}
            </p>
          )}
        </div>

        <div className="shrink-0">
          {isApproved && request.approved_avatar_url ? (
            <img src={request.approved_avatar_url} alt="Approved avatar" className="h-20 w-20 rounded-full object-cover" />
          ) : previewUrl ? (
            <img src={previewUrl} alt="Pending submission preview" className="h-20 w-20 rounded-full object-cover" />
          ) : (
            <button
              onClick={loadPreview}
              className="font-sans text-xs rounded border px-3 py-1.5"
              style={{ borderColor: 'var(--color-border)', color: 'var(--color-text2)', background: 'transparent', cursor: 'pointer' }}
            >
              Preview photo
            </button>
          )}
        </div>
      </div>

      {isPending && (
        <div className="mt-4 border-t pt-4" style={{ borderColor: 'var(--color-border)' }}>
          <Label className="mb-1.5">Member match</Label>
          <p className="font-sans text-xs mb-2" style={{ color: effectiveMatch ? 'var(--color-text2)' : 'var(--color-text3)' }}>
            {effectiveMatch
              ? `Will link to: ${effectiveMatch.displayName}${manualMatch ? ' (manual)' : ' (auto-matched by account)'}`
              : 'No linked member found — the photo will still show on the member’s own profile, but not on public leaderboards until their account is linked to a member record.'}
          </p>
          <input
            type="text"
            placeholder="Search members by name to override…"
            value={searchTerm}
            onChange={e => runSearch(e.target.value)}
            style={{ ...inputStyle, maxWidth: 360 }}
          />
          {searchResults.length > 0 && (
            <div className="mt-1 border rounded" style={{ borderColor: 'var(--color-border)', maxWidth: 360 }}>
              {searchResults.map(option => (
                <button
                  key={option.id}
                  onClick={() => { setManualMatch(option); setSearchTerm(''); setSearchResults([]); }}
                  className="block w-full text-left font-sans text-xs px-3 py-2 hover:bg-[var(--color-surface2)]"
                  style={{ color: 'var(--color-text)', background: 'transparent', border: 'none', cursor: 'pointer' }}
                >
                  {option.displayName}
                </button>
              ))}
            </div>
          )}
          {manualMatch && (
            <button
              onClick={() => setManualMatch(null)}
              className="mt-1 font-sans text-[11px] underline"
              style={{ color: 'var(--color-text3)', background: 'none', border: 'none', cursor: 'pointer' }}
            >
              Clear manual match
            </button>
          )}

          {showRejectNote && (
            <div className="mt-3">
              <Label className="mb-1.5">Internal rejection note (admin-only)</Label>
              <textarea
                value={rejectNote}
                onChange={e => setRejectNote(e.target.value)}
                rows={2}
                maxLength={2000}
                style={{ ...inputStyle, maxWidth: 360, resize: 'vertical' }}
              />
            </div>
          )}

          <div className="mt-3 flex flex-wrap gap-2">
            <button
              onClick={handleApprove}
              disabled={busy}
              className="font-sans text-xs font-medium rounded px-4 py-2 disabled:opacity-40"
              style={{ background: '#16a34a', color: '#fff', border: 'none', cursor: busy ? 'default' : 'pointer' }}
            >
              {busy ? 'Working…' : 'Approve & Publish'}
            </button>
            {showRejectNote ? (
              <button
                onClick={handleReject}
                disabled={busy}
                className="font-sans text-xs font-medium rounded px-4 py-2 disabled:opacity-40"
                style={{ background: '#dc2626', color: '#fff', border: 'none', cursor: busy ? 'default' : 'pointer' }}
              >
                Confirm Reject
              </button>
            ) : (
              <button
                onClick={() => setShowRejectNote(true)}
                disabled={busy}
                className="font-sans text-xs rounded border px-4 py-2 disabled:opacity-40"
                style={{ borderColor: '#dc2626', color: '#dc2626', background: 'transparent', cursor: 'pointer' }}
              >
                Reject…
              </button>
            )}
          </div>
        </div>
      )}

      {isApproved && (
        <div className="mt-4 border-t pt-4" style={{ borderColor: 'var(--color-border)' }}>
          <button
            onClick={handleRemove}
            disabled={busy}
            className="font-sans text-xs rounded border px-4 py-2 disabled:opacity-40"
            style={{ borderColor: '#dc2626', color: '#dc2626', background: 'transparent', cursor: 'pointer' }}
          >
            {busy ? 'Working…' : 'Remove from public display'}
          </button>
          <p className="font-sans text-[11px] mt-1.5" style={{ color: 'var(--color-text3)' }}>
            Clears the member’s avatar, deletes the published thumbnail, and records an audit event. Use for privacy/data-rights requests.
          </p>
        </div>
      )}

      <div className="mt-3">
        <button
          onClick={toggleAuditTrail}
          className="font-sans text-[11px] underline"
          style={{ color: 'var(--color-text3)', background: 'none', border: 'none', cursor: 'pointer' }}
        >
          {events ? 'Hide audit trail' : 'Show audit trail'}
        </button>
        {events && (
          <div className="mt-1">
            {events.length === 0 ? (
              <p className="font-sans text-[11px]" style={{ color: 'var(--color-text3)' }}>No events recorded.</p>
            ) : (
              events.map(event => (
                <p key={event.id} className="font-mono text-[10px]" style={{ color: 'var(--color-text3)' }}>
                  {format(new Date(event.created_at), 'MMM d, yyyy h:mm a')} · {event.action}
                  {event.note ? ` · ${event.note}` : ''}
                </p>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
