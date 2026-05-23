import { FormEvent, useMemo, useState, type FC } from 'react';
import toast from 'react-hot-toast';
import {
  FaArchive,
  FaCheckCircle,
  FaCopy,
  FaEdit,
  FaExternalLinkAlt,
  FaPlus,
  FaTrash,
  FaUndo,
} from 'react-icons/fa';
import { useQueryClient } from 'react-query';
import { PageTitle } from '../../components/common/PageTitle';
import { PageLoader } from '../../components/common/PageLoader';
import { PageError } from '../../components/common/PageError';
import { RESOURCE_LINKS_QUERY_KEY, useResourceLinks } from '../../hooks/useResourceLinks';
import {
  RESOURCE_LINK_CATEGORIES,
  ResourceLinkFormData,
  resourceLinksRepository,
} from '../../data/repos/resourceLinks';
import { ResourceLink } from '../../types';

type AdminIconProps = {
  className?: string;
  'aria-hidden'?: boolean;
};

const ArchiveIcon = FaArchive as unknown as FC<AdminIconProps>;
const CheckCircleIcon = FaCheckCircle as unknown as FC<AdminIconProps>;
const CopyIcon = FaCopy as unknown as FC<AdminIconProps>;
const EditIcon = FaEdit as unknown as FC<AdminIconProps>;
const ExternalLinkIcon = FaExternalLinkAlt as unknown as FC<AdminIconProps>;
const PlusIcon = FaPlus as unknown as FC<AdminIconProps>;
const TrashIcon = FaTrash as unknown as FC<AdminIconProps>;
const UndoIcon = FaUndo as unknown as FC<AdminIconProps>;

type ResourceFormState = {
  title: string;
  description: string;
  url: string;
  category: string;
  role: string;
  program: string;
  workflow: string;
  academic_year_start: string;
  academic_year_end: string;
  is_current: boolean;
  is_archived: boolean;
  owner_role: string;
  last_verified_at: string;
};

type StatusFilter = 'current' | 'active' | 'archived' | 'all';

const EMPTY_FORM: ResourceFormState = {
  title: '',
  description: '',
  url: '',
  category: RESOURCE_LINK_CATEGORIES[0],
  role: '',
  program: '',
  workflow: '',
  academic_year_start: '',
  academic_year_end: '',
  is_current: true,
  is_archived: false,
  owner_role: '',
  last_verified_at: '',
};

const inputCls =
  'mt-1 block w-full rounded border px-3 py-2 text-sm font-sans focus:outline-none focus:border-[var(--brand)] focus:ring-1 focus:ring-[var(--brand)]/20';
const labelCls = 'block font-mono text-[10px] font-bold uppercase tracking-[0.1em]';

function fieldStyle() {
  return {
    borderColor: 'var(--color-border)',
    background: 'var(--color-surface)',
    color: 'var(--color-text)',
  } as const;
}

function nullable(value: string) {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function dateInputValue(value: string | null) {
  if (!value) return '';
  return value.slice(0, 10);
}

function verifiedLabel(value: string | null) {
  if (!value) return 'Not verified';
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(value));
}

function formFromResource(resource: ResourceLink): ResourceFormState {
  return {
    title: resource.title,
    description: resource.description ?? '',
    url: resource.url,
    category: resource.category,
    role: resource.role ?? '',
    program: resource.program ?? '',
    workflow: resource.workflow ?? '',
    academic_year_start: resource.academic_year_start ? String(resource.academic_year_start) : '',
    academic_year_end: resource.academic_year_end ? String(resource.academic_year_end) : '',
    is_current: resource.is_current,
    is_archived: resource.is_archived,
    owner_role: resource.owner_role ?? '',
    last_verified_at: dateInputValue(resource.last_verified_at),
  };
}

function payloadFromForm(form: ResourceFormState): ResourceLinkFormData {
  return {
    title: form.title,
    description: nullable(form.description),
    url: form.url,
    category: form.category,
    role: nullable(form.role),
    program: nullable(form.program),
    workflow: nullable(form.workflow),
    academic_year_start: form.academic_year_start ? Number(form.academic_year_start) : null,
    academic_year_end: form.academic_year_end ? Number(form.academic_year_end) : null,
    is_current: form.is_current,
    is_archived: form.is_archived,
    visibility: 'admin_only',
    owner_role: nullable(form.owner_role),
    last_verified_at: form.last_verified_at ? new Date(`${form.last_verified_at}T12:00:00.000Z`).toISOString() : null,
  };
}

