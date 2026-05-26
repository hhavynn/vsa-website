import { useState } from 'react';
import toast from 'react-hot-toast';
import { useAdminUVSASchools, useUpsertUVSASchool, useDeleteUVSASchool } from '../../hooks/useUVSASchools';
import { UVSASchool } from '../../types';
import { PageTitle } from '../../components/common/PageTitle';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { 
  FaPlus, 
  FaEdit, 
  FaTrash, 
  FaExternalLinkAlt, 
  FaSave, 
  FaTimes 
} from 'react-icons/fa';

// Icon components cast to any to avoid TS JSX errors
const PlusIcon = FaPlus as any;
const EditIcon = FaEdit as any;
const TrashIcon = FaTrash as any;
const ExternalLinkIcon = FaExternalLinkAlt as any;
const SaveIcon = FaSave as any;
const TimesIcon = FaTimes as any;

const EMPTY_SCHOOL: Partial<UVSASchool> = {
  school_name: '',
  short_name: '',
  slug: '',
  system_type: 'UC',
  city: '',
  vsa_name: '',
  linktree_url: '',
  instagram_url: '',
  description: '',
  is_active: true,
  sort_order: 0,
};

const inputCls = 'mt-1 block w-full rounded border px-3 py-2.5 text-[15px] sm:py-2 sm:text-sm focus:outline-none focus:border-[var(--brand)] focus:ring-1 focus:ring-[var(--brand)] bg-[var(--color-surface2)] border-[var(--color-border)] text-[var(--color-text)] placeholder-[var(--color-text3)]';
const labelCls = 'block text-[10px] font-bold uppercase tracking-[0.1em] text-[var(--color-text3)]';

