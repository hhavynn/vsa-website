// @ts-nocheck
import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { HOUSE_COLORS, HOUSE_LABELS, HouseName } from '../../../constants/houses';
import { houseAssetsRepository } from '../../../data/repos/houseAssets';
import { useAcademicTerms } from '../../../hooks/useAcademicTerms';
import { useAdminHouseAssets } from '../../../hooks/useHouseAssets';
import { formatAcademicYear, getAcademicTermMeta } from '../../../lib/academicTerms';
import { extractSupabasePublicObjectName, getUploadExtension, prepareImageForUpload } from '../../../lib/imageUpload';
import { supabase } from '../../../lib/supabase';
import { HousePageAsset } from '../../../types';

type HouseAssetDraft = {
  house_key: string;
  display_name: string;
  description: string;
  accent_color: string;
  is_active: boolean;
  image_url: string;
  image_thumbnail_url: string;
  image_alt: string;
  cover_image_url: string;
  source_doc_url: string;
  internal_notes: string;
};

type UploadedHouseImage = {
  imageUrl: string;
  thumbnailUrl: string;
};

function getCurrentAcademicYearStart() {
  return getAcademicTermMeta(new Date())?.academicYearStart ?? new Date().getFullYear();
}

function defaultAcademicYearStart(terms: ReturnType<typeof useAcademicTerms>['terms']) {
  return terms.find((term) => term.is_active)?.academic_year_start
    ?? getCurrentAcademicYearStart()
    ?? terms[0]?.academic_year_start
    ?? null;
}