function uniqueValues(resources: ResourceLink[], field: 'role' | 'program' | 'workflow') {
  return Array.from(new Set(resources.map((resource) => resource[field]).filter(Boolean) as string[])).sort();
}

export default function AdminResources() {
  const queryClient = useQueryClient();
  const { resources, loading, error, refetch } = useResourceLinks();
  const [selectedResource, setSelectedResource] = useState<ResourceLink | null>(null);
  const [form, setForm] = useState<ResourceFormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('current');
  const [roleFilter, setRoleFilter] = useState('all');
  const [programFilter, setProgramFilter] = useState('all');
  const [workflowFilter, setWorkflowFilter] = useState('all');

  const roleOptions = useMemo(() => uniqueValues(resources, 'role'), [resources]);
  const programOptions = useMemo(() => uniqueValues(resources, 'program'), [resources]);
  const workflowOptions = useMemo(() => uniqueValues(resources, 'workflow'), [resources]);

  const visibleResources = useMemo(() => {
    const query = search.trim().toLowerCase();

    return resources.filter((resource) => {
      const haystack = [
        resource.title,
        resource.description,
        resource.url,
        resource.category,
        resource.role,
        resource.program,
        resource.workflow,
        resource.owner_role,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      if (query && !haystack.includes(query)) return false;
      if (categoryFilter !== 'all' && resource.category !== categoryFilter) return false;
      if (roleFilter !== 'all' && resource.role !== roleFilter) return false;
      if (programFilter !== 'all' && resource.program !== programFilter) return false;
      if (workflowFilter !== 'all' && resource.workflow !== workflowFilter) return false;
      if (statusFilter === 'current') return resource.is_current && !resource.is_archived;
      if (statusFilter === 'active') return !resource.is_archived;
      if (statusFilter === 'archived') return resource.is_archived;
      return true;
    });
  }, [categoryFilter, programFilter, resources, roleFilter, search, statusFilter, workflowFilter]);

  const activeCount = useMemo(() => resources.filter((resource) => !resource.is_archived).length, [resources]);
  const archivedCount = useMemo(() => resources.filter((resource) => resource.is_archived).length, [resources]);

  const resetForm = () => {
    setSelectedResource(null);
    setForm(EMPTY_FORM);
  };

  const selectResource = (resource: ResourceLink) => {
    setSelectedResource(resource);
    setForm(formFromResource(resource));
  };

  const refreshResources = async () => {
    await queryClient.invalidateQueries(RESOURCE_LINKS_QUERY_KEY);
    await refetch();
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!form.title.trim()) {
      toast.error('Title is required');
      return;
    }
    if (!form.url.trim()) {
      toast.error('URL is required');
      return;
    }
    if (!form.category.trim()) {
      toast.error('Category is required');
      return;
    }
    if (
      form.academic_year_start &&
      form.academic_year_end &&
      Number(form.academic_year_end) < Number(form.academic_year_start)
    ) {
      toast.error('Academic year end must be after start');
      return;
    }

    try {
      setSaving(true);
      const payload = payloadFromForm(form);
      if (selectedResource) {
        await resourceLinksRepository.update(selectedResource.id, payload);
        toast.success('Resource updated');
      } else {
        await resourceLinksRepository.create(payload);
        toast.success('Resource created');
      }
      resetForm();
      await refreshResources();
    } catch (err) {
      console.error(err);
      toast.error('Failed to save resource');
    } finally {
      setSaving(false);
    }
  };

  const handleCopy = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      toast.success('Link copied');
    } catch {
      toast.error('Could not copy link');
    }
  };

  const handleArchive = async (resource: ResourceLink) => {
    try {
      await resourceLinksRepository.setArchived(resource.id, !resource.is_archived);
      toast.success(resource.is_archived ? 'Resource restored' : 'Resource archived');
      await refreshResources();
      if (selectedResource?.id === resource.id) resetForm();
    } catch (err) {
      console.error(err);
      toast.error('Failed to update archive status');
    }
  };

  const handleDelete = async (resource: ResourceLink) => {
    if (!window.confirm(`Delete "${resource.title}"? This removes the admin index row, not the Drive file.`)) return;
    try {
      await resourceLinksRepository.delete(resource.id);
      toast.success('Resource deleted');
      await refreshResources();
      if (selectedResource?.id === resource.id) resetForm();
    } catch (err) {
      console.error(err);
      toast.error('Failed to delete resource');
    }
  };

  const handleVerify = async (resource: ResourceLink) => {
    try {
      await resourceLinksRepository.markVerified(resource.id);
      toast.success('Resource marked verified');
      await refreshResources();
    } catch (err) {
      console.error(err);
      toast.error('Failed to verify resource');
    }
  };

  if (loading) {
    return (
      <div className="flex-1 overflow-y-auto">
        <PageTitle title="Admin Resources" />
        <PageLoader message="Loading resource links..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 overflow-y-auto">
        <PageTitle title="Admin Resources" />
        <PageError message="Failed to load resource links" />
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <PageTitle title="Admin Resources" />

      <div
        className="border-b px-5 py-5 sm:flex sm:items-center sm:justify-between sm:gap-4 sm:px-8 sm:py-7"
        style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}
      >
        <div>
          <h1 className="font-serif text-3xl font-bold tracking-tight sm:text-4xl" style={{ color: 'var(--color-text)' }}>
            Resources
          </h1>
          <p className="mt-1 font-sans text-xs" style={{ color: 'var(--color-text2)' }}>
            {activeCount} active, {archivedCount} archived. Admin-only Drive, form, and doc pointers for cabinet work.
          </p>
        </div>
        <button
          type="button"
          onClick={resetForm}
          className="mt-4 inline-flex items-center gap-2 rounded border px-3 py-2 font-sans text-xs font-medium transition-colors sm:mt-0"
          style={{ borderColor: 'var(--color-border)', color: 'var(--color-text2)', background: 'transparent' }}
        >
          <PlusIcon className="h-3 w-3" aria-hidden />
          New Resource
        </button>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(340px,420px)]" style={{ padding: '20px 28px' }}>
        <main className="min-w-0 space-y-4">
          <section
            className="rounded-md border p-4"
            style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}
          >
            <div className="grid gap-3 md:grid-cols-[minmax(220px,1.4fr)_repeat(2,minmax(150px,0.8fr))] xl:grid-cols-[minmax(220px,1.4fr)_repeat(3,minmax(140px,0.75fr))]">
              <div>
                <label className={labelCls} style={{ color: 'var(--color-text3)' }}>Search</label>
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  className={inputCls}
                  style={fieldStyle()}
                  placeholder="Title, URL, workflow, owner..."
                />
              </div>
              <div>
                <label className={labelCls} style={{ color: 'var(--color-text3)' }}>Category</label>
                <select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)} className={inputCls} style={fieldStyle()}>
                  <option value="all">All categories</option>
                  {RESOURCE_LINK_CATEGORIES.map((category) => (
                    <option key={category} value={category}>{category}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelCls} style={{ color: 'var(--color-text3)' }}>Status</label>
                <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as StatusFilter)} className={inputCls} style={fieldStyle()}>
                  <option value="current">Current</option>
                  <option value="active">Not archived</option>
                  <option value="archived">Archived</option>
                  <option value="all">All</option>
                </select>
              </div>
              <div>
                <label className={labelCls} style={{ color: 'var(--color-text3)' }}>Program</label>
                <select value={programFilter} onChange={(event) => setProgramFilter(event.target.value)} className={inputCls} style={fieldStyle()}>
                  <option value="all">All programs</option>
                  {programOptions.map((program) => (
                    <option key={program} value={program}>{program}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelCls} style={{ color: 'var(--color-text3)' }}>Role</label>
                <select value={roleFilter} onChange={(event) => setRoleFilter(event.target.value)} className={inputCls} style={fieldStyle()}>
                  <option value="all">All roles</option>
                  {roleOptions.map((role) => (
                    <option key={role} value={role}>{role}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelCls} style={{ color: 'var(--color-text3)' }}>Workflow</label>
                <select value={workflowFilter} onChange={(event) => setWorkflowFilter(event.target.value)} className={inputCls} style={fieldStyle()}>
                  <option value="all">All workflows</option>
                  {workflowOptions.map((workflow) => (
                    <option key={workflow} value={workflow}>{workflow}</option>
                  ))}
                </select>
              </div>
            </div>
          </section>

          <section
            className="rounded-md border"
            style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}
          >
            <div className="flex items-center justify-between gap-3 border-b px-4 py-3" style={{ borderColor: 'var(--color-border)' }}>
              <div>
                <h2 className="font-sans text-sm font-semibold" style={{ color: 'var(--color-text)' }}>
                  Resource Index
                </h2>
                <p className="font-sans text-[11px]" style={{ color: 'var(--color-text3)' }}>
                  {visibleResources.length} shown
                </p>
              </div>
              <span className="rounded border px-2 py-1 font-mono text-[10px] uppercase tracking-[0.1em]" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text3)' }}>
                Admin only
              </span>
            </div>

            {visibleResources.length === 0 ? (
              <div className="px-5 py-12 text-center">
                <p className="font-sans text-sm font-medium" style={{ color: 'var(--color-text)' }}>No matching resources</p>
                <p className="mt-1 font-sans text-xs" style={{ color: 'var(--color-text3)' }}>
                  Add the first canonical link or adjust the filters.
                </p>
              </div>
            ) : (
              <>
                <div className="divide-y lg:hidden" style={{ borderColor: 'var(--color-border)' }}>
                  {visibleResources.map((resource) => (
                    <ResourceCard
                      key={resource.id}
                      resource={resource}
                      selected={selectedResource?.id === resource.id}
                      onEdit={selectResource}
                      onCopy={handleCopy}
                      onArchive={handleArchive}
                      onDelete={handleDelete}
                      onVerify={handleVerify}
                    />
                  ))}
                </div>

                <div className="hidden overflow-x-auto lg:block">
                  <table className="min-w-full table-fixed border-collapse">
                    <thead>
                      <tr className="border-b text-left" style={{ borderColor: 'var(--color-border)' }}>
                        <th className="w-[30%] px-4 py-3 font-mono text-[10px] uppercase tracking-[0.1em]" style={{ color: 'var(--color-text3)' }}>Resource</th>
                        <th className="w-[16%] px-4 py-3 font-mono text-[10px] uppercase tracking-[0.1em]" style={{ color: 'var(--color-text3)' }}>Category</th>
                        <th className="w-[16%] px-4 py-3 font-mono text-[10px] uppercase tracking-[0.1em]" style={{ color: 'var(--color-text3)' }}>Scope</th>
                        <th className="w-[14%] px-4 py-3 font-mono text-[10px] uppercase tracking-[0.1em]" style={{ color: 'var(--color-text3)' }}>Verified</th>
                        <th className="w-[24%] px-4 py-3 font-mono text-[10px] uppercase tracking-[0.1em]" style={{ color: 'var(--color-text3)' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y" style={{ borderColor: 'var(--color-border)' }}>
                      {visibleResources.map((resource) => (
                        <ResourceTableRow
                          key={resource.id}
                          resource={resource}
                          selected={selectedResource?.id === resource.id}
                          onEdit={selectResource}
                          onCopy={handleCopy}
                          onArchive={handleArchive}
                          onDelete={handleDelete}
                          onVerify={handleVerify}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </section>
        </main>

        <aside
          className="h-fit rounded-md border p-5"
          style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}
        >
          <div className="mb-5 flex items-start justify-between gap-4">
            <div>
              <h2 className="font-sans text-base font-semibold" style={{ color: 'var(--color-text)' }}>
                {selectedResource ? 'Edit Resource' : 'Add Resource'}
              </h2>
              <p className="mt-1 font-sans text-xs" style={{ color: 'var(--color-text2)' }}>
                Store pointers only. Source files stay in Drive.
              </p>
            </div>
            {selectedResource && (
              <button type="button" onClick={resetForm} className="font-sans text-xs" style={{ color: 'var(--color-text3)' }}>
                Clear
              </button>
            )}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className={labelCls} style={{ color: 'var(--color-text3)' }}>Title *</label>
              <input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} className={inputCls} style={fieldStyle()} required />
            </div>
            <div>
              <label className={labelCls} style={{ color: 'var(--color-text3)' }}>URL *</label>
              <input type="url" value={form.url} onChange={(event) => setForm({ ...form, url: event.target.value })} className={inputCls} style={fieldStyle()} placeholder="https://drive.google.com/..." required />
            </div>
            <div>
              <label className={labelCls} style={{ color: 'var(--color-text3)' }}>Description</label>
              <textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} className={`${inputCls} min-h-[88px]`} style={fieldStyle()} />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
              <div>
                <label className={labelCls} style={{ color: 'var(--color-text3)' }}>Category *</label>
                <select value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })} className={inputCls} style={fieldStyle()} required>
                  {RESOURCE_LINK_CATEGORIES.map((category) => (
                    <option key={category} value={category}>{category}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelCls} style={{ color: 'var(--color-text3)' }}>Owner Role</label>
                <input value={form.owner_role} onChange={(event) => setForm({ ...form, owner_role: event.target.value })} className={inputCls} style={fieldStyle()} placeholder="Treasurer" />
              </div>
              <div>
                <label className={labelCls} style={{ color: 'var(--color-text3)' }}>Role</label>
                <input value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value })} className={inputCls} style={fieldStyle()} placeholder="Cabinet" />
              </div>
              <div>
                <label className={labelCls} style={{ color: 'var(--color-text3)' }}>Program</label>
                <input value={form.program} onChange={(event) => setForm({ ...form, program: event.target.value })} className={inputCls} style={fieldStyle()} placeholder="VCN" />
              </div>
              <div>
                <label className={labelCls} style={{ color: 'var(--color-text3)' }}>Workflow</label>
                <input value={form.workflow} onChange={(event) => setForm({ ...form, workflow: event.target.value })} className={inputCls} style={fieldStyle()} placeholder="Room request" />
              </div>
              <div>
                <label className={labelCls} style={{ color: 'var(--color-text3)' }}>Last Verified</label>
                <input type="date" value={form.last_verified_at} onChange={(event) => setForm({ ...form, last_verified_at: event.target.value })} className={inputCls} style={fieldStyle()} />
              </div>
              <div>
                <label className={labelCls} style={{ color: 'var(--color-text3)' }}>Year Start</label>
                <input type="number" value={form.academic_year_start} onChange={(event) => setForm({ ...form, academic_year_start: event.target.value })} className={inputCls} style={fieldStyle()} min="1900" max="2100" placeholder="2026" />
              </div>
              <div>
                <label className={labelCls} style={{ color: 'var(--color-text3)' }}>Year End</label>
                <input type="number" value={form.academic_year_end} onChange={(event) => setForm({ ...form, academic_year_end: event.target.value })} className={inputCls} style={fieldStyle()} min="1900" max="2100" placeholder="2027" />
              </div>
            </div>

            <div className="rounded border p-3" style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface2)' }}>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="flex items-center gap-2 font-sans text-sm" style={{ color: 'var(--color-text2)' }}>
                  <input type="checkbox" checked={form.is_current} onChange={(event) => setForm({ ...form, is_current: event.target.checked })} />
                  Current
                </label>
                <label className="flex items-center gap-2 font-sans text-sm" style={{ color: 'var(--color-text2)' }}>
                  <input type="checkbox" checked={form.is_archived} onChange={(event) => setForm({ ...form, is_archived: event.target.checked, is_current: event.target.checked ? false : form.is_current })} />
                  Archived
                </label>
              </div>
              <p className="mt-2 font-sans text-[11px]" style={{ color: 'var(--color-text3)' }}>
                Visibility is fixed to admin-only for this MVP.
              </p>
            </div>

            <div className="flex flex-wrap gap-2 pt-1">
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-2 rounded px-4 py-2 font-sans text-sm font-medium transition-colors disabled:opacity-50"
                style={{ background: 'var(--color-text)', color: 'var(--color-bg)', border: 'none' }}
              >
                {saving ? 'Saving...' : selectedResource ? 'Save Changes' : 'Create Resource'}
              </button>
              {selectedResource && (
                <button
                  type="button"
                  onClick={resetForm}
                  className="rounded border px-4 py-2 font-sans text-sm"
                  style={{ borderColor: 'var(--color-border)', color: 'var(--color-text2)', background: 'transparent' }}
                >
                  Cancel
                </button>
              )}
            </div>
          </form>
        </aside>
      </div>
    </div>
  );
}