export default function AdminUVSASchools() {
  const { schools, loading, refreshSchools } = useAdminUVSASchools();
  const upsertMutation = useUpsertUVSASchool();
  const deleteMutation = useDeleteUVSASchool();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<Partial<UVSASchool>>(EMPTY_SCHOOL);
  const [isAdding, setIsAdding] = useState(false);

  const handleEdit = (school: UVSASchool) => {
    setEditingId(school.id);
    setFormData(school);
    setIsAdding(false);
  };

  const handleAdd = () => {
    setEditingId(null);
    setFormData(EMPTY_SCHOOL);
    setIsAdding(true);
  };

  const handleCancel = () => {
    setEditingId(null);
    setFormData(EMPTY_SCHOOL);
    setIsAdding(false);
  };

  const handleSave = async () => {
    try {
      if (!formData.school_name || !formData.short_name || !formData.slug) {
        toast.error('School name, short name, and slug are required');
        return;
      }

      await upsertMutation.mutateAsync(formData);
      toast.success(editingId ? 'School updated' : 'School added');
      handleCancel();
      refreshSchools();
    } catch (err) {
      console.error(err);
      toast.error('Failed to save school');
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this school?')) return;
    try {
      await deleteMutation.mutateAsync(id);
      toast.success('School deleted');
      refreshSchools();
    } catch (err) {
      console.error(err);
      toast.error('Failed to delete school');
    }
  };

  if (loading && schools.length === 0) return <div className="p-8 text-center">Loading schools...</div>;

  return (
    <div className="vsa-container py-8 max-w-6xl">
      <div className="flex justify-between items-center mb-8">
        <div className="flex flex-col gap-1">
          <PageTitle title="Manage UVSA Schools" />
          <h1 className="font-serif text-3xl font-bold tracking-tight sm:text-4xl" style={{ color: 'var(--color-text)' }}>
            UVSA Schools
          </h1>
          <p className="font-sans text-sm text-[var(--color-text3)]">Directory of 13 UVSA schools</p>
        </div>
        <Button onClick={handleAdd} className="flex gap-2">
          <PlusIcon size={18} /> Add School
        </Button>
      </div>

      {(isAdding || editingId) && (
        <Card className="mb-12 p-6 scrapbook-paper">
          <h3 className="font-serif text-xl mb-6">
            {isAdding ? 'Add New School' : `Edit ${formData.short_name}`}
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <label className={labelCls}>School Name (Full)</label>
                <input
                  className={inputCls}
                  value={formData.school_name || ''}
                  onChange={e => setFormData({ ...formData, school_name: e.target.value })}
                  placeholder="e.g. University of Southern California"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Short Name</label>
                  <input
                    className={inputCls}
                    value={formData.short_name || ''}
                    onChange={e => setFormData({ ...formData, short_name: e.target.value })}
                    placeholder="e.g. USC"
                  />
                </div>
                <div>
                  <label className={labelCls}>Slug</label>
                  <input
                    className={inputCls}
                    value={formData.slug || ''}
                    onChange={e => setFormData({ ...formData, slug: e.target.value.toLowerCase().replace(/\s+/g, '-') })}
                    placeholder="e.g. usc"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>System Type</label>
                  <select
                    className={inputCls}
                    value={formData.system_type || 'UC'}
                    onChange={e => setFormData({ ...formData, system_type: e.target.value as any })}
                  >
                    <option value="UC">UC</option>
                    <option value="CSU">CSU</option>
                    <option value="Private">Private</option>
                  </select>
                </div>
                <div>
                  <label className={labelCls}>City</label>
                  <input
                    className={inputCls}
                    value={formData.city || ''}
                    onChange={e => setFormData({ ...formData, city: e.target.value })}
                    placeholder="e.g. Los Angeles"
                  />
                </div>
              </div>
              <div>
                <label className={labelCls}>VSA Name</label>
                <input
                  className={inputCls}
                  value={formData.vsa_name || ''}
                  onChange={e => setFormData({ ...formData, vsa_name: e.target.value })}
                  placeholder="e.g. USC VSA"
                />
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className={labelCls}>Linktree URL</label>
                <input
                  className={inputCls}
                  value={formData.linktree_url || ''}
                  onChange={e => setFormData({ ...formData, linktree_url: e.target.value })}
                />
              </div>
              <div>
                <label className={labelCls}>Instagram URL</label>
                <input
                  className={inputCls}
                  value={formData.instagram_url || ''}
                  onChange={e => setFormData({ ...formData, instagram_url: e.target.value })}
                />
              </div>
              <div>
                <label className={labelCls}>Description</label>
                <textarea
                  className={`${inputCls} h-24`}
                  value={formData.description || ''}
                  onChange={e => setFormData({ ...formData, description: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Sort Order</label>
                  <input
                    type="number"
                    className={inputCls}
                    value={formData.sort_order || 0}
                    onChange={e => setFormData({ ...formData, sort_order: parseInt(e.target.value) || 0 })}
                  />
                </div>
                <div className="flex items-center pt-6">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.is_active ?? true}
                      onChange={e => setFormData({ ...formData, is_active: e.target.checked })}
                      className="rounded border-gray-300 text-[var(--brand)] focus:ring-[var(--brand)]"
                    />
                    <span className="text-sm font-medium">Active</span>
                  </label>
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 mt-8 pt-6 border-t" style={{ borderColor: 'var(--border)' }}>
            <Button variant="outline" onClick={handleCancel} className="flex gap-2">
              <TimesIcon size={18} /> Cancel
            </Button>
            <Button onClick={handleSave} className="flex gap-2" loading={upsertMutation.isLoading}>
              <SaveIcon size={18} /> Save School
            </Button>
          </div>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-4">
        {schools.map(school => (
          <div key={school.id} className="scrapbook-paper p-4 flex items-center justify-between border" style={{ borderColor: 'var(--border)' }}>
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded bg-[var(--surface2)] flex items-center justify-center font-bold text-[var(--brand)]">
                {school.short_name[0]}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="font-bold">{school.school_name} ({school.short_name})</h4>
                  {!school.is_active && <span className="text-[10px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded font-bold uppercase">Inactive</span>}
                </div>
                <p className="text-xs text-[var(--text3)]">{school.city} • {school.system_type}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={() => window.open(school.linktree_url || '#', '_blank')} disabled={!school.linktree_url}>
                <ExternalLinkIcon size={16} />
              </Button>
              <Button variant="outline" size="sm" onClick={() => handleEdit(school)} className="flex gap-2">
                <EditIcon size={16} /> Edit
              </Button>
              <Button variant="outline" size="sm" onClick={() => handleDelete(school.id)} className="text-red-500 hover:text-red-600">
                <TrashIcon size={16} />
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
