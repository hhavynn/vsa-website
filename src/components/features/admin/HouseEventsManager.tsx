import { useEffect, useMemo, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import toast from 'react-hot-toast';
import { useQuery } from 'react-query';
import { houseEventsRepository, HouseEventFormData } from '../../../data/repos/houseEvents';
import { useAcademicTerms } from '../../../hooks/useAcademicTerms';
import { useAdminHouseAssets } from '../../../hooks/useHouseAssets';
import { HOUSE_COLORS, HOUSE_LABELS, HouseName } from '../../../constants/houses';
import { formatAcademicYear, getAcademicTermMeta } from '../../../lib/academicTerms';
import { formatDateOnly } from '../../../lib/dateOnly';
import { formatEventTimeRange, isEndAfterStart, timeToInputValue } from '../../../lib/eventTime';
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
  years.set(currentYear, { start: currentYear, label: formatAcademicYear(currentYear), isActive: false });
  terms.forEach((term) => {
    const existing = years.get(term.academic_year_start);
    years.set(term.academic_year_start, {
      start: term.academic_year_start,
      label: `${term.academic_year_start}-${term.academic_year_end}`,
      isActive: term.is_active || existing?.isActive || false,
    });
  });
  return Array.from(years.values()).sort((a, b) => b.start - a.start);
}