function ResourceCard({
  resource,
  selected,
  onEdit,
  onCopy,
  onArchive,
  onDelete,
  onVerify,
}: {
  resource: ResourceLink;
  selected: boolean;
  onEdit: (resource: ResourceLink) => void;
  onCopy: (url: string) => void;
  onArchive: (resource: ResourceLink) => void;
  onDelete: (resource: ResourceLink) => void;
  onVerify: (resource: ResourceLink) => void;
}) {
  return (
    <article className="px-4 py-4" style={{ background: selected ? 'var(--color-surface2)' : 'transparent' }}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-sans text-sm font-semibold" style={{ color: 'var(--color-text)' }}>{resource.title}</h3>
          <p className="mt-1 break-words font-sans text-xs" style={{ color: 'var(--color-text3)' }}>{resource.url}</p>
        </div>
        <StatusPills resource={resource} />
      </div>
      {resource.description && (
        <p className="mt-3 font-sans text-sm leading-6" style={{ color: 'var(--color-text2)' }}>{resource.description}</p>
      )}
      <ResourceMeta resource={resource} />
      <ResourceActions resource={resource} onEdit={onEdit} onCopy={onCopy} onArchive={onArchive} onDelete={onDelete} onVerify={onVerify} />
    </article>
  );
}

function ResourceTableRow({
  resource,
  selected,
  onEdit,
  onCopy,
  onArchive,
  onDelete,
  onVerify,
}: {
  resource: ResourceLink;
  selected: boolean;
  onEdit: (resource: ResourceLink) => void;
  onCopy: (url: string) => void;
  onArchive: (resource: ResourceLink) => void;
  onDelete: (resource: ResourceLink) => void;
  onVerify: (resource: ResourceLink) => void;
}) {
  return (
    <tr style={{ background: selected ? 'var(--color-surface2)' : 'transparent' }}>
      <td className="px-4 py-4 align-top">
        <div className="font-sans text-sm font-semibold" style={{ color: 'var(--color-text)' }}>{resource.title}</div>
        <div className="mt-1 truncate font-sans text-xs" style={{ color: 'var(--color-text3)' }}>{resource.url}</div>
        {resource.description && <div className="mt-2 line-clamp-2 font-sans text-xs" style={{ color: 'var(--color-text2)' }}>{resource.description}</div>}
      </td>
      <td className="px-4 py-4 align-top">
        <span className="rounded border px-2 py-1 font-sans text-xs" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text2)' }}>
          {resource.category}
        </span>
      </td>
      <td className="px-4 py-4 align-top">
        <div className="space-y-1 font-sans text-xs" style={{ color: 'var(--color-text2)' }}>
          <div>{resource.program || 'No program'}</div>
          <div style={{ color: 'var(--color-text3)' }}>{resource.workflow || resource.role || 'No workflow'}</div>
        </div>
      </td>
      <td className="px-4 py-4 align-top">
        <span className="font-sans text-xs" style={{ color: resource.last_verified_at ? 'var(--color-text2)' : 'var(--color-text3)' }}>
          {verifiedLabel(resource.last_verified_at)}
        </span>
      </td>
      <td className="px-4 py-4 align-top">
        <ResourceActions resource={resource} onEdit={onEdit} onCopy={onCopy} onArchive={onArchive} onDelete={onDelete} onVerify={onVerify} compact />
      </td>
    </tr>
  );
}

