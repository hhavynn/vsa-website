// @ts-nocheck
import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { HOUSE_COLORS, HOUSE_LABELS, HOUSE_OPTIONS, HouseName } from '../../../constants/houses';
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
  image_alt: string;
  source_doc_url: string;
  internal_notes: string;
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

function emptyDraft(house: HouseName): HouseAssetDraft {
  return {
    house_key: house,
    display_name: HOUSE_LABELS[house],
    description: '',
    accent_color: HOUSE_COLORS[house],
    is_active: true,
    image_url: '',
    image_alt: HOUSE_LABELS[house],
    source_doc_url: '',
    internal_notes: '',
  };
}

function nullable(value: string) {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function draftFromAsset(house: HouseName, asset?: HousePageAsset): HouseAssetDraft {
  return {
    house_key: asset?.house_key ?? asset?.house ?? house,
    display_name: asset?.display_name ?? HOUSE_LABELS[house],
    description: asset?.description ?? '',
    accent_color: asset?.accent_color ?? HOUSE_COLORS[house],
    is_active: asset?.is_active ?? true,
    image_url: asset?.image_url ?? '',
    image_alt: asset?.image_alt ?? HOUSE_LABELS[house],
    source_doc_url: asset?.source_doc_url ?? '',
    internal_notes: asset?.internal_notes ?? '',
  };
}

export function HouseImagesManager() {
  const { terms } = useAcademicTerms();
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const { assets, loading, error, refetch } = useAdminHouseAssets(selectedYear);
  const [drafts, setDrafts] = useState<Record<HouseName, HouseAssetDraft>>(() => (
    HOUSE_OPTIONS.reduce((acc, house) => ({ ...acc, [house]: emptyDraft(house) }), {} as Record<HouseName, HouseAssetDraft>)
  ));
  const [files, setFiles] = useState<Partial<Record<HouseName, File>>>({});
  const [previews, setPreviews] = useState<Partial<Record<HouseName, string>>>({});
  const [savingHouse, setSavingHouse] = useState<HouseName | null>(null);
  const academicYearOptions = useMemo(() => buildAcademicYearOptions(terms), [terms]);

  useEffect(() => {
    if (selectedYear === null) setSelectedYear(defaultAcademicYearStart(terms));
  }, [selectedYear, terms]);

  useEffect(() => {
    const assetsByHouse = new Map(assets.map((asset) => [asset.house, asset]));
    setDrafts(
      HOUSE_OPTIONS.reduce((acc, house) => ({
        ...acc,
        [house]: draftFromAsset(house, assetsByHouse.get(house)),
      }), {} as Record<HouseName, HouseAssetDraft>),
    );
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

  function updateDraft(house: HouseName, patch: Partial<HouseAssetDraft>) {
    setDrafts((current) => ({
      ...current,
      [house]: {
        ...current[house],
        ...patch,
      },
    }));
  }

  function setHouseFile(house: HouseName, file: File | null) {
    setFiles((current) => {
      const next = { ...current };
      if (file) next[house] = file;
      else delete next[house];
      return next;
    });

    setPreviews((current) => {
      if (current[house]) URL.revokeObjectURL(current[house] as string);
      const next = { ...current };
      if (file) next[house] = URL.createObjectURL(file);
      else delete next[house];
      return next;
    });
  }

  async function uploadHouseImage(house: HouseName, file: File) {
    const preparedFile = await prepareImageForUpload(file, 'house');
    const fileExt = getUploadExtension(preparedFile);
    const fileName = `${selectedYear}/${house.toLowerCase().replace(/\s+/g, '-')}-${crypto.randomUUID()}.${fileExt}`;
    const { error: uploadError } = await supabase.storage.from('house_images').upload(fileName, preparedFile, {
      cacheControl: '31536000',
      contentType: preparedFile.type,
    });
    if (uploadError) throw uploadError;
    const { data } = supabase.storage.from('house_images').getPublicUrl(fileName);
    return data.publicUrl;
  }

  async function removeHouseImage(url?: string | null) {
    const objectName = extractSupabasePublicObjectName(url, 'house_images');
    if (objectName) await supabase.storage.from('house_images').remove([objectName]);
  }

  async function saveAsset(house: HouseName) {
    if (!selectedYear) {
      toast.error('Choose an academic year first.');
      return;
    }

    try {
      setSavingHouse(house);
      const file = files[house];
      const draft = drafts[house] ?? emptyDraft(house);
      const oldImageUrl = draft.image_url;
      const uploadedUrl = file ? await uploadHouseImage(house, file) : null;

      await houseAssetsRepository.upsertAsset({
        academic_year_start: selectedYear,
        academic_year_end: selectedYear + 1,
        house,
        house_key: nullable(draft.house_key) ?? house,
        display_name: nullable(draft.display_name) ?? HOUSE_LABELS[house],
        description: nullable(draft.description),
        accent_color: nullable(draft.accent_color),
        is_active: draft.is_active,
        image_url: nullable(uploadedUrl ?? draft.image_url),
        image_alt: nullable(draft.image_alt) ?? HOUSE_LABELS[house],
        display_order: HOUSE_OPTIONS.indexOf(house),
        source_doc_url: nullable(draft.source_doc_url),
        internal_notes: nullable(draft.internal_notes),
      });

      if (uploadedUrl) await removeHouseImage(oldImageUrl);
      setHouseFile(house, null);
      toast.success(`${HOUSE_LABELS[house]} image saved.`);
      await refetch();
    } catch (err) {
      console.error(err);
      toast.error(`Failed to save ${HOUSE_LABELS[house]} image.`);
    } finally {
      setSavingHouse(null);
    }
  }

  async function clearAsset(house: HouseName) {
    if (!selectedYear) return;

    try {
      setSavingHouse(house);
      await houseAssetsRepository.upsertAsset({
        academic_year_start: selectedYear,
        academic_year_end: selectedYear + 1,
        house,
        house_key: nullable(drafts[house]?.house_key ?? '') ?? house,
        display_name: nullable(drafts[house]?.display_name ?? '') ?? HOUSE_LABELS[house],
        description: nullable(drafts[house]?.description ?? ''),
        accent_color: nullable(drafts[house]?.accent_color ?? ''),
        is_active: drafts[house]?.is_active ?? true,
        image_url: null,
        image_alt: HOUSE_LABELS[house],
        display_order: HOUSE_OPTIONS.indexOf(house),
        source_doc_url: nullable(drafts[house]?.source_doc_url ?? ''),
        internal_notes: nullable(drafts[house]?.internal_notes ?? ''),
      });
      setHouseFile(house, null);
      toast.success(`${HOUSE_LABELS[house]} image cleared.`);
      await refetch();
    } catch (err) {
      console.error(err);
      toast.error(`Failed to clear ${HOUSE_LABELS[house]} image.`);
    } finally {
      setSavingHouse(null);
    }
  }

  return (
    <div style={{ padding: '20px 28px' }}>
      <div className="mb-5 rounded-md border p-5" style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>House Page Images</h2>
            <p className="mt-1 max-w-2xl text-xs leading-relaxed" style={{ color: 'var(--color-text2)' }}>
              Set the public image for each House. Uploads use the house_images storage bucket, pasted URLs stay where they are.
            </p>
          </div>
          <div className="w-full max-w-xs">
            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--color-text3)' }}>
              Academic Year
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
        </div>
        {error && (
          <p className="mt-4 text-xs text-amber-600 dark:text-amber-400">
            House image assets could not be loaded. Apply the house_page_assets migration before editing.
          </p>
        )}
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        {HOUSE_OPTIONS.map((house) => {
          const draft = drafts[house] ?? emptyDraft(house);
          const previewUrl = previews[house] ?? draft.image_url;
          const color = HOUSE_COLORS[house];
          const saving = savingHouse === house;

          return (
            <div key={house} className="rounded-md border" style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}>
              <div className="flex items-center justify-between gap-4 border-b px-5 py-4" style={{ borderColor: 'var(--color-border)' }}>
                <div>
                  <h3 className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>{HOUSE_LABELS[house]}</h3>
                  <p className="mt-0.5 text-xs" style={{ color: 'var(--color-text3)' }}>
                    {selectedYear ? formatAcademicYear(selectedYear) : 'Choose a year'}
                  </p>
                </div>
                <span className="h-3 w-3 rounded-full" style={{ background: color }} />
              </div>

              <div className="grid gap-5 p-5 md:grid-cols-[180px_minmax(0,1fr)]">
                <div>
                  <div
                    className="aspect-[4/3] overflow-hidden rounded border"
                    style={{ borderColor: 'var(--color-border)', background: `linear-gradient(135deg, ${color}22, var(--color-surface2))` }}
                  >
                    {previewUrl ? (
                      <img src={previewUrl} alt={draft.image_alt || HOUSE_LABELS[house]} className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full items-center justify-center">
                        <div
                          className="grid h-14 w-14 place-items-center rounded-full border font-serif text-xl"
                          style={{ borderColor: `${color}66`, color, background: 'var(--color-surface)' }}
                        >
                          {house === 'Donkey Kong' ? 'DK' : house.slice(0, 2).toUpperCase()}
                        </div>
                      </div>
                    )}
                  </div>
                  <label
                    htmlFor={`house-image-${house}`}
                    className="mt-3 block cursor-pointer rounded border px-3 py-2 text-center text-xs font-medium"
                    style={{ borderColor: 'var(--color-border)', color: 'var(--color-text2)' }}
                  >
                    Upload Image
                  </label>
                  <input
                    id={`house-image-${house}`}
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className="sr-only"
                    onChange={(event) => setHouseFile(house, event.target.files?.[0] ?? null)}
                  />
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--color-text3)' }}>
                      Display Name
                    </label>
                    <input
                      value={draft.display_name}
                      onChange={(event) => updateDraft(house, { display_name: event.target.value })}
                      className="w-full rounded border px-3 py-2 text-sm"
                      style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface2)', color: 'var(--color-text)' }}
                    />
                  </div>
                  <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_110px]">
                    <div>
                      <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--color-text3)' }}>
                        House Key
                      </label>
                      <input
                        value={draft.house_key}
                        onChange={(event) => updateDraft(house, { house_key: event.target.value })}
                        className="w-full rounded border px-3 py-2 text-sm"
                        style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface2)', color: 'var(--color-text)' }}
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--color-text3)' }}>
                        Accent
                      </label>
                      <input
                        type="color"
                        value={draft.accent_color || color}
                        onChange={(event) => updateDraft(house, { accent_color: event.target.value })}
                        className="h-[38px] w-full rounded border px-2 py-1"
                        style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface2)' }}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--color-text3)' }}>
                      Description
                    </label>
                    <textarea
                      value={draft.description}
                      onChange={(event) => updateDraft(house, { description: event.target.value })}
                      rows={2}
                      className="w-full rounded border px-3 py-2 text-sm"
                      style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface2)', color: 'var(--color-text)' }}
                    />
                  </div>
                  <label className="flex items-center gap-2 text-xs" style={{ color: 'var(--color-text2)' }}>
                    <input
                      type="checkbox"
                      checked={draft.is_active}
                      onChange={(event) => updateDraft(house, { is_active: event.target.checked })}
                      className="rounded border-[var(--color-border)] bg-transparent text-[var(--brand)] focus:ring-[var(--brand)]"
                    />
                    Active on public House pages and leaderboards
                  </label>
                  <div>
                    <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--color-text3)' }}>
                      Image URL
                    </label>
                    <input
                      type="url"
                      value={draft.image_url}
                      onChange={(event) => updateDraft(house, { image_url: event.target.value })}
                      className="w-full rounded border px-3 py-2 text-sm"
                      placeholder="https://..."
                      style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface2)', color: 'var(--color-text)' }}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--color-text3)' }}>
                      Alt Text
                    </label>
                    <input
                      value={draft.image_alt}
                      onChange={(event) => updateDraft(house, { image_alt: event.target.value })}
                      className="w-full rounded border px-3 py-2 text-sm"
                      style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface2)', color: 'var(--color-text)' }}
                    />
                  </div>
                  <div className="flex flex-wrap gap-3 pt-1">
                    <button
                      type="button"
                      onClick={() => saveAsset(house)}
                      disabled={saving || loading || !selectedYear}
                      className="rounded bg-indigo-600 px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-indigo-700 disabled:opacity-40"
                    >
                      {saving ? 'Saving...' : 'Save Image'}
                    </button>
                    <button
                      type="button"
                      onClick={() => clearAsset(house)}
                      disabled={saving || loading || !selectedYear || !previewUrl}
                      className="rounded border px-4 py-2 text-xs font-medium disabled:opacity-40"
                      style={{ borderColor: 'var(--color-border)', color: 'var(--color-text2)' }}
                    >
                      Clear Image
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