function defaultAcademicYearStart(terms: ReturnType<typeof useAcademicTerms>['terms']) {
  return terms.find((term) => term.is_active)?.academic_year_start
    ?? getCurrentAcademicYearStart()
    ?? terms[0]?.academic_year_start
    ?? null;
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
    is_published: true,
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

export function HouseEventsManager() {
  const { terms } = useAcademicTerms();
  const academicYearOptions = useMemo(() => buildAcademicYearOptions(terms), [terms]);
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [draft, setDraft] = useState<HouseEventDraft>(() => emptyDraft());
  const [editingEvent, setEditingEvent] = useState<HouseEvent | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deletingEvent, setDeletingEvent] = useState<HouseEvent | null>(null);

  useEffect(() => {
    if (selectedYear === null) setSelectedYear(defaultAcademicYearStart(terms));
  }, [selectedYear, terms]);

  const { assets: houseProfiles } = useAdminHouseAssets(selectedYear);
  const profilesById = useMemo(() => new Map(houseProfiles.map((asset) => [asset.id, asset])), [houseProfiles]);

  const {
    data: events = [],
    isLoading: eventsLoading,
    refetch,
  } = useQuery({
    queryKey: ['admin', 'house-events', selectedYear],
    queryFn: () => houseEventsRepository.getAdminEvents(selectedYear),
    enabled: selectedYear !== null,
    staleTime: 60 * 1000,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    if (draft.house_profile_ids.length === 0 && houseProfiles[0] && !editingEvent) {
      setDraft((current) => ({ ...current, house_profile_ids: [houseProfiles[0].id] }));
    }
  }, [draft.house_profile_ids.length, houseProfiles, editingEvent]);

  const onDrop = (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': ['.png', '.jpg', '.jpeg', '.webp'] },
    maxFiles: 1,
    maxSize: 10 * 1024 * 1024,
  });

  function resetForm() {
    setDraft({
      ...emptyDraft(),
      house_profile_ids: houseProfiles[0] ? [houseProfiles[0].id] : [],
    });
    setEditingEvent(null);
    setImageFile(null);
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImagePreview(null);
  }

  function editEvent(event: HouseEvent) {
    setEditingEvent(event);
    setDraft(draftFromEvent(event));
    setImageFile(null);
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImagePreview(null);
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
    try {
      const uploadedImage = imageFile ? await uploadImage(imageFile, primaryProfile) : null;
      const payload = toPayload(uploadedImage);

      if (editingEvent) {
        await houseEventsRepository.updateEvent(editingEvent.id, payload);
        if (uploadedImage) {
          await removeHouseEventImage(editingEvent.image_url);
          await removeHouseEventImage(editingEvent.image_thumbnail_url);
        }
        toast.success('House event updated.');
      } else {
        await houseEventsRepository.createEvent(payload);
        toast.success('House event created.');
      }

      resetForm();
      refetch();
    } catch (err) {
      console.error(err);
      toast.error('Failed to save House event.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteConfirm() {
    if (!deletingEvent) return;
    try {
      await houseEventsRepository.deleteEvent(deletingEvent.id);
      await removeHouseEventImage(deletingEvent.image_url);
      await removeHouseEventImage(deletingEvent.image_thumbnail_url);
      toast.success('House event deleted.');
      if (editingEvent?.id === deletingEvent.id) resetForm();
      refetch();
    } catch (err) {
      console.error(err);
      toast.error('Failed to delete House event.');
    } finally {
      setDeletingEvent(null);
    }
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
  const upcomingEvents = events.filter((event) => event.event_date >= today);
  const pastEvents = events.filter((event) => event.event_date < today);

  return (
    <div className="grid gap-6 p-4 sm:p-6 lg:p-8 xl:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
      <form onSubmit={handleSubmit} className="scrapbook-paper p-6 sm:p-8" style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}>
        <h2 className="font-serif text-xl font-bold" style={{ color: 'var(--color-text)' }}>
          {editingEvent ? 'Edit House Event' : 'Create House Event'}
        </h2>
        <p className="mt-2 font-sans text-sm leading-relaxed" style={{ color: 'var(--color-text2)' }}>
          These events appear on public House pages. Collab events appear on all hosting House pages.
        </p>

        <div className="mt-6 space-y-5">
          <div>
            <label className={labelCls}>Academic Year</label>
            <select
              value={selectedYear ?? ''}
              onChange={(event) => {
                const nextYear = Number(event.target.value);
                setSelectedYear(nextYear);
                setDraft({ ...emptyDraft(), house_profile_ids: [] });
                setEditingEvent(null);
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
            <p className="mt-1 text-[11px]" style={{ color: 'var(--color-text3)' }}>Select multiple for collab events.</p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {houseProfiles.map((profile) => {
                const isSelected = draft.house_profile_ids.includes(profile.id);
                const color = getHouseColor(profile);
                return (
                  <button
                    key={profile.id}
                    type="button"
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
                Create House profiles in the House Page Images tab before adding House events.
              </p>
            )}
          </div>

          <div>
            <label className={labelCls}>Title *</label>
            <input value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} className={inputCls} required placeholder="Bowser beach bonfire" />
          </div>

          <div>
            <label className={labelCls}>Description</label>
            <textarea value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} className={inputCls} rows={4} placeholder="Short public event description." />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className={labelCls}>Date *</label>
              <input type="date" value={draft.event_date} onChange={(event) => setDraft({ ...draft, event_date: event.target.value })} className={inputCls} required />
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
            <div {...getRootProps()} className={`mt-2 flex min-h-[150px] cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed p-5 transition-colors ${isDragActive ? 'border-[var(--brand)] bg-[var(--brand)]/5' : 'border-[var(--color-border)] hover:bg-[var(--color-surface2)]'}`}>
              <input {...getInputProps()} />
              {imagePreview || draft.image_thumbnail_url || draft.image_url ? (
                <img src={imagePreview || draft.image_thumbnail_url || draft.image_url} alt="House event preview" className="max-h-44 rounded object-cover shadow-sm" />
              ) : (
                <p className="text-xs" style={{ color: 'var(--color-text3)' }}>Drag and drop or click to upload</p>
              )}
            </div>
            {(imageFile || draft.image_url) && (
              <button
                type="button"
                className="mt-2 text-xs font-semibold text-red-500 hover:text-red-600"
                onClick={() => {
                  setImageFile(null);
                  if (imagePreview) URL.revokeObjectURL(imagePreview);
                  setImagePreview(null);
                  setDraft({ ...draft, image_url: '', image_thumbnail_url: '' });
                }}
              >
                Remove image
              </button>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex items-center gap-2 text-sm" style={{ color: 'var(--color-text2)' }}>
              <input type="checkbox" checked={draft.google_calendar_enabled} onChange={(event) => setDraft({ ...draft, google_calendar_enabled: event.target.checked })} />
              Add Google Calendar CTA
            </label>
            <label className="flex items-center gap-2 text-sm" style={{ color: 'var(--color-text2)' }}>
              <input type="checkbox" checked={draft.is_published} onChange={(event) => setDraft({ ...draft, is_published: event.target.checked })} />
              Published
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

      <div className="space-y-6">
        <div className="scrapbook-paper overflow-hidden" style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}>
          <div className="border-b px-5 py-4" style={{ borderColor: 'var(--color-border)' }}>
            <h2 className="font-serif text-xl font-bold" style={{ color: 'var(--color-text)' }}>Manage House Events</h2>
            <p className="mt-1 font-sans text-xs" style={{ color: 'var(--color-text3)' }}>
              {events.length} event{events.length !== 1 ? 's' : ''} for {selectedYear ? formatAcademicYear(selectedYear) : 'this year'}.
            </p>
          </div>
          {eventsLoading ? (
            <p className="py-12 text-center text-sm" style={{ color: 'var(--color-text3)' }}>Loading House events...</p>
          ) : events.length === 0 ? (
            <p className="py-12 text-center text-sm" style={{ color: 'var(--color-text3)' }}>No House events yet.</p>
          ) : (
            <div>
              {[
                ['Upcoming', upcomingEvents],
                ['Past', pastEvents],
              ].map(([label, groupedEvents]) => (
                (groupedEvents as HouseEvent[]).length > 0 && (
                  <div key={label as string}>
                    <div className="border-y bg-[var(--color-surface2)] px-4 py-2 first:border-t-0" style={{ borderColor: 'var(--color-border)' }}>
                      <p className="font-mono text-[10px] font-bold uppercase tracking-[0.1em]" style={{ color: 'var(--color-text3)' }}>{label as string}</p>
                    </div>
                    <div className="divide-y" style={{ borderColor: 'var(--color-border)' }}>
                      {(groupedEvents as HouseEvent[]).map((event) => {
                        const eventHouses = event.houses || [];
                        const primaryHouse = eventHouses[0] || profilesById.get(event.house_profile_id);
                        const color = getHouseColor(primaryHouse);
                        const timeLabel = event.start_time && event.end_time ? formatEventTimeRange(event.start_time, event.end_time) : null;
                        return (
                          <div key={event.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start">
                            {(event.image_thumbnail_url || event.image_url) && (
                              <img src={event.image_thumbnail_url || event.image_url || ''} alt={event.title} className="h-32 w-full rounded border object-cover sm:h-16 sm:w-16" style={{ borderColor: 'var(--color-border)' }} />
                            )}
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                {eventHouses.length > 0 ? (
                                  eventHouses.map((h) => (
                                    <span key={h.id} className="rounded-full px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider text-white" style={{ background: getHouseColor(h) }}>
                                      {getHouseLabel(h)}
                                    </span>
                                  ))
                                ) : (
                                  <span className="rounded-full px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider text-white" style={{ background: color }}>
                                    {getHouseLabel(primaryHouse)}
                                  </span>
                                )}
                                {!event.is_published && <span className="rounded border px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wide" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text3)' }}>Draft</span>}
                              </div>
                              <p className="mt-1 truncate font-sans text-sm font-semibold" style={{ color: 'var(--color-text)' }}>{event.title}</p>
                              <p className="mt-1 font-mono text-[11px]" style={{ color: 'var(--color-text3)' }}>
                                {formatDateOnly(event.event_date, 'MMM d, yyyy')}{timeLabel ? ` / ${timeLabel}` : ''}
                              </p>
                            </div>
                            <div className="flex gap-2">
                              <button type="button" onClick={() => editEvent(event)} className="rounded border px-3 py-1.5 text-xs font-medium" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text2)' }}>
                                Edit
                              </button>
                              <button type="button" onClick={() => setDeletingEvent(event)} className="rounded border border-red-900/30 px-3 py-1.5 text-xs font-medium text-red-600 transition-colors hover:bg-red-600 hover:text-white">
                                Delete
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )
              ))}
            </div>
          )}
        </div>
      </div>

      {deletingEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="scrapbook-paper max-w-md p-6" style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}>
            <h2 className="font-serif text-xl font-bold" style={{ color: 'var(--color-text)' }}>Delete House event?</h2>
            <p className="mt-2 font-sans text-sm" style={{ color: 'var(--color-text2)' }}>
              This removes "{deletingEvent.title}" from public House pages.
            </p>
            <div className="mt-6 flex gap-3">
              <button type="button" onClick={handleDeleteConfirm} className="flex-1 rounded bg-red-600 px-4 py-2.5 text-sm font-semibold text-white">
                Delete
              </button>
              <button type="button" onClick={() => setDeletingEvent(null)} className="flex-1 rounded border px-4 py-2.5 text-sm font-semibold" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text2)' }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