function ResourceMeta({ resource }: { resource: ResourceLink }) {
  const yearRange =
    resource.academic_year_start && resource.academic_year_end
      ? `${resource.academic_year_start}-${resource.academic_year_end}`
      : null;

  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {[resource.category, resource.owner_role, resource.program, resource.workflow, resource.role, yearRange].filter(Boolean).map((item) => (
        <span
          key={item as string}
          className="rounded border px-2 py-1 font-sans text-[11px]"
          style={{ borderColor: 'var(--color-border)', color: 'var(--color-text2)' }}
        >
          {item}
        </span>
      ))}
      <span className="rounded border px-2 py-1 font-sans text-[11px]" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text3)' }}>
        Verified: {verifiedLabel(resource.last_verified_at)}
      </span>
    </div>
  );
}

function StatusPills({ resource }: { resource: ResourceLink }) {
  return (
    <div className="flex shrink-0 flex-col items-end gap-1">
      <span
        className="rounded border px-2 py-0.5 font-sans text-[10px]"
        style={{
          borderColor: 'var(--color-border)',
          color: resource.is_archived ? 'var(--color-text3)' : 'var(--color-text)',
        }}
      >
        {resource.is_archived ? 'Archived' : resource.is_current ? 'Current' : 'Reference'}
      </span>
    </div>
  );
}