function buildAcademicYearOptions(terms: ReturnType<typeof useAcademicTerms>['terms']) {
  const years = new Map<number, { start: number; label: string; isActive: boolean }>();
  const currentYear = getCurrentAcademicYearStart();

  years.set(currentYear, {
    start: currentYear,
    label: formatAcademicYear(currentYear),
    isActive: false,
  });

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

function emptyDraft(houseKey: string = ''): HouseAssetDraft {
  const houseName = houseKey as HouseName;
  return {
    house_key: houseKey,
    display_name: HOUSE_LABELS[houseName] || houseKey,
    description: '',
    accent_color: HOUSE_COLORS[houseName] || '#10b981',
    is_active: true,
    image_url: '',
    image_thumbnail_url: '',
    image_alt: HOUSE_LABELS[houseName] || houseKey,
    cover_image_url: '',
    source_doc_url: '',
    internal_notes: '',
  };
}

function nullable(value: string) {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function draftFromAsset(asset: HousePageAsset): HouseAssetDraft {
  return {
    house_key: asset.house_key || asset.house,
    display_name: asset.display_name || asset.house,
    description: asset.description || '',
    accent_color: asset.accent_color || HOUSE_COLORS[asset.house as HouseName] || '#10b981',
    is_active: asset.is_active ?? true,
    image_url: asset.image_url || '',
    image_thumbnail_url: asset.image_thumbnail_url || '',
    image_alt: asset.image_alt || asset.display_name || asset.house,
    cover_image_url: asset.cover_image_url || '',
    source_doc_url: asset.source_doc_url || '',
    internal_notes: asset.internal_notes || '',
  };
}

export function HouseImagesManager() {
  const { terms } = useAcademicTerms();
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const { assets, loading, error, refetch } = useAdminHouseAssets(selectedYear);
  const [drafts, setDrafts] = useState<Record<string, HouseAssetDraft>>({});
  const [files, setFiles] = useState<Record<string, File>>({});
  const [previews, setPreviews] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newHouseDraft, setNewHouseDraft] = useState<HouseAssetDraft>(() => emptyDraft());
  const academicYearOptions = useMemo(() => buildAcademicYearOptions(terms), [terms]);

  useEffect(() => {
    if (selectedYear === null) setSelectedYear(defaultAcademicYearStart(terms));
  }, [selectedYear, terms]);

  useEffect(() => {
    const nextDrafts: Record<string, HouseAssetDraft> = {};
    assets.forEach((asset) => {
      nextDrafts[asset.id] = draftFromAsset(asset);
    });
    setDrafts(nextDrafts);
    setFiles({});
    setPreviews((current) => {
      Object.values(current).forEach((url) => {
        if (url) URL.revokeObjectURL(url);
      });
      return {};
    });
  }, [assets]);

  useEffect(() => {
    return () => {
      Object.values(previews).forEach((url) => {
        if (url) URL.revokeObjectURL(url);
      });
    };
  }, [previews]);

  function updateDraft(id: string, patch: Partial<HouseAssetDraft>) {
    setDrafts((current) => ({
      ...current,
      [id]: {
        ...current[id],
        ...patch,
      },
    }));
  }

  function setHouseFile(id: string, file: File | null) {
    setFiles((current) => {
      const next = { ...current };
      if (file) next[id] = file;
      else delete next[id];
      return next;
    });

    setPreviews((current) => {
      if (current[id]) URL.revokeObjectURL(current[id]);
      const next = { ...current };
      if (file) next[id] = URL.createObjectURL(file);
      else delete next[id];
      return next;
    });
  }

  async function uploadHouseImage(houseKey: string, file: File): Promise<UploadedHouseImage> {
    const { file: preparedFile, reduction, wasCompressed } = await prepareImageForUpload(file, 'house');
    const { file: thumbnailFile } = await prepareImageForUpload(file, 'houseThumbnail');
    const uploadId = crypto.randomUUID();
    const houseSlug = houseKey.toLowerCase().replace(/\s+/g, '-');
    const fileName = `houses/${selectedYear}/${houseSlug}-${uploadId}.${getUploadExtension(preparedFile)}`;
    const thumbnailName = `houses/${selectedYear}/thumbs/${houseSlug}-${uploadId}.${getUploadExtension(thumbnailFile)}`;
    
    const { error: uploadError } = await supabase.storage.from('house_images').upload(fileName, preparedFile, {
      cacheControl: '31536000',
      contentType: preparedFile.type,
    });
    if (uploadError) throw uploadError;

    const { error: thumbnailError } = await supabase.storage.from('house_images').upload(thumbnailName, thumbnailFile, {
      cacheControl: '31536000',
      contentType: thumbnailFile.type,
    });
    if (thumbnailError) {
      await supabase.storage.from('house_images').remove([fileName]);
      throw thumbnailError;
    }

    if (wasCompressed && reduction > 10) {
      toast.success(`${houseKey} image optimized (reduced by ${reduction}%)`, { icon: '⚡' });
    }

    const { data } = supabase.storage.from('house_images').getPublicUrl(fileName);
    const { data: thumbnailData } = supabase.storage.from('house_images').getPublicUrl(thumbnailName);
    return {
      imageUrl: data.publicUrl,
      thumbnailUrl: thumbnailData.publicUrl,
    };
  }

  async function removeHouseImage(url?: string | null) {
    const objectName = extractSupabasePublicObjectName(url, 'house_images');
    if (objectName) await supabase.storage.from('house_images').remove([objectName]);
  }

  async function saveAsset(id: string) {
    if (!selectedYear) return;
    const asset = assets.find(a => a.id === id);
    if (!asset) return;

    try {
      setSavingId(id);
      const file = files[id];
      const draft = drafts[id];
      const oldImageUrl = asset.image_url;
      const oldThumbnailUrl = asset.image_thumbnail_url;
      const uploadedImage = file ? await uploadHouseImage(draft.house_key || asset.house, file) : null;
      
      const imageUrl = uploadedImage?.imageUrl ?? draft.image_url;
      const imageThumbnailUrl = uploadedImage?.thumbnailUrl ?? draft.image_thumbnail_url;

      await houseAssetsRepository.upsertAsset({
        id,
        academic_year_start: selectedYear,
        academic_year_end: selectedYear + 1,
        house: asset.house,
        house_key: nullable(draft.house_key) ?? asset.house,
        display_name: nullable(draft.display_name) ?? asset.display_name,
        description: nullable(draft.description),
        accent_color: nullable(draft.accent_color),
        is_active: draft.is_active,
        image_url: nullable(imageUrl),
        image_thumbnail_url: nullable(imageThumbnailUrl),
        image_alt: nullable(draft.image_alt) ?? draft.display_name,
        cover_image_url: nullable(draft.cover_image_url),
        display_order: asset.display_order,
        source_doc_url: nullable(draft.source_doc_url),
        internal_notes: nullable(draft.internal_notes),
      });

      if (uploadedImage) {
        await removeHouseImage(oldImageUrl);
        await removeHouseImage(oldThumbnailUrl);
      }
      setHouseFile(id, null);
      toast.success(`${draft.display_name} saved.`);
      await refetch();
    } catch (err) {
      console.error(err);
      toast.error(`Failed to save changes.`);
    } finally {
      setSavingId(null);
    }
  }

  async function handleAddHouse() {
    if (!selectedYear) return;
    if (!newHouseDraft.house_key.trim()) {
      toast.error('House Key is required.');
      return;
    }

    try {
      setSavingId('new');
      await houseAssetsRepository.upsertAsset({
        academic_year_start: selectedYear,
        academic_year_end: selectedYear + 1,
        house: newHouseDraft.house_key,
        house_key: newHouseDraft.house_key,
        display_name: newHouseDraft.display_name,
        description: nullable(newHouseDraft.description),
        accent_color: nullable(newHouseDraft.accent_color),
        is_active: newHouseDraft.is_active,
        image_url: null,
        image_thumbnail_url: null,
        image_alt: newHouseDraft.display_name,
        cover_image_url: null,
        display_order: assets.length,
        source_doc_url: null,
        internal_notes: null,
      });
      toast.success('House profile created.');
      setNewHouseDraft(emptyDraft());
      setShowAddForm(false);
      await refetch();
    } catch (err) {
      console.error(err);
      toast.error('Failed to create house.');
    } finally {
      setSavingId(null);
    }
  }

  return (
    <div style={{ padding: '20px 28px' }}>
      <div className="mb-5 rounded-md border p-5" style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>House Page Images & Profiles</h2>
            <p className="mt-1 max-w-2xl text-xs leading-relaxed" style={{ color: 'var(--color-text2)' }}>
              Manage House identities for each school year. Profiles created here appear on public House pages and standings.
            </p>
          </div>
          <div className="flex items-end gap-3">
            <div className="w-full max-w-xs text-right">
              <label className="mb-1 block text-right text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--color-text3)' }}>
                Viewing Year
              </label>
              <select
                value={selectedYear ?? ''}
                onChange={(event) => setSelectedYear(Number(event.target.value))}
                className="w-full rounded border px-3 py-2 text-sm"
                style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface2)', color: 'var(--color-text)' }}
              >
                {academicYearOptions.map((year) => (
                  <option key={year.start} value={year.start}>
                    {`${year.label}${year.isActive ? ' (Active)' : ''}`}
                  </option>
                ))}
              </select>
            </div>
            <button
              onClick={() => setShowAddForm(true)}
              className="vsa-btn-primary px-4 py-2 text-xs"
            >
              + Add House
            </button>
          </div>
        </div>
        {error && (
          <p className="mt-4 text-xs text-amber-600 dark:text-amber-400">
            House image assets could not be loaded.
          </p>
        )}
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        {assets.map((asset) => {
          const draft = drafts[asset.id] || draftFromAsset(asset);
          const previewUrl = previews[asset.id] ?? (draft.image_thumbnail_url || draft.image_url);
          const color = draft.accent_color;
          const saving = savingId === asset.id;

          return (
            <div key={asset.id} className="rounded-md border" style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}>
              <div className="flex items-center justify-between gap-4 border-b px-5 py-4" style={{ borderColor: 'var(--color-border)' }}>
                <div>
                  <h3 className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>{draft.display_name}</h3>
                  <p className="mt-0.5 text-[10px] font-mono uppercase tracking-wider" style={{ color: 'var(--color-text3)' }}>
                    {draft.house_key}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  {!draft.is_active && (
                    <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-[9px] font-bold uppercase text-zinc-500">Archived</span>
                  )}
                  <span className="h-3 w-3 rounded-full" style={{ background: color }} />
                </div>
              </div>

              <div className="grid gap-5 p-5 md:grid-cols-[180px_minmax(0,1fr)]">
                <div>
                  <div
                    className="aspect-[4/3] overflow-hidden rounded border"
                    style={{ borderColor: 'var(--color-border)', background: `linear-gradient(135deg, ${color}22, var(--color-surface2))` }}
                  >
                    {previewUrl ? (
                      <img src={previewUrl} alt={draft.image_alt} className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full items-center justify-center">
                        <span className="font-serif text-3xl italic" style={{ color: 'var(--color-border)' }}>VSA</span>
                      </div>
                    )}
                  </div>
                  <label
                    htmlFor={`house-image-${asset.id}`}
                    className="mt-3 block cursor-pointer rounded border px-3 py-2 text-center text-xs font-medium"
                    style={{ borderColor: 'var(--color-border)', color: 'var(--color-text2)' }}
                  >
                    {previewUrl ? 'Change Image' : 'Upload Image'}
                  </label>
                  <input
                    id={`house-image-${asset.id}`}
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className="sr-only"
                    onChange={(event) => setHouseFile(asset.id, event.target.files?.[0] ?? null)}
                  />
                </div>

                <div className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--color-text3)' }}>
                        Display Name
                      </label>
                      <input
                        value={draft.display_name}
                        onChange={(event) => updateDraft(asset.id, { display_name: event.target.value })}
                        className="w-full rounded border px-3 py-2 text-sm"
                        style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface2)', color: 'var(--color-text)' }}
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--color-text3)' }}>
                        Accent Color
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={draft.accent_color}
                          onChange={(event) => updateDraft(asset.id, { accent_color: event.target.value })}
                          className="h-[38px] w-12 rounded border p-1"
                          style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface2)' }}
                        />
                        <input
                          value={draft.accent_color}
                          onChange={(event) => updateDraft(asset.id, { accent_color: event.target.value })}
                          className="flex-1 rounded border px-3 py-2 text-sm"
                          style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface2)', color: 'var(--color-text)' }}
                        />
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--color-text3)' }}>
                      Description
                    </label>
                    <textarea
                      value={draft.description}
                      onChange={(event) => updateDraft(asset.id, { description: event.target.value })}
                      rows={2}
                      className="w-full rounded border px-3 py-2 text-sm"
                      style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface2)', color: 'var(--color-text)' }}
                    />
                  </div>

                  <label className="flex items-center gap-2 text-xs" style={{ color: 'var(--color-text2)' }}>
                    <input
                      type="checkbox"
                      checked={draft.is_active}
                      onChange={(event) => updateDraft(asset.id, { is_active: event.target.checked })}
                      className="rounded border-[var(--color-border)] bg-transparent text-[var(--brand)] focus:ring-[var(--brand)]"
                    />
                    Published and active for this year
                  </label>

                  <div className="flex flex-wrap gap-3 pt-1">
                    <button
                      type="button"
                      onClick={() => saveAsset(asset.id)}
                      disabled={saving || loading}
                      className="rounded bg-indigo-600 px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-indigo-700 disabled:opacity-40"
                    >
                      {saving ? 'Saving...' : 'Save Profile'}
                    </button>
                    {previewUrl && (
                      <button
                        type="button"
                        onClick={() => {
                          updateDraft(asset.id, { image_url: '', image_thumbnail_url: '' });
                          setHouseFile(asset.id, null);
                        }}
                        className="rounded border px-4 py-2 text-xs font-medium"
                        style={{ borderColor: 'var(--color-border)', color: 'var(--color-text2)' }}
                      >
                        Clear Image
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
        {assets.length === 0 && !loading && (
          <div className="col-span-2 py-12 text-center">
            <p className="font-sans text-sm" style={{ color: 'var(--color-text3)' }}>
              No House profiles found for {selectedYear ? formatAcademicYear(selectedYear) : 'this year'}.
            </p>
            <button
              onClick={() => setShowAddForm(true)}
              className="mt-4 text-xs font-semibold text-brand-600"
            >
              Add the first House profile →
            </button>
          </div>
        )}
      </div>

      {showAddForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="scrapbook-paper w-full max-w-md p-6 sm:p-8" style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}>
            <h2 className="font-serif text-xl font-bold">New House Profile</h2>
            <p className="mt-2 text-xs" style={{ color: 'var(--color-text2)' }}>
              Create a house identity for the {selectedYear ? formatAcademicYear(selectedYear) : ''} year.
            </p>

            <div className="mt-6 space-y-4">
              <div>
                <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--color-text3)' }}>
                  House Key *
                </label>
                <input
                  placeholder="e.g. Bowser"
                  value={newHouseDraft.house_key}
                  onChange={(e) => {
                    const val = e.target.value;
                    setNewHouseDraft({ ...newHouseDraft, house_key: val, display_name: val, image_alt: val });
                  }}
                  className="w-full rounded border px-3 py-2 text-sm"
                  style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface2)', color: 'var(--color-text)' }}
                />
                <p className="mt-1 text-[10px]" style={{ color: 'var(--color-text3)' }}>This is the unique identifier for this house this year.</p>
              </div>

              <div>
                <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--color-text3)' }}>
                  Display Name
                </label>
                <input
                  value={newHouseDraft.display_name}
                  onChange={(e) => setNewHouseDraft({ ...newHouseDraft, display_name: e.target.value })}
                  className="w-full rounded border px-3 py-2 text-sm"
                  style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface2)', color: 'var(--color-text)' }}
                />
              </div>

              <div>
                <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--color-text3)' }}>
                  Accent Color
                </label>
                <input
                  type="color"
                  value={newHouseDraft.accent_color}
                  onChange={(e) => setNewHouseDraft({ ...newHouseDraft, accent_color: e.target.value })}
                  className="h-10 w-full rounded border p-1"
                  style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface2)' }}
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={handleAddHouse}
                  disabled={savingId === 'new'}
                  className="vsa-btn-primary flex-1 py-2 text-xs"
                >
                  {savingId === 'new' ? 'Creating...' : 'Create Profile'}
                </button>
                <button
                  onClick={() => setShowAddForm(false)}
                  className="flex-1 rounded border px-4 py-2 text-xs font-semibold"
                  style={{ borderColor: 'var(--color-border)', color: 'var(--color-text2)' }}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
