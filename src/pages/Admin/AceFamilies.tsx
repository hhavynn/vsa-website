import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useDropzone } from 'react-dropzone';
import { useQueryClient } from 'react-query';
import { PageTitle } from '../../components/common/PageTitle';
import { PageLoader } from '../../components/common/PageLoader';
import { PageError } from '../../components/common/PageError';
import {
  useAdminAceFamilies,
  useAdminAceFamilyMembers,
} from '../../hooks/useAceFamilies';
import {
  AceFamilyFormData,
  AceFamilyMemberFormData,
  aceFamiliesRepository,
} from '../../data/repos/aceFamilies';
import { AceFamily, AceFamilyMember } from '../../types';
import { ImportPlan, buildImportPlan, validateJson } from '../../lib/aceFamilyImport';
import { extractSupabasePublicObjectName } from '../../lib/imageUpload';
import { supabase } from '../../lib/supabase';

const inputCls =
  'mt-1 block w-full rounded border px-3 py-2.5 text-[15px] sm:py-2 sm:text-sm focus:outline-none focus:border-[var(--brand)] focus:ring-1 focus:ring-[var(--brand)] bg-[var(--color-surface2)] border-[var(--color-border)] text-[var(--color-text)] placeholder-[var(--color-text3)] transition';
const labelCls = 'block font-mono text-[10px] font-bold uppercase tracking-[0.1em] text-[var(--color-text3)]';

function fieldStyle() {
  return {
    borderColor: 'var(--color-border)',
    background: 'var(--color-surface)',
    color: 'var(--color-text)',
  } as const;
}

function slugify(input: string) {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
}

function isValidSlug(slug: string) {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug);
}

function isValidHex(color: string) {
  return /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(color);
}

type FamilyDraft = {
  name: string;
  slug: string;
  cover_image_url: string;
  theme_color: string;
  description: string;
  display_order: string;
  is_published: boolean;
};

const EMPTY_FAMILY_DRAFT: FamilyDraft = {
  name: '',
  slug: '',
  cover_image_url: '',
  theme_color: '',
  description: '',
  display_order: '0',
  is_published: false,
};

function draftFromFamily(family: AceFamily): FamilyDraft {
  return {
    name: family.name,
    slug: family.slug,
    cover_image_url: family.cover_image_url ?? '',
    theme_color: family.theme_color ?? '',
    description: family.description ?? '',
    display_order: String(family.display_order ?? 0),
    is_published: family.is_published,
  };
}