function ResourceActions({
  resource,
  onEdit,
  onCopy,
  onArchive,
  onDelete,
  onVerify,
  compact = false,
}: {
  resource: ResourceLink;
  onEdit: (resource: ResourceLink) => void;
  onCopy: (url: string) => void;
  onArchive: (resource: ResourceLink) => void;
  onDelete: (resource: ResourceLink) => void;
  onVerify: (resource: ResourceLink) => void;
  compact?: boolean;
}) {
  const buttonClass = compact
    ? 'inline-flex h-8 w-8 items-center justify-center rounded border text-xs transition-colors'
    : 'inline-flex items-center gap-1.5 rounded border px-2.5 py-1.5 font-sans text-xs transition-colors';

  return (
    <div className={`mt-4 flex flex-wrap gap-2 ${compact ? 'mt-0' : ''}`}>
      <a
        href={resource.url}
        target="_blank"
        rel="noreferrer"
        className={buttonClass}
        style={{ borderColor: 'var(--color-border)', color: 'var(--color-text2)', background: 'transparent' }}
        title="Open link"
      >
        <ExternalLinkIcon className="h-3 w-3" aria-hidden />
        {!compact && <span>Open</span>}
      </a>
      <button type="button" onClick={() => onCopy(resource.url)} className={buttonClass} style={{ borderColor: 'var(--color-border)', color: 'var(--color-text2)', background: 'transparent' }} title="Copy link">
        <CopyIcon className="h-3 w-3" aria-hidden />
        {!compact && <span>Copy</span>}
      </button>
      <button type="button" onClick={() => onEdit(resource)} className={buttonClass} style={{ borderColor: 'var(--color-border)', color: 'var(--color-text2)', background: 'transparent' }} title="Edit resource">
        <EditIcon className="h-3 w-3" aria-hidden />
        {!compact && <span>Edit</span>}
      </button>
      <button type="button" onClick={() => onVerify(resource)} className={buttonClass} style={{ borderColor: 'var(--color-border)', color: 'var(--color-text2)', background: 'transparent' }} title="Mark verified">
        <CheckCircleIcon className="h-3 w-3" aria-hidden />
        {!compact && <span>Verified</span>}
      </button>
      <button type="button" onClick={() => onArchive(resource)} className={buttonClass} style={{ borderColor: 'var(--color-border)', color: 'var(--color-text2)', background: 'transparent' }} title={resource.is_archived ? 'Unarchive resource' : 'Archive resource'}>
        {resource.is_archived ? <UndoIcon className="h-3 w-3" aria-hidden /> : <ArchiveIcon className="h-3 w-3" aria-hidden />}
        {!compact && <span>{resource.is_archived ? 'Unarchive' : 'Archive'}</span>}
      </button>
      <button type="button" onClick={() => onDelete(resource)} className={buttonClass} style={{ borderColor: 'var(--color-border)', color: '#dc2626', background: 'transparent' }} title="Delete resource">
        <TrashIcon className="h-3 w-3" aria-hidden />
        {!compact && <span>Delete</span>}
      </button>
    </div>
  );
}
