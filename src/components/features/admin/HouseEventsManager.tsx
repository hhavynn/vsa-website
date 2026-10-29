import { useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { useQuery, useQueryClient } from 'react-query';
import { getVerifiedLegacyHouseYears } from '../../../data/legacyHouseArchive';
import { ADMIN_HOUSE_EVENT_LIMIT, houseEventsRepository, HouseEventFormData } from '../../../data/repos/houseEvents';
import { useAcademicTerms } from '../../../hooks/useAcademicTerms';
import { useAdminHouseAssets } from '../../../hooks/useHouseAssets';
import { ConfirmDialog } from '../../common/ConfirmDialog';
import { HouseEventsDashboard } from './HouseEventsDashboard';
import { HouseEventPlanningPanel } from './HouseEventPlanningPanel';
import { ImageDropzone } from './ImageDropzone';
import { HOUSE_COLORS, HOUSE_LABELS, HouseName } from '../../../constants/houses';
import { formatAcademicYear, getAcademicTermMeta } from '../../../lib/academicTerms';
import { formatDateOnly } from '../../../lib/dateOnly';
import { isEndAfterStart, timeToInputValue } from '../../../lib/eventTime';
import { hostIdsOf } from '../../../lib/houseEventDashboard';
import { extractSupabasePublicObjectName, getUploadExtension, prepareImageForUpload } from '../../../lib/imageUpload';
import { supabase } from '../../../lib/supabase';
import { HouseEvent, HousePageAsset } from '../../../types';
import { houseSlugFromKey } from '../../../utils/houseSlug';
import { getLosAngelesDateOnly } from '../../../utils/losAngelesDate';

const inputCls = 'mt-1 block w-full rounded border px-3 py-2.5 text-[15px] sm:py-2 sm:text-sm focus:outline-none focus:border-[var(--brand)] focus:ring-1 focus:ring-[var(--brand)] bg-[var(--color-surface2)] border-[var(--color-border)] text-[var(--color-text)] placeholder-[var(--color-text3)]';
const labelCls = 'block text-[10px] font-bold uppercase tracking-[0.1em] text-[var(--color-text3)]';

type HouseEventDraft = {
  id?: string;
  house_profile_ids: string[];
  title: string;
  description: string;
  event_date: string;
  start_time: string;
  end_time: string;
  location: string;
  image_url: string;
  image_thumbnail_url: string;
  gallery_url: string;
  recap_url: string;
  rsvp_url: string;
  google_calendar_enabled: boolean;
  is_published: boolean;
};

type UploadedHouseEventImage = {
  imageUrl: string;
  thumbnailUrl: string;
};

function getCurrentAcademicYearStart() {
  return getAcademicTermMeta(new Date())?.academicYearStart ?? new Date().getFullYear();
}

function buildAcademicYearOptions(terms: ReturnType<typeof useAcademicTerms>['terms']) {
  const years = new Map<number, { start: number; label: string; isActive: boolean }>();
  const currentYear = getCurrentAcademicYearStart();

  // 1. Add current year
  years.set(currentYear, {
    start: currentYear,
    label: formatAcademicYear(currentYear),
    isActive: false,
  });

  // 2. Add years from active terms
  terms.forEach((term) => {
    const existing = years.get(term.academic_year_start);
    years.set(term.academic_year_start, {
      start: term.academic_year_start,
      label: formatAcademicYear(term.academic_year_start),
      isActive: term.is_active || existing?.isActive || false,
    });
  });

  // 3. Add verified legacy years from static archive
  getVerifiedLegacyHouseYears().forEach((legacy) => {
    if (!years.has(legacy.startYear)) {
      years.set(legacy.startYear, {
        start: legacy.startYear,
        label: legacy.academicYear,
        isActive: false,
      });
    }
  });

  return Array.from(years.values()).sort((a, b) => b.start - a.start);
}

function emptyDraft(): HouseEventDraft {
  return {
    house_profile_ids: [],
    title: '',
    description: '',
    event_date: '',
    start_time: '',
    end_time: '',
    location: '',
    image_url: '',
    image_thumbnail_url: '',
    gallery_url: '',
    recap_url: '',
    rsvp_url: '',
    google_calendar_enabled: true,
    // A new event is a draft until an admin deliberately publishes it.
    is_published: false,
  };
}

function draftFromEvent(event: HouseEvent): HouseEventDraft {
  return {
    id: event.id,
    house_profile_ids: event.houses?.map((h) => h.id) || [event.house_profile_id],
    title: event.title,
    description: event.description ?? '',
    event_date: event.event_date,
    start_time: timeToInputValue(event.start_time) || '',
    end_time: timeToInputValue(event.end_time) || '',
    location: event.location ?? '',
    image_url: event.image_url ?? '',
    image_thumbnail_url: event.image_thumbnail_url ?? '',
    gallery_url: event.gallery_url ?? '',
    recap_url: event.recap_url ?? '',
    rsvp_url: event.rsvp_url ?? '',
    google_calendar_enabled: event.google_calendar_enabled,
    is_published: event.is_published,
  };
}

function nullable(value: string) {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function getHouseLabel(asset?: HousePageAsset) {
  if (!asset) return 'Unknown House';
  return asset.display_name || HOUSE_LABELS[asset.house as HouseName] || asset.house_key || asset.house;
}

function getHouseColor(asset?: HousePageAsset) {
  if (!asset) return 'var(--brand)';
  return asset.accent_color || HOUSE_COLORS[asset.house as HouseName] || 'var(--brand)';
}

function validateDraft(draft: HouseEventDraft) {
  if (draft.house_profile_ids.length === 0) return 'Choose at least one House.';
  if (!draft.title.trim()) return 'Title is required.';
  if (!draft.event_date) return 'Date is required.';
  const hasStart = !!draft.start_time;
  const hasEnd = !!draft.end_time;
  if (hasStart !== hasEnd) return 'Please add both a start and end time, or leave both empty.';
  if (hasStart && hasEnd && !isEndAfterStart(draft.start_time, draft.end_time)) return 'End time must be after start time.';
  return null;
}

export interface HouseEventsManagerProps {
  selectedYear: number | null;
  onYearChange: (year: number) => void;
}

export function HouseEventsManager({ selectedYear, onYearChange }: HouseEventsManagerProps) {
  const { terms } = useAcademicTerms();
  const academicYearOptions = useMemo(() => buildAcademicYearOptions(terms), [terms]);
  const [draft, setDraft] = useState<HouseEventDraft>(() => emptyDraft());
  const [editingEvent, setEditingEvent] = useState<HouseEvent | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deletingEvent, setDeletingEvent] = useState<HouseEvent | null>(null);

  const { assets: houseProfiles, loading: profilesLoading, error: profilesError, refetch: refetchProfiles } = useAdminHouseAssets(selectedYear);
  const profilesById = useMemo(() => new Map(houseProfiles.map((asset) => [asset.id, asset])), [houseProfiles]);

  const queryClient = useQueryClient();
  const {
    data: events = [],
    isLoading: eventsLoading,
    isError: eventsError,
    refetch,
  } = useQuery({
    queryKey: ['admin', 'house-events', selectedYear],
    queryFn: () => houseEventsRepository.getAdminEvents(selectedYear),
    enabled: selectedYear !== null,
    staleTime: 60 * 1000,
    refetchOnWindowFocus: false,
  });

  // No House is ever chosen for the admin. When the year (and so the House
  // list) changes, drop any selection that is not a House of that year.
  useEffect(() => {
    setDraft((current) => {
      const kept = current.house_profile_ids.filter((id) => profilesById.has(id));
      return kept.length === current.house_profile_ids.length ? current : { ...current, house_profile_ids: kept };
    });
  }, [profilesById]);

  // One id per form session, so a retried create cannot make a second event.
  const requestIdRef = useRef<string>(crypto.randomUUID());
  // What the form held when it was last loaded, to tell unsaved edits apart.
  const baselineRef = useRef<HouseEventDraft>(draft);
  const formRef = useRef<HTMLFormElement>(null);

  // Both entry points (Admin Events and this tab) read the same key.
  const invalidateEvents = () => queryClient.invalidateQueries(['admin', 'house-events']);

  function loadForm(next: HouseEventDraft, event: HouseEvent | null) {
    setDraft(next);
    baselineRef.current = next;
    requestIdRef.current = crypto.randomUUID();
    setEditingEvent(event);
    setImageFile(null);
    setImagePreview(null);
  }

  function resetForm() {
    loadForm(emptyDraft(), null);
  }

  // Never drop typed changes without asking: run `action` now, or after the
  // admin confirms discarding them.
  const [pendingDiscard, setPendingDiscard] = useState<(() => void) | null>(null);
  function afterDiscard(action: () => void) {
    const dirty = imageFile !== null || JSON.stringify(draft) !== JSON.stringify(baselineRef.current);
    if (dirty) setPendingDiscard(() => action);
    else action();
  }

  // Deferred so it runs after a closing dialog has restored its own focus.
  function showForm() {
    window.setTimeout(() => {
      formRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
      formRef.current?.querySelector<HTMLInputElement>('#house-event-title')?.focus({ preventScroll: true });
    }, 0);
  }

  function editEvent(event: HouseEvent) {
    afterDiscard(() => {
      loadForm(draftFromEvent(event), event);
      showForm();
    });
  }

  // A fresh event (new id on save) with the same details, as a draft. The image
  // is not copied: deleting either event removes its image files.
  function duplicateEvent(event: HouseEvent) {
    afterDiscard(() => {
      loadForm({
        ...draftFromEvent(event),
        id: undefined,
        title: `${event.title} (copy)`,
        image_url: '',
        image_thumbnail_url: '',
        is_published: false,
      }, null);
      toast.success('Copied into the form as a new draft. Check the date, then save.');
      showForm();
    });
  }

  // Publishing goes through the atomic save, so the server re-checks the hosts
  // and refuses a stale version. Unpublishing only hides the event: a plain
  // update that leaves the hosts alone, so it works even when they need fixing.
  async function setPublished(event: HouseEvent, publish: boolean) {
    const hostIds = hostIdsOf(event);
    if (publish && hostIds.length === 0) throw new Error('Link a host House (Edit) before publishing.');
    const saved = publish
      ? await houseEventsRepository.saveEventAtomic({
        eventId: event.id,
        formData: { is_published: true, house_ids: hostIds },
        requestId: crypto.randomUUID(),
        expectedUpdatedAt: event.updated_at,
      })
      : false;
    const row = saved === false ? await houseEventsRepository.updateEvent(event.id, { is_published: publish }) : saved;
    // Keep an open edit of the same event in step, or its next save would be
    // refused as a conflicting change.
    if (editingEvent?.id === event.id) {
      setEditingEvent({ ...editingEvent, ...row, houses: editingEvent.houses });
      setDraft((current) => ({ ...current, is_published: publish }));
      baselineRef.current = { ...baselineRef.current, is_published: publish };
    }
    toast.success(publish ? `“${event.title}” is published.` : `“${event.title}” is a draft again.`);
    invalidateEvents();
  }

  async function uploadImage(file: File, profile: HousePageAsset): Promise<UploadedHouseEventImage> {
    const { file: preparedFile, reduction, wasCompressed } = await prepareImageForUpload(file, 'event');
    const { file: thumbnailFile } = await prepareImageForUpload(file, 'eventThumbnail');
    const uploadId = crypto.randomUUID();
    const houseSlug = houseSlugFromKey(profile.house_key || profile.house);
    const fileName = `house-events/${selectedYear}/${houseSlug}-${uploadId}.${getUploadExtension(preparedFile)}`;
    const thumbnailName = `house-events/${selectedYear}/thumbs/${houseSlug}-${uploadId}.${getUploadExtension(thumbnailFile)}`;

    const { error } = await supabase.storage.from('house_images').upload(fileName, preparedFile, {
      cacheControl: '31536000',
      contentType: preparedFile.type,
    });
    if (error) throw error;

    const { error: thumbnailError } = await supabase.storage.from('house_images').upload(thumbnailName, thumbnailFile, {
      cacheControl: '31536000',
      contentType: thumbnailFile.type,
    });
    if (thumbnailError) {
      await supabase.storage.from('house_images').remove([fileName]);
      throw thumbnailError;
    }

    if (wasCompressed && reduction > 10) {
      toast.success(`Image optimized (reduced by ${reduction}%)`);
    }

    const { data } = supabase.storage.from('house_images').getPublicUrl(fileName);
    const { data: thumbnailData } = supabase.storage.from('house_images').getPublicUrl(thumbnailName);
    return { imageUrl: data.publicUrl, thumbnailUrl: thumbnailData.publicUrl };
  }

  async function removeHouseEventImage(url?: string | null) {
    const objectName = extractSupabasePublicObjectName(url, 'house_images');
    if (objectName) await supabase.storage.from('house_images').remove([objectName]);
  }

  function toPayload(uploadedImage?: UploadedHouseEventImage | null): HouseEventFormData {
    const primaryProfile = profilesById.get(draft.house_profile_ids[0]);
    if (!primaryProfile) throw new Error('Primary House profile not found.');
    return {
      house_profile_id: primaryProfile.id,
      house_ids: draft.house_profile_ids,
      academic_year_start: primaryProfile.academic_year_start,
      academic_year_end: primaryProfile.academic_year_end,
      title: draft.title.trim(),
      slug: houseSlugFromKey(draft.title),
      description: nullable(draft.description),
      event_date: draft.event_date,
      start_time: draft.start_time || null,
      end_time: draft.end_time || null,
      location: nullable(draft.location),
      image_url: uploadedImage?.imageUrl ?? nullable(draft.image_url),
      image_thumbnail_url: uploadedImage?.thumbnailUrl ?? nullable(draft.image_thumbnail_url),
      gallery_url: nullable(draft.gallery_url),
      recap_url: nullable(draft.recap_url),
      rsvp_url: nullable(draft.rsvp_url),
      google_calendar_enabled: draft.google_calendar_enabled,
      is_published: draft.is_published,
    };
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const validationError = validateDraft(draft);
    if (validationError) {
      toast.error(validationError);
      return;
    }

    const primaryProfile = profilesById.get(draft.house_profile_ids[0]);
    if (!primaryProfile) {
      toast.error('Choose at least one valid House.');
      return;
    }

    setSaving(true);
    let stage = 'uploading the image';
    try {
      const uploadedImage = imageFile ? await uploadImage(imageFile, primaryProfile) : null;
      const payload = toPayload(uploadedImage);

      if (editingEvent) {
        // Leave the image columns alone unless this edit changed them, so a
        // form opened before the image-migration pipeline ran can't restore a
        // Supabase Storage URL (#436).
        const imageUnchanged =
          !uploadedImage &&
          draft.image_url === (editingEvent.image_url ?? '') &&
          draft.image_thumbnail_url === (editingEvent.image_thumbnail_url ?? '');
        const { image_url, image_thumbnail_url, ...rest } = payload;
        stage = 'saving the event';
        const saved = await houseEventsRepository.saveEventAtomic({
          eventId: editingEvent.id,
          formData: imageUnchanged ? rest : payload,
          requestId: requestIdRef.current,
          expectedUpdatedAt: editingEvent.updated_at,
        });
        if (saved === false) {
          await houseEventsRepository.updateEvent(editingEvent.id, imageUnchanged ? rest : payload);
        }
        if (uploadedImage) {
          await removeHouseEventImage(editingEvent.image_url);
          await removeHouseEventImage(editingEvent.image_thumbnail_url);
        }
        toast.success('House event updated.');
      } else {
        stage = 'saving the event';
        const saved = await houseEventsRepository.saveEventAtomic({
          eventId: null,
          formData: payload,
          requestId: requestIdRef.current,
          expectedUpdatedAt: null,
        });
        if (saved === false) await houseEventsRepository.createEvent(payload);
        toast.success(payload.is_published ? 'House event created and published.' : 'House event saved as a draft.');
      }

      resetForm();
      invalidateEvents();
    } catch (err) {
      console.error(err);
      const detail = err instanceof Error && err.message ? err.message : 'Unknown error.';
      toast.error(`Failed while ${stage}. ${detail}`);
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteConfirm(target: HouseEvent) {
    await houseEventsRepository.deleteEvent(target.id);
    try {
      await removeHouseEventImage(target.image_url);
      await removeHouseEventImage(target.image_thumbnail_url);
    } catch (err) {
      console.error(err);
      toast.error('The event was deleted, but its image files could not be removed.');
    }
    toast.success('House event deleted.');
    if (editingEvent?.id === target.id) resetForm();
    invalidateEvents();
  }

  function toggleHouse(id: string) {
    setDraft((prev) => {
      const next = prev.house_profile_ids.includes(id)
        ? prev.house_profile_ids.filter((h) => h !== id)
        : [...prev.house_profile_ids, id];
      return { ...prev, house_profile_ids: next };
    });
  }

  const today = getLosAngelesDateOnly();

  return (
    <div className="grid gap-6 p-4 sm:p-6 lg:p-8 xl:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
      <HouseEventPlanningPanel
        selectedYear={selectedYear}
        events={events}
        profiles={houseProfiles}
        today={today}
        loading={eventsLoading || profilesLoading}
        error={eventsError || !!profilesError}
        onRetry={() => { void refetch(); void refetchProfiles(); }}
        truncated={events.length >= ADMIN_HOUSE_EVENT_LIMIT}
      />
      <form ref={formRef} onSubmit={handleSubmit} aria-label="House event form" className="scrapbook-paper p-6 sm:p-8" style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}>
        <h2 className="font-serif text-xl font-bold" style={{ color: 'var(--color-text)' }}>
          {editingEvent ? 'Edit House Event' : 'Create House Event'}
        </h2>
        <p className="mt-2 font-sans text-sm leading-relaxed" style={{ color: 'var(--color-text2)' }}>
          Published House events appear on public House pages for the selected year. Collab events appear on every hosting House page.
        </p>

        <div className="mt-6 space-y-5">
          <div>
            <label className={labelCls}>Academic Year</label>
            <select
              value={selectedYear ?? ''}
              onChange={(event) => {
                const nextYear = Number(event.target.value);
                afterDiscard(() => {
                  onYearChange(nextYear);
                  resetForm();
                });
              }}
              className={inputCls}
            >
              {academicYearOptions.map((year) => (
                <option key={year.start} value={year.start}>{`${year.label}${year.isActive ? ' (Active)' : ''}`}</option>
              ))}
            </select>
          </div>

          <div>
            <label className={labelCls}>Hosting House(s) *</label>
            <p className="mt-1 text-[11px]" style={{ color: 'var(--color-text3)' }}>
              Select multiple for collab events. The first one you pick is the primary host
              {draft.house_profile_ids[0] && profilesById.get(draft.house_profile_ids[0])
                ? `: ${profilesById.get(draft.house_profile_ids[0])?.display_name || profilesById.get(draft.house_profile_ids[0])?.house_key}`
                : ' (none chosen yet)'}.
            </p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {houseProfiles.map((profile) => {
                const isSelected = draft.house_profile_ids.includes(profile.id);
                const color = getHouseColor(profile);
                return (
                  <button
                    key={profile.id}
                    type="button"
                    aria-pressed={isSelected}
                    onClick={() => toggleHouse(profile.id)}
                    className={`flex items-center gap-2 rounded border px-3 py-2 text-left transition-all ${isSelected ? 'shadow-sm' : 'opacity-60'}`}
                    style={{
                      borderColor: isSelected ? color : 'var(--color-border)',
                      background: isSelected ? `${color}11` : 'transparent',
                    }}
                  >
                    <div
                      className={`h-3 w-3 rounded-full border ${isSelected ? '' : 'bg-transparent'}`}
                      style={{
                        backgroundColor: isSelected ? color : 'transparent',
                        borderColor: isSelected ? color : 'var(--color-text3)',
                      }}
                    />
                    <span className="truncate font-sans text-[13px] font-medium" style={{ color: isSelected ? 'var(--color-text)' : 'var(--color-text2)' }}>
                      {getHouseLabel(profile)}
                    </span>
                  </button>
                );
              })}
            </div>
            {houseProfiles.length === 0 && (
              <p className="mt-1 text-xs" style={{ color: 'var(--color-text3)' }}>
                Create House profiles in Profiles & Images before adding House events for this year.
              </p>
            )}
          </div>

          <div>
            <label htmlFor="house-event-title" className={labelCls}>Title *</label>
            <input id="house-event-title" value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} className={inputCls} required placeholder="Bowser beach bonfire" />
          </div>

          <div>
            <label className={labelCls}>Description</label>
            <textarea value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} className={inputCls} rows={4} placeholder="Short public event description." />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="house-event-date" className={labelCls}>Date *</label>
              <input id="house-event-date" type="date" value={draft.event_date} onChange={(event) => setDraft({ ...draft, event_date: event.target.value })} className={inputCls} required />
            </div>
            <div>
              <label className={labelCls}>Location</label>
              <input value={draft.location} onChange={(event) => setDraft({ ...draft, location: event.target.value })} className={inputCls} placeholder="Library Walk" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Start time</label>
              <input type="time" value={draft.start_time} onChange={(event) => setDraft({ ...draft, start_time: event.target.value })} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>End time</label>
              <input type="time" value={draft.end_time} onChange={(event) => setDraft({ ...draft, end_time: event.target.value })} className={inputCls} />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label className={labelCls}>Gallery URL</label>
              <input type="url" value={draft.gallery_url} onChange={(event) => setDraft({ ...draft, gallery_url: event.target.value })} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Recap URL</label>
              <input type="url" value={draft.recap_url} onChange={(event) => setDraft({ ...draft, recap_url: event.target.value })} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>RSVP URL</label>
              <input type="url" value={draft.rsvp_url} onChange={(event) => setDraft({ ...draft, rsvp_url: event.target.value })} className={inputCls} />
            </div>
          </div>

          <div>
            <label className={labelCls}>Image</label>
            <p className="mt-1 text-xs" style={{ color: 'var(--color-text3)' }}>
              Images are compressed before upload to keep the site fast.
            </p>
            <ImageDropzone
              className="mt-2"
              preset="event"
              previewUrl={imagePreview || draft.image_thumbnail_url || draft.image_url}
              file={imageFile}
              previewAlt="House event preview"
              onSelect={(file, preview) => { setImageFile(file); setImagePreview(preview); }}
              onClear={() => {
                setImageFile(null);
                setImagePreview(null);
                setDraft({ ...draft, image_url: '', image_thumbnail_url: '' });
              }}
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex items-center gap-2 text-sm" style={{ color: 'var(--color-text2)' }}>
              <input type="checkbox" checked={draft.google_calendar_enabled} onChange={(event) => setDraft({ ...draft, google_calendar_enabled: event.target.checked })} />
              Add Google Calendar CTA
            </label>
            <label className="flex items-center gap-2 text-sm" style={{ color: 'var(--color-text2)' }}>
              <input type="checkbox" checked={draft.is_published} onChange={(event) => setDraft({ ...draft, is_published: event.target.checked })} />
              Publish now (otherwise saved as a draft)
            </label>
          </div>

          <div className="flex gap-3 pt-2">
            <button type="submit" disabled={saving || houseProfiles.length === 0} className="vsa-btn-primary flex-1 py-3 text-xs disabled:opacity-50">
              {saving ? 'Saving...' : editingEvent ? 'Save Changes' : 'Create House Event'}
            </button>
            {editingEvent && (
              <button type="button" onClick={resetForm} className="rounded border px-4 py-3 text-xs font-semibold" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text2)' }}>
                Cancel
              </button>
            )}
          </div>
        </div>
      </form>

      <HouseEventsDashboard
        // A new year starts with no host filter (its Houses are different).
        key={selectedYear ?? 'none'}
        selectedYear={selectedYear}
        events={events}
        profiles={houseProfiles}
        today={today}
        isLoading={eventsLoading}
        isError={eventsError}
        truncated={events.length >= ADMIN_HOUSE_EVENT_LIMIT}
        onRetry={() => refetch()}
        onEdit={editEvent}
        onDuplicate={duplicateEvent}
        onDelete={setDeletingEvent}
        onSetPublished={setPublished}
      />

      {pendingDiscard && (
        <ConfirmDialog
          open
          title="Discard unsaved changes?"
          description="The House event form has changes that are not saved. Discard them to continue, or cancel to keep editing."
          confirmLabel="Discard changes"
          onConfirm={() => pendingDiscard()}
          onClose={() => setPendingDiscard(null)}
        />
      )}

      {deletingEvent && (
        <ConfirmDialog
          open
          title="Delete this House event?"
          description={<>&ldquo;{deletingEvent.title}&rdquo; ({formatDateOnly(deletingEvent.event_date, 'MMM d, yyyy')}) is removed from every House page and the calendar, with its image. This cannot be undone; Unpublish keeps it as a draft instead.</>}
          confirmLabel="Delete"
          onConfirm={() => handleDeleteConfirm(deletingEvent)}
          onClose={() => setDeletingEvent(null)}
        />
      )}
    </div>
  );
}