function nullable(value: string) {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Member row
// ─────────────────────────────────────────────────────────────────────────────

function MemberRow({
  member,
  membersById,
  parentOptions,
  onSave,
  onDelete,
  saving,
}: {
  member: AceFamilyMember;
  membersById: Map<string, AceFamilyMember>;
  parentOptions: AceFamilyMember[];
  onSave: (id: string, patch: Partial<AceFamilyMemberFormData>, file: File | null) => Promise<void>;
  onDelete: (id: string) => void;
  saving: boolean;
}) {
  const [name, setName] = useState(member.name);
  const [role, setRole] = useState(member.role_label ?? '');
  const [photoUrl, setPhotoUrl] = useState(member.photo_url ?? '');
  const [parentId, setParentId] = useState(member.parent_member_id ?? '');
  const [published, setPublished] = useState(member.is_published);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string>('');

  useEffect(() => {
    setName(member.name);
    setRole(member.role_label ?? '');
    setPhotoUrl(member.photo_url ?? '');
    setParentId(member.parent_member_id ?? '');
    setPublished(member.is_published);
    setPhotoFile(null);
    setPhotoPreview('');
  }, [member.id, member.name, member.role_label, member.photo_url, member.parent_member_id, member.is_published]);

  const onDrop = useCallback((accepted: File[]) => {
    const file = accepted[0];
    if (!file) return;
    setPhotoFile(file);
    const reader = new FileReader();
    reader.onload = () => setPhotoPreview(reader.result as string);
    reader.readAsDataURL(file);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': ['.png', '.jpg', '.jpeg', '.webp'] },
    maxFiles: 1,
    maxSize: 8 * 1024 * 1024,
  });

  // Filter parents: not self, not any descendant of self (prevents cycles)
  const safeParents = useMemo(() => {
    const forbidden = new Set<string>([member.id]);
    const addDescendants = (id: string) => {
      Array.from(membersById.values()).forEach((m) => {
        if (m.parent_member_id === id && !forbidden.has(m.id)) {
          forbidden.add(m.id);
          addDescendants(m.id);
        }
      });
    };
    addDescendants(member.id);
    return parentOptions.filter((m) => !forbidden.has(m.id));
  }, [member.id, membersById, parentOptions]);

  const preview = photoPreview || photoUrl;

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error('Member name is required');
      return;
    }
    await onSave(
      member.id,
      {
        name: name.trim(),
        role_label: nullable(role),
        photo_url: nullable(photoUrl),
        parent_member_id: parentId || null,
        is_published: published,
      },
      photoFile,
    );
    setPhotoFile(null);
    setPhotoPreview('');
  };

  return (
    <div
      className="grid grid-cols-1 md:grid-cols-[88px_minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1fr)_auto] gap-3 items-start rounded border p-3"
      style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}
    >
      <div
        {...getRootProps()}
        className="flex h-20 w-20 cursor-pointer items-center justify-center overflow-hidden rounded border border-dashed"
        style={{
          borderColor: isDragActive ? 'var(--color-text2)' : 'var(--color-border)',
          background: isDragActive ? 'var(--color-surface2)' : 'transparent',
        }}
        title="Click or drop to upload member photo"
      >
        <input {...getInputProps()} />
        {preview ? (
          <img src={preview} alt={name || 'Member'} className="h-full w-full object-cover" />
        ) : (
          <span className="font-sans text-[10px]" style={{ color: 'var(--color-text3)' }}>
            Photo
          </span>
        )}
      </div>

      <div className="space-y-2">
        <div>
          <label className={labelCls} style={{ color: 'var(--color-text3)' }}>Name *</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={inputCls}
            style={fieldStyle()}
          />
        </div>
        <div>
          <label className={labelCls} style={{ color: 'var(--color-text3)' }}>Photo URL</label>
          <input
            type="url"
            value={photoUrl}
            onChange={(e) => {
              setPhotoUrl(e.target.value);
              setPhotoFile(null);
              setPhotoPreview('');
            }}
            className={inputCls}
            style={fieldStyle()}
            placeholder="https://..."
          />
        </div>
      </div>

      <div>
        <label className={labelCls} style={{ color: 'var(--color-text3)' }}>Role Label</label>
        <input
          type="text"
          value={role}
          onChange={(e) => setRole(e.target.value)}
          className={inputCls}
          style={fieldStyle()}
          placeholder="Big, Little, Grandbig…"
        />
      </div>

      <div>
        <label className={labelCls} style={{ color: 'var(--color-text3)' }}>Parent / Big</label>
        <select
          value={parentId}
          onChange={(e) => setParentId(e.target.value)}
          className={inputCls}
          style={fieldStyle()}
        >
          <option value="">— None (root)</option>
          {safeParents.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
              {p.role_label ? ` (${p.role_label})` : ''}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col items-end gap-2 pt-5">
        <label className="flex items-center gap-1.5 font-sans text-xs" style={{ color: 'var(--color-text2)' }}>
          <input
            type="checkbox"
            checked={published}
            onChange={(e) => setPublished(e.target.checked)}
          />
          Published
        </label>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="rounded border px-2.5 py-1 font-sans text-xs font-medium transition-colors disabled:opacity-50"
            style={{ background: 'var(--color-text)', color: 'var(--color-bg)', borderColor: 'transparent' }}
          >
            Save
          </button>
          <button
            type="button"
            onClick={() => onDelete(member.id)}
            disabled={saving}
            className="rounded border px-2.5 py-1 font-sans text-xs text-red-500 hover:text-red-400 disabled:opacity-50"
            style={{ borderColor: 'var(--color-border)', background: 'transparent' }}
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Tree preview
// ─────────────────────────────────────────────────────────────────────────────

function TreePreview({ members }: { members: AceFamilyMember[] }) {
  const childrenByParent = useMemo(() => {
    const map = new Map<string | null, AceFamilyMember[]>();
    members.forEach((m) => {
      const key = m.parent_member_id ?? null;
      const list = map.get(key) ?? [];
      list.push(m);
      map.set(key, list);
    });
    map.forEach((list) => list.sort((a, b) => a.name.localeCompare(b.name)));
    return map;
  }, [members]);

  const renderNode = (m: AceFamilyMember, depth: number) => {
    const kids = childrenByParent.get(m.id) ?? [];
    return (
      <div key={m.id} style={{ marginLeft: depth === 0 ? 0 : 16 }}>
        <div
          className="flex items-center gap-2 py-1 font-sans text-xs"
          style={{ color: m.is_published ? 'var(--color-text)' : 'var(--color-text3)' }}
        >
          <span className="font-mono text-[10px]" style={{ color: 'var(--color-text3)' }}>
            {depth === 0 ? '●' : '└'}
          </span>
          <span>{m.name}</span>
          {m.role_label && (
            <span className="font-sans text-[10px] italic" style={{ color: 'var(--color-text3)' }}>
              {m.role_label}
            </span>
          )}
          {!m.is_published && (
            <span className="font-sans text-[10px]" style={{ color: 'var(--color-text3)' }}>
              (draft)
            </span>
          )}
        </div>
        {kids.length > 0 && (
          <div style={{ borderLeft: '1px dashed var(--color-border)', marginLeft: 4, paddingLeft: 8 }}>
            {kids.map((kid) => renderNode(kid, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  const roots = childrenByParent.get(null) ?? [];

  if (members.length === 0) {
    return (
      <p className="font-sans text-xs" style={{ color: 'var(--color-text3)' }}>
        No members yet.
      </p>
    );
  }

  return <div>{roots.map((r) => renderNode(r, 0))}</div>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Main page
// ─────────────────────────────────────────────────────────────────────────────

export default function AdminAceFamilies() {
  const queryClient = useQueryClient();
  const { families, loading, error, refetch } = useAdminAceFamilies();
  const [selectedFamilyId, setSelectedFamilyId] = useState<string | null>(null);
  const selectedFamily = useMemo(
    () => families.find((f) => f.id === selectedFamilyId) ?? null,
    [families, selectedFamilyId],
  );

  const [familyDraft, setFamilyDraft] = useState<FamilyDraft>(EMPTY_FAMILY_DRAFT);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string>('');
  const [savingFamily, setSavingFamily] = useState(false);
  const [autoSlug, setAutoSlug] = useState(true);

  const { members, refetch: refetchMembers } = useAdminAceFamilyMembers(selectedFamilyId);
  const [savingMemberId, setSavingMemberId] = useState<string | null>(null);
  const [newMemberName, setNewMemberName] = useState('');

  // ── Import JSON state ──────────────────────────────────────
  const [importOpen, setImportOpen] = useState(false);
  const [importJson, setImportJson] = useState('');
  const [importPublished, setImportPublished] = useState(false);
  const [importThemeColor, setImportThemeColor] = useState('');
  const [importPreview, setImportPreview] = useState<ImportPlan | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    if (selectedFamily) {
      setFamilyDraft(draftFromFamily(selectedFamily));
      setAutoSlug(false);
    } else {
      setFamilyDraft(EMPTY_FAMILY_DRAFT);
      setAutoSlug(true);
    }
    setCoverFile(null);
    setCoverPreview('');
  }, [selectedFamily]);

  const membersById = useMemo(() => {
    const map = new Map<string, AceFamilyMember>();
    members.forEach((m) => map.set(m.id, m));
    return map;
  }, [members]);

  const onCoverDrop = useCallback((accepted: File[]) => {
    const file = accepted[0];
    if (!file) return;
    setCoverFile(file);
    const reader = new FileReader();
    reader.onload = () => setCoverPreview(reader.result as string);
    reader.readAsDataURL(file);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: onCoverDrop,
    accept: { 'image/*': ['.png', '.jpg', '.jpeg', '.webp'] },
    maxFiles: 1,
    maxSize: 8 * 1024 * 1024,
  });

  async function removeAceImage(url?: string | null) {
    const objectName = extractSupabasePublicObjectName(url, 'ace_family_images');
    if (objectName) await supabase.storage.from('ace_family_images').remove([objectName]);
  }

  const invalidateLists = async () => {
    await queryClient.invalidateQueries(['ace-families']);
    await queryClient.invalidateQueries(['ace-family-members']);
  };

  const handleNewFamily = () => {
    setSelectedFamilyId(null);
    setFamilyDraft(EMPTY_FAMILY_DRAFT);
    setAutoSlug(true);
  };

  const handleFamilySubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!familyDraft.name.trim()) {
      toast.error('Family name is required');
      return;
    }
    const slugCandidate = (familyDraft.slug || slugify(familyDraft.name)).trim();
    if (!isValidSlug(slugCandidate)) {
      toast.error('Slug must be lowercase letters/numbers separated by hyphens');
      return;
    }
    if (familyDraft.theme_color && !isValidHex(familyDraft.theme_color)) {
      toast.error('Theme color must be a hex like #E07856');
      return;
    }

    try {
      setSavingFamily(true);
      let coverUrl = familyDraft.cover_image_url.trim();
      if (coverFile) {
        coverUrl = await aceFamiliesRepository.uploadImage(coverFile, 'family');
      }

      const payload: AceFamilyFormData = {
        academic_year_start: selectedFamily?.academic_year_start ?? null,
        academic_year_end: selectedFamily?.academic_year_end ?? null,
        name: familyDraft.name.trim(),
        slug: slugCandidate,
        cover_image_url: nullable(coverUrl),
        theme_color: nullable(familyDraft.theme_color),
        description: nullable(familyDraft.description),
        display_order: Number(familyDraft.display_order || 0),
        is_published: familyDraft.is_published,
      };

      if (selectedFamily) {
        await aceFamiliesRepository.updateFamily(selectedFamily.id, payload);
        if (coverFile) await removeAceImage(selectedFamily.cover_image_url);
        toast.success('Family updated');
      } else {
        const created = await aceFamiliesRepository.createFamily(payload);
        setSelectedFamilyId(created.id);
        toast.success('Family created');
      }

      setCoverFile(null);
      setCoverPreview('');
      await invalidateLists();
      await refetch();
    } catch (err) {
      console.error(err);
      const message = err instanceof Error ? err.message : 'Failed to save family';
      toast.error(message);
    } finally {
      setSavingFamily(false);
    }
  };

  const handleDeleteFamily = async () => {
    if (!selectedFamily) return;
    if (!window.confirm(`Delete fam "${selectedFamily.name}" and all its members? This cannot be undone.`)) return;
    try {
      await aceFamiliesRepository.deleteFamily(selectedFamily.id);
      toast.success('Family deleted');
      setSelectedFamilyId(null);
      await invalidateLists();
      await refetch();
    } catch (err) {
      console.error(err);
      toast.error('Failed to delete family');
    }
  };

  const handleAddMember = async () => {
    if (!selectedFamily) return;
    if (!newMemberName.trim()) {
      toast.error('Enter a name to add');
      return;
    }
    try {
      await aceFamiliesRepository.createMember({
        family_id: selectedFamily.id,
        name: newMemberName.trim(),
        role_label: null,
        photo_url: null,
        parent_member_id: null,
        display_order: members.length,
        is_published: true,
      });
      setNewMemberName('');
      toast.success('Member added');
      await refetchMembers();
    } catch (err) {
      console.error(err);
      toast.error('Failed to add member');
    }
  };

  const handleSaveMember = async (
    id: string,
    patch: Partial<AceFamilyMemberFormData>,
    file: File | null,
  ) => {
    try {
      setSavingMemberId(id);
      let finalPatch = patch;
      if (file) {
        const url = await aceFamiliesRepository.uploadImage(file, 'member');
        finalPatch = { ...patch, photo_url: url };
      }
      await aceFamiliesRepository.updateMember(id, finalPatch);
      if (file) {
        const currentMember = members.find((member) => member.id === id);
        await removeAceImage(currentMember?.photo_url);
      }
      toast.success('Member saved');
      await refetchMembers();
    } catch (err) {
      console.error(err);
      const message = err instanceof Error ? err.message : 'Failed to save member';
      toast.error(message);
    } finally {
      setSavingMemberId(null);
    }
  };

  const handlePreviewImport = () => {
    setImportError(null);
    setImportPreview(null);
    let parsed: unknown;
    try {
      parsed = JSON.parse(importJson);
    } catch (err) {
      setImportError(err instanceof Error ? `Invalid JSON: ${err.message}` : 'Invalid JSON.');
      return;
    }
    const v = validateJson(parsed);
    if (!v.ok) {
      setImportError(v.error);
      return;
    }
    try {
      const plan = buildImportPlan(v.json);
      setImportPreview(plan);
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'Failed to build plan.');
    }
  };

  const handleRunImport = async () => {
    if (!importPreview) {
      toast.error('Click Preview first.');
      return;
    }
    if (importThemeColor && !isValidHex(importThemeColor)) {
      toast.error('Theme color must be a hex like #E07856.');
      return;
    }
    try {
      setImporting(true);
      const { family, memberCount } = await aceFamiliesRepository.bulkCreateFamily(
        {
          theme_color: importThemeColor.trim() || null,
          cover_image_url: null,
          display_order: 0,
          is_published: importPublished,
        },
        importPreview,
      );
      toast.success(`Imported "${family.name}" with ${memberCount} members`);
      setImportOpen(false);
      setImportJson('');
      setImportPreview(null);
      setImportError(null);
      setSelectedFamilyId(family.id);
      await queryClient.invalidateQueries(['ace-families']);
      await queryClient.invalidateQueries(['ace-family-members']);
      await refetch();
    } catch (err) {
      console.error(err);
      const message = err instanceof Error ? err.message : 'Import failed.';
      toast.error(message);
    } finally {
      setImporting(false);
    }
  };

  const handleDeleteMember = async (id: string) => {
    if (!window.confirm('Remove this member from the fam?')) return;
    try {
      const member = members.find((item) => item.id === id);
      await aceFamiliesRepository.deleteMember(id);
      await removeAceImage(member?.photo_url);
      toast.success('Member removed');
      await refetchMembers();
    } catch (err) {
      console.error(err);
      toast.error('Failed to remove member');
    }
  };

  if (loading) {
    return (
      <>
        <PageTitle title="ACE Fams" />
        <PageLoader message="Loading ACE families..." />
      </>
    );
  }

  if (error) {
    return (
      <>
        <PageTitle title="ACE Fams" />
        <PageError message="Failed to load ACE families" />
      </>
    );
  }

  const previewCover = coverPreview || familyDraft.cover_image_url;
  const slugForPlaceholder = slugify(familyDraft.name) || 'fam-slug';

  return (
    <div className="flex-1 overflow-y-auto">
      <PageTitle title="ACE Fams" />

      <div
        className="border-b px-6 py-6 sm:flex sm:items-center sm:justify-between sm:gap-4 sm:px-8 sm:py-8"
        style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}
      >
        <div className="mb-4 sm:mb-0">
          <h1 className="font-serif text-3xl font-bold tracking-tight sm:text-4xl" style={{ color: 'var(--color-text)' }}>
            ACE Fams
          </h1>
          <p className="mt-2 font-sans text-sm" style={{ color: 'var(--color-text2)' }}>
            Manage timeless ACE families and Big/Little tree structure.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => {
              setImportOpen((o) => !o);
              setImportError(null);
            }}
            className="rounded border bg-transparent px-4 py-2 text-[13px] font-semibold transition-colors hover:bg-[var(--color-surface2)]"
            style={{ borderColor: 'var(--color-border)', color: 'var(--color-text2)' }}
          >
            {importOpen ? 'Close Import' : 'Import JSON'}
          </button>
          <button
            type="button"
            onClick={handleNewFamily}
            className="vsa-btn-primary px-4 py-2 text-[13px]"
          >
            + New Fam
          </button>
        </div>
      </div>

      {importOpen && (
        <div
          className="border-b"
          style={{ padding: '20px 28px', borderColor: 'var(--color-border)', background: 'var(--color-surface2)' }}
        >
          <h2 className="font-sans text-sm font-semibold" style={{ color: 'var(--color-text)' }}>
            Import fam from JSON
          </h2>
          <p className="mt-1 mb-4 font-sans text-xs" style={{ color: 'var(--color-text2)' }}>
            Paste a fam tree JSON (Sweatpants-style schema). Click <span className="font-medium">Preview</span> to validate and see the planned roster, then <span className="font-medium">Run Import</span> to create the fam plus all members in one shot. People referenced only in <code>littles</code> arrays are also created.
          </p>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,420px)]">
            <div>
              <label className={labelCls} style={{ color: 'var(--color-text3)' }}>JSON</label>
              <textarea
                value={importJson}
                onChange={(e) => {
                  setImportJson(e.target.value);
                  setImportPreview(null);
                  setImportError(null);
                }}
                className={`${inputCls} font-mono`}
                style={{ ...fieldStyle(), minHeight: 220 }}
                placeholder='{ "family": "Sweatpants", "members": [...] }'
                spellCheck={false}
              />
              {importError && (
                <p className="mt-2 font-sans text-xs text-red-500">{importError}</p>
              )}
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={handlePreviewImport}
                  disabled={importing || !importJson.trim()}
                  className="rounded border px-4 py-2 font-sans text-xs font-medium disabled:opacity-50"
                  style={{ borderColor: 'var(--color-border)', color: 'var(--color-text2)', background: 'transparent' }}
                >
                  Preview
                </button>
                <button
                  type="button"
                  onClick={handleRunImport}
                  disabled={importing || !importPreview}
                  className="rounded px-4 py-2 font-sans text-xs font-medium disabled:opacity-50"
                  style={{ background: 'var(--color-text)', color: 'var(--color-bg)', border: 'none' }}
                >
                  {importing ? 'Importing…' : 'Run Import'}
                </button>
              </div>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-3">
                <div>
                  <label className={labelCls} style={{ color: 'var(--color-text3)' }}>Theme color (optional)</label>
                  <div className="mt-1 flex items-center gap-2">
                    <input
                      type="color"
                      value={isValidHex(importThemeColor) ? importThemeColor : '#000000'}
                      onChange={(e) => setImportThemeColor(e.target.value)}
                      className="h-9 w-12 rounded border"
                      style={{ borderColor: 'var(--color-border)' }}
                    />
                    <input
                      type="text"
                      value={importThemeColor}
                      onChange={(e) => setImportThemeColor(e.target.value)}
                      className={`${inputCls} mt-0`}
                      style={fieldStyle()}
                      placeholder="#E07856"
                    />
                  </div>
                </div>
              </div>

              <label className="flex items-center gap-2 font-sans text-xs" style={{ color: 'var(--color-text2)' }}>
                <input
                  type="checkbox"
                  checked={importPublished}
                  onChange={(e) => setImportPublished(e.target.checked)}
                />
                Publish immediately (otherwise imports as draft)
              </label>

              {importPreview && (
                <div
                  className="rounded border p-3 font-sans text-xs"
                  style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}
                >
                  <div className="font-semibold" style={{ color: 'var(--color-text)' }}>
                    Plan: {importPreview.familyName}{' '}
                    <span style={{ color: 'var(--color-text3)' }}>/{importPreview.familySlug}</span>
                  </div>
                  <div className="mt-1" style={{ color: 'var(--color-text2)' }}>
                    {importPreview.people.length} members ·{' '}
                    {importPreview.people.filter((p) => p.role_label === 'Big').length} bigs ·{' '}
                    {importPreview.people.filter((p) => p.role_label === 'Little').length} littles ·{' '}
                    {importPreview.people.filter((p) => p.parent_id === null).length} roots
                  </div>
                  {importPreview.description && (
                    <div className="mt-1" style={{ color: 'var(--color-text3)' }}>
                      {importPreview.description}
                    </div>
                  )}
                  {importPreview.warnings.length > 0 && (
                    <ul className="mt-2 list-disc pl-4" style={{ color: '#d4841a' }}>
                      {importPreview.warnings.map((w, i) => (
                        <li key={i}>{w}</li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,320px)_minmax(0,1fr)]" style={{ padding: '20px 28px' }}>
        {/* Family list */}
        <div className="rounded-md border h-fit" style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}>
          <div className="border-b px-4 py-3" style={{ borderColor: 'var(--color-border)' }}>
            <h2 className="font-sans text-sm font-semibold" style={{ color: 'var(--color-text)' }}>
              Families ({families.length})
            </h2>
            <p className="mt-0.5 font-sans text-[11px]" style={{ color: 'var(--color-text3)' }}>
              {families.filter((f) => f.is_published).length} published
            </p>
          </div>
          {families.length === 0 ? (
            <p className="px-4 py-8 text-center font-sans text-xs" style={{ color: 'var(--color-text3)' }}>
              No fams yet.
            </p>
          ) : (
            <ul className="divide-y" style={{ borderColor: 'var(--color-border)' }}>
              {families.map((f) => (
                <li key={f.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedFamilyId(f.id)}
                    className="block w-full px-4 py-3 text-left transition-opacity hover:opacity-80"
                    style={{
                      background: selectedFamilyId === f.id ? 'var(--color-surface2)' : 'transparent',
                      border: 'none',
                    }}
                  >
                    <div className="flex items-center gap-3">
                      {f.cover_image_url ? (
                        <img
                          src={f.cover_image_url}
                          alt={f.name}
                          className="h-10 w-10 rounded object-cover"
                        />
                      ) : (
                        <div
                          className="h-10 w-10 rounded"
                          style={{ background: f.theme_color || 'var(--color-surface2)' }}
                          aria-hidden
                        />
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="font-sans text-sm font-medium" style={{ color: 'var(--color-text)' }}>
                          {f.name}
                        </div>
                        <div className="font-sans text-[11px]" style={{ color: 'var(--color-text3)' }}>
                          /{f.slug} · order {f.display_order}
                        </div>
                      </div>
                      <span
                        className="rounded-sm border px-2 py-0.5 font-sans text-[10px]"
                        style={{
                          borderColor: 'var(--color-border)',
                          color: f.is_published ? 'var(--color-text)' : 'var(--color-text3)',
                        }}
                      >
                        {f.is_published ? 'Live' : 'Draft'}
                      </span>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Family editor */}
        <div className="space-y-6">
          <form
            onSubmit={handleFamilySubmit}
            className="rounded-md border p-6 space-y-5"
            style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="font-sans text-base font-semibold" style={{ color: 'var(--color-text)' }}>
                  {selectedFamily ? `Edit ${selectedFamily.name}` : 'Create New Fam'}
                </h2>
                <p className="mt-1 font-sans text-xs" style={{ color: 'var(--color-text2)' }}>
                  Cover, name, slug, theme color, description, and publish status.
                </p>
              </div>
              {selectedFamily && (
                <button
                  type="button"
                  onClick={handleDeleteFamily}
                  className="rounded border px-3 py-1.5 font-sans text-xs text-red-500 hover:text-red-400"
                  style={{ borderColor: 'var(--color-border)', background: 'transparent' }}
                >
                  Delete Fam
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              <div>
                <label className={labelCls} style={{ color: 'var(--color-text3)' }}>Name *</label>
                <input
                  type="text"
                  value={familyDraft.name}
                  onChange={(e) => {
                    const name = e.target.value;
                    setFamilyDraft((prev) => ({
                      ...prev,
                      name,
                      slug: autoSlug ? slugify(name) : prev.slug,
                    }));
                  }}
                  className={inputCls}
                  style={fieldStyle()}
                  required
                />
              </div>
              <div>
                <label className={labelCls} style={{ color: 'var(--color-text3)' }}>Slug *</label>
                <input
                  type="text"
                  value={familyDraft.slug}
                  onChange={(e) => {
                    setAutoSlug(false);
                    setFamilyDraft((prev) => ({ ...prev, slug: e.target.value }));
                  }}
                  className={inputCls}
                  style={fieldStyle()}
                  placeholder={slugForPlaceholder}
                />
                <p className="mt-1 font-sans text-[11px]" style={{ color: 'var(--color-text3)' }}>
                  lowercase, numbers, hyphens. Used in URLs.
                </p>
              </div>
              <div>
                <label className={labelCls} style={{ color: 'var(--color-text3)' }}>Theme Color</label>
                <div className="mt-1 flex items-center gap-2">
                  <input
                    type="color"
                    value={isValidHex(familyDraft.theme_color) ? familyDraft.theme_color : '#000000'}
                    onChange={(e) =>
                      setFamilyDraft((prev) => ({ ...prev, theme_color: e.target.value }))
                    }
                    className="h-9 w-12 rounded border"
                    style={{ borderColor: 'var(--color-border)' }}
                  />
                  <input
                    type="text"
                    value={familyDraft.theme_color}
                    onChange={(e) =>
                      setFamilyDraft((prev) => ({ ...prev, theme_color: e.target.value }))
                    }
                    className={`${inputCls} mt-0`}
                    style={fieldStyle()}
                    placeholder="#E07856"
                  />
                </div>
              </div>
              <div>
                <label className={labelCls} style={{ color: 'var(--color-text3)' }}>Display Order</label>
                <input
                  type="number"
                  value={familyDraft.display_order}
                  onChange={(e) =>
                    setFamilyDraft((prev) => ({ ...prev, display_order: e.target.value }))
                  }
                  className={inputCls}
                  style={fieldStyle()}
                />
              </div>
            </div>

            <div>
              <label className={labelCls} style={{ color: 'var(--color-text3)' }}>Description</label>
              <textarea
                value={familyDraft.description}
                onChange={(e) =>
                  setFamilyDraft((prev) => ({ ...prev, description: e.target.value }))
                }
                className={`${inputCls} min-h-[100px]`}
                style={fieldStyle()}
                placeholder="Optional motto, story, or short blurb for this fam."
              />
            </div>

            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              <div>
                <label className={labelCls} style={{ color: 'var(--color-text3)' }}>Cover Image URL</label>
                <input
                  type="url"
                  value={familyDraft.cover_image_url}
                  onChange={(e) => {
                    setFamilyDraft((prev) => ({ ...prev, cover_image_url: e.target.value }));
                    setCoverFile(null);
                    setCoverPreview('');
                  }}
                  className={inputCls}
                  style={fieldStyle()}
                  placeholder="https://..."
                />
              </div>
              <div>
                <label className={labelCls} style={{ color: 'var(--color-text3)' }}>Upload Cover Image</label>
                <div
                  {...getRootProps()}
                  className="mt-1 flex min-h-[88px] cursor-pointer flex-col items-center justify-center rounded border border-dashed p-3"
                  style={{
                    borderColor: isDragActive ? 'var(--color-text2)' : 'var(--color-border)',
                    background: isDragActive ? 'var(--color-surface2)' : 'transparent',
                  }}
                >
                  <input {...getInputProps()} />
                  {previewCover ? (
                    <img
                      src={previewCover}
                      alt="Family cover preview"
                      className="max-h-32 rounded object-cover"
                    />
                  ) : (
                    <span className="font-sans text-[11px]" style={{ color: 'var(--color-text3)' }}>
                      Drag & drop or click to upload
                    </span>
                  )}
                </div>
              </div>
            </div>

            <label className="flex items-center gap-2 font-sans text-sm" style={{ color: 'var(--color-text2)' }}>
              <input
                type="checkbox"
                checked={familyDraft.is_published}
                onChange={(e) =>
                  setFamilyDraft((prev) => ({ ...prev, is_published: e.target.checked }))
                }
              />
              Published (visible on public ACE page once it's redesigned)
            </label>

            <div className="flex flex-wrap gap-2 pt-1">
              <button
                type="submit"
                disabled={savingFamily}
                className="rounded px-5 py-2 font-sans text-sm font-medium transition-colors disabled:opacity-50"
                style={{ background: 'var(--color-text)', color: 'var(--color-bg)', border: 'none' }}
              >
                {savingFamily ? 'Saving...' : selectedFamily ? 'Save Changes' : 'Create Fam'}
              </button>
              {selectedFamily && (
                <button
                  type="button"
                  onClick={handleNewFamily}
                  className="rounded border px-5 py-2 font-sans text-sm transition-colors"
                  style={{ color: 'var(--color-text2)', borderColor: 'var(--color-border)', background: 'transparent' }}
                >
                  Cancel
                </button>
              )}
            </div>
          </form>

          {/* Members */}
          {selectedFamily ? (
            <div
              className="rounded-md border p-6"
              style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}
            >
              <div className="mb-4 flex items-start justify-between gap-4">
                <div>
                  <h2 className="font-sans text-base font-semibold" style={{ color: 'var(--color-text)' }}>
                    Members ({members.length})
                  </h2>
                  <p className="mt-1 font-sans text-xs" style={{ color: 'var(--color-text2)' }}>
                    Assign each member a parent (their Big). Members with no parent are roots.
                  </p>
                </div>
              </div>

              <div className="mb-4 flex flex-wrap items-center gap-2">
                <input
                  type="text"
                  value={newMemberName}
                  onChange={(e) => setNewMemberName(e.target.value)}
                  placeholder="New member name…"
                  className="rounded border px-3 py-2 font-sans text-sm"
                  style={fieldStyle()}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddMember();
                    }
                  }}
                />
                <button
                  type="button"
                  onClick={handleAddMember}
                  className="rounded border px-3 py-2 font-sans text-sm"
                  style={{ borderColor: 'var(--color-border)', color: 'var(--color-text2)', background: 'transparent' }}
                >
                  + Add Member
                </button>
              </div>

              {members.length === 0 ? (
                <p className="font-sans text-xs" style={{ color: 'var(--color-text3)' }}>
                  No members yet. Add a few above.
                </p>
              ) : (
                <div className="space-y-3">
                  {members.map((m) => (
                    <MemberRow
                      key={m.id}
                      member={m}
                      membersById={membersById}
                      parentOptions={members.filter((other) => other.id !== m.id)}
                      onSave={handleSaveMember}
                      onDelete={handleDeleteMember}
                      saving={savingMemberId === m.id}
                    />
                  ))}
                </div>
              )}

              <div
                className="mt-6 rounded border p-4"
                style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface2)' }}
              >
                <h3 className="font-sans text-sm font-semibold" style={{ color: 'var(--color-text)' }}>
                  Tree Preview
                </h3>
                <p className="mt-1 mb-3 font-sans text-xs" style={{ color: 'var(--color-text3)' }}>
                  Simple indented preview of the current Big/Little structure. Drafts shown grayed out.
                </p>
                <TreePreview members={members} />
              </div>
            </div>
          ) : (
            <p
              className="rounded-md border p-6 font-sans text-xs"
              style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text3)' }}
            >
              Save a fam first (or select one from the list) to manage members.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
