import React, { useState } from 'react';
import toast from 'react-hot-toast';
import { useCabinetRoles, useUpdateCabinetRole, useCreateCabinetRole, useDeleteCabinetRole } from '../../../hooks/useCabinetRoles';
import { CabinetRoleDescription } from '../../../data/repos/cabinetRolesRepository';
import { generateSlug } from '../../../utils/generateSlug';

const BOARD_GROUPS = [
  'Executive Board',
  'Programming & Member Experience',
  'Culture & External',
  'Media & Storytelling',
  'Finance & Operations'
];

const inputCls = 'mt-1 block w-full rounded border px-3 py-2.5 text-[15px] sm:py-2 sm:text-sm focus:outline-none focus:border-[var(--brand)] focus:ring-1 focus:ring-[var(--brand)] bg-[var(--color-surface2)] border-[var(--color-border)] text-[var(--color-text)] placeholder-[var(--color-text3)] transition';
const labelCls = 'block font-mono text-[10px] font-bold uppercase tracking-[0.1em] text-[var(--color-text3)]';

export function AdminCabinetRoleDescriptions() {
  const { data: roles = [], isLoading } = useCabinetRoles();
  const updateRole = useUpdateCabinetRole();
  const createRole = useCreateCabinetRole();
  const deleteRole = useDeleteCabinetRole();

  const [selectedRole, setSelectedRole] = useState<CabinetRoleDescription | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [formData, setFormData] = useState<Partial<CabinetRoleDescription>>({});

  const [responsibilitiesText, setResponsibilitiesText] = useState('');
  const [worksWithText, setWorksWithText] = useState('');
  const [bestFitForText, setBestFitForText] = useState('');
  const [aliasesText, setAliasesText] = useState('');

  const handleEdit = (role: CabinetRoleDescription) => {
    setSelectedRole(role);
    setIsCreating(false);
    setFormData(role);
    setResponsibilitiesText((role.responsibilities || []).join('\n'));
    setWorksWithText((role.works_with || []).join(', '));
    setBestFitForText((role.best_fit_for || []).join('\n'));
    setAliasesText((role.aliases || []).join(', '));
  };

  const handleCreate = () => {
    setSelectedRole(null);
    setIsCreating(true);
    setFormData({
      board_group: BOARD_GROUPS[0],
      display_order: roles.length * 10
    });
    setResponsibilitiesText('');
    setWorksWithText('');
    setBestFitForText('');
    setAliasesText('');
  };

  const handleCancel = () => {
    setSelectedRole(null);
    setIsCreating(false);
    setFormData({});
    setAliasesText('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.role_name || !formData.board_group || !formData.short_description) {
      toast.error('Role name, board group, and short description are required.');
      return;
    }

    const updates = {
      role_name: formData.role_name,
      board_group: formData.board_group,
      short_description: formData.short_description,
      display_order: formData.display_order ?? 0,
      responsibilities: responsibilitiesText.split('\n').map(s => s.trim()).filter(Boolean),
      works_with: worksWithText.split(',').map(s => s.trim()).filter(Boolean),
      best_fit_for: bestFitForText.split('\n').map(s => s.trim()).filter(Boolean),
      aliases: aliasesText.split(',').map(s => s.trim()).filter(Boolean),
    };

    try {
      if (isCreating) {
        await createRole.mutateAsync({
          role_slug: generateSlug(formData.role_name),
          ...updates
        });
        toast.success('Role created successfully');
      } else if (selectedRole) {
        await updateRole.mutateAsync({
          roleSlug: selectedRole.role_slug,
          updates
        });
        toast.success('Role updated successfully');
      }
      handleCancel();
    } catch (err) {
      toast.error('An error occurred while saving the role description');
    }
  };

  const handleDelete = async () => {
    if (!selectedRole || !window.confirm(`Are you sure you want to delete ${selectedRole.role_name}?`)) return;
    try {
      await deleteRole.mutateAsync(selectedRole.role_slug);
      toast.success('Role deleted successfully');
      handleCancel();
    } catch (err) {
      toast.error('Failed to delete role');
    }
  };

  if (isLoading) {
    return <div className="p-8 text-center text-[var(--color-text3)]">Loading role descriptions...</div>;
  }

  if (isCreating || selectedRole) {
    return (
      <div className="p-6 sm:p-8 scrapbook-paper" style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}>
        <h2 className="mb-6 font-serif text-xl font-bold" style={{ color: 'var(--color-text)' }}>
          {isCreating ? 'Create Role Description' : `Edit ${selectedRole?.role_name}`}
        </h2>
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:gap-6">
            <div>
              <label className={labelCls}>Role Name *</label>
              <input type="text" value={formData.role_name || ''} onChange={e => setFormData({ ...formData, role_name: e.target.value })} className={inputCls} required />
            </div>
            <div>
              <label className={labelCls}>Board Group *</label>
              <select value={formData.board_group || ''} onChange={e => setFormData({ ...formData, board_group: e.target.value })} className={inputCls} required>
                {BOARD_GROUPS.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Display Order</label>
              <input type="number" value={formData.display_order ?? 0} onChange={e => setFormData({ ...formData, display_order: parseInt(e.target.value, 10) || 0 })} className={inputCls} />
            </div>
          </div>

          <div>
            <label className={labelCls}>Short Description *</label>
            <textarea value={formData.short_description || ''} onChange={e => setFormData({ ...formData, short_description: e.target.value })} className={inputCls} rows={2} required />
          </div>

          <div>
            <label className={labelCls}>Responsibilities (one per line)</label>
            <textarea value={responsibilitiesText} onChange={e => setResponsibilitiesText(e.target.value)} className={inputCls} rows={4} placeholder="Plan and execute weekly meetings..." />
          </div>

          <div>
            <label className={labelCls}>Works Closely With (comma separated)</label>
            <input type="text" value={worksWithText} onChange={e => setWorksWithText(e.target.value)} className={inputCls} placeholder="President, Intercollegiate Council" />
          </div>

          <div>
            <label className={labelCls}>Title Aliases (comma separated)</label>
            <input type="text" value={aliasesText} onChange={e => setAliasesText(e.target.value)} className={inputCls} placeholder="Co-Events Chair, Anh Chi Em Chair, ICC" />
            <p className="mt-1 font-sans text-[11px]" style={{ color: 'var(--color-text3)' }}>
              Alternate member titles that should open this role (Co-… variants, acronyms, or combined titles). Matching ignores case, punctuation, and a leading “Co-”.
            </p>
          </div>

          <div>
            <label className={labelCls}>Great Fit If... (one per line)</label>
            <textarea value={bestFitForText} onChange={e => setBestFitForText(e.target.value)} className={inputCls} rows={4} placeholder="You are highly organized..." />
          </div>

          <div className="flex flex-col gap-3 pt-4 sm:flex-row sm:justify-between">
            <div className="flex gap-3">
              <button type="submit" disabled={updateRole.isLoading || createRole.isLoading} className="vsa-btn-primary sm:px-8 disabled:opacity-50">
                {isCreating ? 'Create Role' : 'Save Changes'}
              </button>
              <button type="button" onClick={handleCancel} className="rounded border bg-transparent px-6 py-2.5 text-sm font-semibold transition-colors hover:bg-[var(--color-surface2)]" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text2)' }}>
                Cancel
              </button>
            </div>
            {!isCreating && (
              <button type="button" onClick={handleDelete} className="rounded border border-red-900/30 px-6 py-2.5 text-sm font-semibold text-red-600 transition-colors hover:bg-red-600 hover:text-white" disabled={deleteRole.isLoading}>
                Delete
              </button>
            )}
          </div>
        </form>
      </div>
    );
  }

  return (
    <div className="scrapbook-paper" style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}>
      <div className="border-b px-6 py-5 flex items-center justify-between" style={{ borderColor: 'var(--color-border)' }}>
        <div>
          <h2 className="font-serif text-xl font-bold" style={{ color: 'var(--color-text)' }}>Role Descriptions</h2>
          <p className="mt-1 font-sans text-xs" style={{ color: 'var(--color-text2)' }}>Manage the public descriptions for cabinet positions.</p>
        </div>
        <button onClick={handleCreate} className="vsa-btn-primary py-2 text-xs">
          Add Role Description
        </button>
      </div>

      {roles.length === 0 ? (
        <div className="p-8 text-center text-sm" style={{ color: 'var(--color-text3)' }}>
          No role descriptions found.
        </div>
      ) : (
        <div className="divide-y" style={{ borderColor: 'var(--color-border)' }}>
          {roles.sort((a, b) => (a.display_order ?? 99) - (b.display_order ?? 99)).map(role => (
            <div key={role.role_slug} className="flex items-center justify-between p-6 hover:bg-[var(--color-surface2)] transition-colors">
              <div>
                <h3 className="font-serif text-lg font-bold" style={{ color: 'var(--color-text)' }}>{role.role_name}</h3>
                <p className="font-mono text-[10px] uppercase tracking-widest text-brand-600 dark:text-brand-400 mt-1">{role.board_group}</p>
                <p className="font-sans text-sm mt-2 max-w-3xl line-clamp-2" style={{ color: 'var(--color-text2)' }}>{role.short_description}</p>
              </div>
              <button onClick={() => handleEdit(role)} className="ml-4 shrink-0 rounded border bg-[var(--color-surface)] px-4 py-2 text-xs font-semibold transition-colors hover:bg-[var(--color-surface2)]" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text2)' }}>
                Edit
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
