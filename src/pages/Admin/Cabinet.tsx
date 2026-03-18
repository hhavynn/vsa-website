import { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import { supabase } from '../../lib/supabase';
import { useDropzone } from 'react-dropzone';
import { PageTitle } from '../../components/common/PageTitle';

interface CabinetMember {
  id: string;
  name: string;
  role: string;
  category: string;
  display_order: number;
  image_url: string | null;
  year: string | null;
  college: string | null;
  major: string | null;
  minor: string | null;
  pronouns: string | null;
  favorite_snack: string | null;
  fun_fact: string | null;
}

const CATEGORIES = ['Executive Board', 'General Board', 'Interns'];
const EMPTY_MEMBER: Partial<CabinetMember> = {
  name: '',
  role: '',
  category: 'General Board',
  display_order: 0,
  image_url: '',
  year: '',
  college: '',
  major: '',
  minor: '',
  pronouns: '',
  favorite_snack: '',
  fun_fact: '',
};

const MIGRATION_DATA = [
  // Executive Board
  { name: 'Gracie Nguyen', role: 'Co-President', category: 'Executive Board', image: 'gracie_nguyen.png', year: 'Third Year', college: 'Marshall College', major: 'General Biology' },
  { name: 'Phuong Le', role: 'Co-President', category: 'Executive Board', image: 'phuong_le.png', year: 'Third Year', college: 'Muir College', major: 'Political Science - International Relations' },
  { name: 'Stephanie Nguyen', role: 'Co-Intercollegiate Council', category: 'Executive Board', year: 'Second Year Transfer', college: 'ERC College', major: 'Applied Math' },
  { name: 'Kirsten Ngo', role: 'Co-Intercollegiate Council', category: 'Executive Board', image: 'kirsten_ngo.png', year: 'Third Year', college: 'Revelle College', major: 'Human Biology' },
  { name: 'Mindy Tran', role: 'Internal Vice President', category: 'Executive Board', image: 'mindy_tran.png', year: 'Third Year', college: 'Muir College', major: 'General Biology' },
  { name: 'Martin Dang', role: 'Secretary', category: 'Executive Board', image: 'martin_dang.png', year: 'Third Year', college: 'Revelle College', major: 'Math-CS' },
  { name: 'Brandon Thach', role: 'Treasurer', category: 'Executive Board', image: 'brandon_thach.png', year: 'Second Year', college: 'Seventh College', major: 'Business Economics' },

  // General Board
  { name: 'Asia Martin', role: 'Co-Media Director', category: 'General Board', year: 'Second Year Transfer', college: 'Sixth College', major: 'Human Biology' },
  { name: 'Anne Fa', role: 'Co-Media Director', category: 'General Board', year: 'Second Year', college: 'Seventh College', major: 'Business Economics' },
  { name: 'Amy Nguyen', role: 'Co-Events Chair', category: 'General Board', image: 'amy_nguyen.png', year: 'Second Year', college: 'Marshall College', major: 'Human Development' },
  { name: 'Havyn Nguyen', role: 'Co-Events Chair', category: 'General Board', image: 'havyn_nguyen.png', year: 'Third Year', college: 'Sixth College', major: 'Math-CS' },
  { name: 'Jonas Truong', role: 'VCN Director & Executive Producer', category: 'General Board', image: 'jonas_truong.png', year: 'Second Year', college: 'Seventh College', major: 'Political Science - Public Law' },
  { name: 'Robert Le', role: 'VCN Director & Executive Producer', category: 'General Board', image: 'robert_le.png', year: 'Third Year', college: 'Seventh College', major: 'Structural Engineering' },
  { name: 'April Pham', role: 'Anh Chi Em Chair', category: 'General Board', image: 'april_pham.png', year: 'Third Year', college: 'Eighth College', major: 'Molecular & Cell Biology' },
  { name: 'Kayla Truong', role: 'Fundraising Chair', category: 'General Board', year: 'Second Year', college: 'Muir College', major: 'Cognitive Science' },
  { name: 'Ingyin Moh', role: 'Community Relations Chair', category: 'General Board', image: 'ingyin_moh.png', year: 'Third Year', college: 'Muir College', major: 'Public Health' },
  { name: 'Abby Le', role: 'Culture & Philanthropy Chair', category: 'General Board', image: 'abby_le.png', year: 'Second Year', college: 'Seventh College', major: 'Business Economics' },
  { name: 'Andy Tran', role: 'Co-Historian', category: 'General Board', image: 'andy_tran.png', year: 'Second Year', college: 'Seventh College', major: 'Human Biology' },
  { name: 'Faith Nguyen', role: 'Co-Historian', category: 'General Board', year: 'Second Year', college: 'Seventh College', major: 'Business Psychology' },

  // Interns
  { name: 'Sofia Nguyen', role: 'Intern', category: 'Interns', image: 'https://drive.google.com/uc?id=1MsoSQYzw0AVTn_U2nZ_7HvSiiPnfUNyd', year: '2nd Year', college: 'Marshall College', major: 'Business Economics', funFact: 'i can do a cartwheel' },
  { name: 'Darlene Le', role: 'Intern', category: 'Interns', image: 'https://drive.google.com/uc?id=1mkNDkpliEzsAc5Ct3ObywW5xR7Ggsj30', year: '1st Year', college: 'Eighth College', major: 'Cognitive Science', funFact: 'i won a giveaway to get coldplay floor seats :33' },
  { name: 'Hanni Lam', role: 'Intern', category: 'Interns', image: 'https://drive.google.com/uc?id=1nraJhLxquS0sQawYUXhV96qu0w8DXfaX', year: '2nd Year', college: 'Muir College', major: 'Public Health with Concentration in Medicine Sciences', funFact: 'I went to an Art High School, like Victorious' },
  { name: 'Allyson Hong', role: 'Intern', category: 'Interns', image: 'https://drive.google.com/uc?id=14P1xdlZqq_dEj99opLaYllxdb8CwbN2Q', year: '1st Year', college: 'Eighth College', major: 'Human Biology', funFact: 'I can do the worm' },
  { name: 'Matthew Cao', role: 'Intern', category: 'Interns', image: 'https://drive.google.com/uc?id=1gCTg3o6nH11zUwAJpxApvmb2G2bEKLp_', year: '1st Year', college: 'ERC', major: 'Human Biology', funFact: 'I have a fear of spiders' },
  { name: 'Tristan Vu', role: 'Intern', category: 'Interns', image: 'https://drive.google.com/uc?id=1f9b4y5oVUglrGyXk2-pbxNfO95xYy4vW', year: '1st Year Transfer', college: 'Warren College', major: 'Bioengineering: Biotechnology', funFact: 'I love McChickens' },
  { name: 'Teresa Pham', role: 'Intern', category: 'Interns', image: 'https://drive.google.com/uc?id=1ylqc3ijfu_AttzSk3ee0OxWN8TztC8S8', year: '1st Year Transfer', college: 'Marshall College', major: 'General Biology', funFact: 'I used to live in Florida' },
  { name: 'Hailie Cheng', role: 'Intern', category: 'Interns', image: 'https://drive.google.com/uc?id=1trhJaQx_NUHJLdDUAop4KmgCO8vvWyI6', year: '2nd Year', college: 'Seventh College', major: 'Public Health with Concentration in Medicine Sciences', funFact: 'Met Daniela from KATSEYE at a VSA event last month' },
];

const inputCls = 'mt-1 block w-full rounded border border-zinc-700 bg-zinc-900 text-zinc-100 px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 placeholder:text-zinc-600';
const labelCls = 'block text-xs font-medium text-zinc-400 uppercase tracking-label';

export default function AdminCabinet() {
  const [members, setMembers] = useState<CabinetMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'create' | 'manage'>('manage');

  const [selectedMember, setSelectedMember] = useState<CabinetMember | null>(null);
  const [newMember, setNewMember] = useState<Partial<CabinetMember>>(EMPTY_MEMBER);

  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  const [editImageFile, setEditImageFile] = useState<File | null>(null);
  const [editImagePreview, setEditImagePreview] = useState<string | null>(null);

  const [uploading, setUploading] = useState(false);
  const [memberToDelete, setMemberToDelete] = useState<CabinetMember | null>(null);

  const fetchMembers = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('cabinet_members')
        .select('*')
        .order('display_order', { ascending: true })
        .order('created_at', { ascending: false });

      if (error) throw error;
      setMembers(data as CabinetMember[]);
    } catch (err) {
      console.error('Error fetching members:', err);
      toast.error('Failed to load cabinet members');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMembers();
  }, []);

  const handleBulkMigrate = async () => {
    try {
      setUploading(true);
      toast.loading('Migrating members...', { id: 'migrate' });
      for (let i = 0; i < MIGRATION_DATA.length; i++) {
        const mem = MIGRATION_DATA[i];
        await supabase.from('cabinet_members').insert([{
          name: mem.name,
          role: mem.role,
          category: mem.category,
          display_order: i,
          image_url: mem.image || null,
          year: mem.year || null,
          college: mem.college || null,
          major: mem.major || null,
          fun_fact: mem.funFact || null,
        }]);
      }
      toast.success('Migration complete!', { id: 'migrate' });
      fetchMembers();
    } catch (err) {
      console.error('Migration failed:', err);
      toast.error('Migration failed', { id: 'migrate' });
    } finally {
      setUploading(false);
    }
  };

  // Dropzone for CREATE
  const onDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;
    setImageFile(file);
    const reader = new FileReader();
    reader.onload = () => setImagePreview(reader.result as string);
    reader.readAsDataURL(file);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': ['.png', '.jpg', '.jpeg', '.webp'] },
    maxFiles: 1,
  });

  // Dropzone for EDIT
  const onEditDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;
    setEditImageFile(file);
    const reader = new FileReader();
    reader.onload = () => setEditImagePreview(reader.result as string);
    reader.readAsDataURL(file);
  }, []);

  const { getRootProps: getEditRootProps, getInputProps: getEditInputProps, isDragActive: isEditDragActive } = useDropzone({
    onDrop: onEditDrop,
    accept: { 'image/*': ['.png', '.jpg', '.jpeg', '.webp'] },
    maxFiles: 1,
  });

  const uploadImage = async (file: File): Promise<string> => {
    const fileExt = file.name.split('.').pop();
    const fileName = `${crypto.randomUUID()}.${fileExt}`;
    const { error } = await supabase.storage.from('cabinet_images').upload(fileName, file);
    if (error) throw error;
    const { data } = supabase.storage.from('cabinet_images').getPublicUrl(fileName);
    return data.publicUrl;
  };

  const handleCreateMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMember.name || !newMember.role || !newMember.category) {
      toast.error('Name, role, and category are required');
      return;
    }

    try {
      setUploading(true);
      const imageUrl = imageFile ? await uploadImage(imageFile) : null;

      const { error } = await supabase.from('cabinet_members').insert([{
        ...newMember,
        image_url: imageUrl,
      }]);

      if (error) throw error;

      toast.success('Member added');
      setNewMember(EMPTY_MEMBER);
      setImageFile(null);
      setImagePreview(null);
      fetchMembers();
      setActiveTab('manage');
    } catch (err) {
      console.error('Error adding member:', err);
      toast.error('Failed to add member');
    } finally {
      setUploading(false);
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMember) return;

    try {
      setUploading(true);
      let imageUrl = selectedMember.image_url;
      if (editImageFile) {
        imageUrl = await uploadImage(editImageFile);
      }

      const { error } = await supabase.from('cabinet_members').update({
        name: selectedMember.name,
        role: selectedMember.role,
        category: selectedMember.category,
        display_order: selectedMember.display_order,
        year: selectedMember.year,
        college: selectedMember.college,
        major: selectedMember.major,
        minor: selectedMember.minor,
        pronouns: selectedMember.pronouns,
        favorite_snack: selectedMember.favorite_snack,
        fun_fact: selectedMember.fun_fact,
        image_url: imageUrl,
      }).eq('id', selectedMember.id);

      if (error) throw error;

      toast.success('Member updated');
      setEditImageFile(null);
      setEditImagePreview(null);
      setSelectedMember(null);
      fetchMembers();
    } catch (err) {
      console.error('Error updating member:', err);
      toast.error('Failed to update member');
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!memberToDelete) return;
    try {
      const { error } = await supabase.from('cabinet_members').delete().eq('id', memberToDelete.id);
      if (error) throw error;
      toast.success(`${memberToDelete.name} removed`);
      fetchMembers();
    } catch (err) {
      console.error('Error deleting member:', err);
      toast.error('Failed to delete member');
    } finally {
      setMemberToDelete(null);
    }
  };

  const moveMember = async (member: CabinetMember, direction: 'up' | 'down') => {
    const categoryMembers = members.filter(m => m.category === member.category);
    const currentIndex = categoryMembers.findIndex(m => m.id === member.id);

    if (direction === 'up' && currentIndex > 0) {
      const prevMember = categoryMembers[currentIndex - 1];
      await supabase.from('cabinet_members').update({ display_order: prevMember.display_order }).eq('id', member.id);
      await supabase.from('cabinet_members').update({ display_order: member.display_order }).eq('id', prevMember.id);
      fetchMembers();
    } else if (direction === 'down' && currentIndex < categoryMembers.length - 1) {
      const nextMember = categoryMembers[currentIndex + 1];
      await supabase.from('cabinet_members').update({ display_order: nextMember.display_order }).eq('id', member.id);
      await supabase.from('cabinet_members').update({ display_order: member.display_order }).eq('id', nextMember.id);
      fetchMembers();
    }
  };

  return (
    <div className="py-6">
      <PageTitle title="Cabinet Management" />

      {/* Page header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50 tracking-tight">Cabinet Directory</h1>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 mb-6">
        {(['manage', 'create'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded text-sm font-medium transition-colors duration-150 ${
              activeTab === tab
                ? 'bg-zinc-800 text-zinc-50 dark:bg-zinc-700'
                : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800'
            }`}
          >
            {tab === 'manage' ? 'Manage Directory' : 'Add Member'}
          </button>
        ))}
      </div>

      <div className="border border-zinc-200 dark:border-[#27272a] bg-white dark:bg-[#18181b] rounded-md p-6 min-h-[500px]">
        {activeTab === 'create' ? (
          <div>
            <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50 mb-5">Add Cabinet Member</h2>
            <form onSubmit={handleCreateMember} className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div><label className={labelCls}>Name *</label><input type="text" value={newMember.name} onChange={e => setNewMember({...newMember, name: e.target.value})} className={inputCls} required /></div>
                <div><label className={labelCls}>Role / Title *</label><input type="text" value={newMember.role} onChange={e => setNewMember({...newMember, role: e.target.value})} className={inputCls} required /></div>
                <div>
                  <label className={labelCls}>Category *</label>
                  <select value={newMember.category} onChange={e => setNewMember({...newMember, category: e.target.value})} className={inputCls} required>
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div><label className={labelCls}>Sort Order</label><input type="number" value={newMember.display_order} onChange={e => setNewMember({...newMember, display_order: Number(e.target.value)})} className={inputCls} /></div>
                <div><label className={labelCls}>College</label><input type="text" value={newMember.college || ''} onChange={e => setNewMember({...newMember, college: e.target.value})} className={inputCls} /></div>
                <div><label className={labelCls}>Year</label><input type="text" value={newMember.year || ''} onChange={e => setNewMember({...newMember, year: e.target.value})} className={inputCls} /></div>
                <div><label className={labelCls}>Major</label><input type="text" value={newMember.major || ''} onChange={e => setNewMember({...newMember, major: e.target.value})} className={inputCls} /></div>
                <div><label className={labelCls}>Minor</label><input type="text" value={newMember.minor || ''} onChange={e => setNewMember({...newMember, minor: e.target.value})} className={inputCls} /></div>
                <div><label className={labelCls}>Pronouns</label><input type="text" value={newMember.pronouns || ''} onChange={e => setNewMember({...newMember, pronouns: e.target.value})} className={inputCls} /></div>
                <div><label className={labelCls}>Favorite Snack</label><input type="text" value={newMember.favorite_snack || ''} onChange={e => setNewMember({...newMember, favorite_snack: e.target.value})} className={inputCls} /></div>
              </div>
              <div>
                <label className={labelCls}>Fun Fact</label>
                <textarea value={newMember.fun_fact || ''} onChange={e => setNewMember({...newMember, fun_fact: e.target.value})} className={inputCls} rows={2} />
              </div>
              <div>
                <label className={labelCls}>Profile Photo</label>
                <div {...getRootProps()} className={`mt-1 flex flex-col items-center justify-center border border-dashed rounded p-6 cursor-pointer transition-colors ${isDragActive ? 'border-zinc-400 bg-zinc-800/30' : 'border-zinc-700 bg-zinc-900/30'}`}>
                  <input {...getInputProps()} />
                  {imagePreview ? (
                    <img src={imagePreview} alt="Preview" className="w-20 h-20 rounded-full object-cover" />
                  ) : (
                    <p className="text-zinc-500 text-xs">Drag and drop or click to upload</p>
                  )}
                </div>
              </div>
              <button type="submit" disabled={uploading} className="w-full bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-100 font-medium py-2.5 rounded text-sm transition-colors disabled:opacity-50">
                {uploading ? 'Adding...' : 'Add Member'}
              </button>
            </form>
          </div>
        ) : (
          <div>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">Directory</h2>
              {members.length === 0 && !loading && (
                <button
                  onClick={handleBulkMigrate}
                  disabled={uploading}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium rounded transition-colors disabled:opacity-50"
                >
                  {uploading ? 'Migrating...' : 'Run Initial Data Migration'}
                </button>
              )}
            </div>
            {loading ? (
              <p className="text-zinc-500 text-sm">Loading...</p>
            ) : CATEGORIES.map(category => {
              const categoryMembers = members.filter(m => m.category === category);
              if (categoryMembers.length === 0) return null;

              return (
                <div key={category} className="mb-8">
                  <div className="flex items-center gap-3 border-b border-zinc-200 dark:border-zinc-800 pb-2 mb-3">
                    <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-label">{category}</h3>
                    <span className="text-xs text-zinc-600">{categoryMembers.length}</span>
                  </div>
                  <div className="space-y-2">
                    {categoryMembers.map((m, idx) => (
                      <div key={m.id} className="flex items-center justify-between p-3 border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 rounded">
                        <div className="flex items-center gap-3">
                          <div className="flex flex-col gap-0.5 items-center px-1">
                            <button onClick={() => moveMember(m, 'up')} disabled={idx === 0} className="text-zinc-500 hover:text-zinc-200 disabled:opacity-20 text-xs leading-none">▲</button>
                            <span className="text-[10px] text-zinc-600 tabular-nums">{m.display_order}</span>
                            <button onClick={() => moveMember(m, 'down')} disabled={idx === categoryMembers.length - 1} className="text-zinc-500 hover:text-zinc-200 disabled:opacity-20 text-xs leading-none">▼</button>
                          </div>
                          {m.image_url ? (
                            <img src={m.image_url} alt={m.name} className="w-10 h-10 rounded-full object-cover border border-zinc-200 dark:border-zinc-700" />
                          ) : (
                            <div className="w-10 h-10 rounded-full bg-zinc-200 dark:bg-zinc-700 flex items-center justify-center text-zinc-500 text-xs border border-zinc-300 dark:border-zinc-600">
                              {m.name.charAt(0)}
                            </div>
                          )}
                          <div>
                            <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50 leading-tight">{m.name}</p>
                            <p className="text-xs text-zinc-500">{m.role}</p>
                          </div>
                        </div>
                        <div className="flex gap-1.5">
                          <button onClick={() => setSelectedMember(m)} className="px-3 py-1.5 border border-zinc-200 dark:border-zinc-700 hover:border-zinc-400 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 text-xs rounded transition-colors">Edit</button>
                          <button onClick={() => setMemberToDelete(m)} className="px-3 py-1.5 border border-red-900/30 text-red-500 hover:bg-red-600 hover:text-white text-xs rounded transition-colors">Remove</button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Edit Modal */}
      {selectedMember && (
        <div className="fixed inset-0 bg-black/70 flex items-start justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-zinc-900 rounded-md max-w-2xl w-full my-8 border border-zinc-800">
            <div className="p-5 border-b border-zinc-800 flex justify-between items-center">
              <h2 className="text-base font-semibold text-zinc-50">Edit {selectedMember.name}</h2>
              <button onClick={() => setSelectedMember(null)} className="text-zinc-500 hover:text-zinc-200 text-xl leading-none">&times;</button>
            </div>
            <form onSubmit={handleEditSubmit} className="p-5 space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div><label className={labelCls}>Name *</label><input type="text" value={selectedMember.name} onChange={e => setSelectedMember({...selectedMember, name: e.target.value})} className={inputCls} required /></div>
                <div><label className={labelCls}>Role / Title *</label><input type="text" value={selectedMember.role} onChange={e => setSelectedMember({...selectedMember, role: e.target.value})} className={inputCls} required /></div>
                <div>
                  <label className={labelCls}>Category *</label>
                  <select value={selectedMember.category} onChange={e => setSelectedMember({...selectedMember, category: e.target.value})} className={inputCls} required>
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div><label className={labelCls}>Sort Order</label><input type="number" value={selectedMember.display_order} onChange={e => setSelectedMember({...selectedMember, display_order: Number(e.target.value)})} className={inputCls} /></div>
                <div><label className={labelCls}>College</label><input type="text" value={selectedMember.college || ''} onChange={e => setSelectedMember({...selectedMember, college: e.target.value})} className={inputCls} /></div>
                <div><label className={labelCls}>Year</label><input type="text" value={selectedMember.year || ''} onChange={e => setSelectedMember({...selectedMember, year: e.target.value})} className={inputCls} /></div>
                <div><label className={labelCls}>Major</label><input type="text" value={selectedMember.major || ''} onChange={e => setSelectedMember({...selectedMember, major: e.target.value})} className={inputCls} /></div>
                <div><label className={labelCls}>Minor</label><input type="text" value={selectedMember.minor || ''} onChange={e => setSelectedMember({...selectedMember, minor: e.target.value})} className={inputCls} /></div>
                <div><label className={labelCls}>Pronouns</label><input type="text" value={selectedMember.pronouns || ''} onChange={e => setSelectedMember({...selectedMember, pronouns: e.target.value})} className={inputCls} /></div>
                <div><label className={labelCls}>Favorite Snack</label><input type="text" value={selectedMember.favorite_snack || ''} onChange={e => setSelectedMember({...selectedMember, favorite_snack: e.target.value})} className={inputCls} /></div>
              </div>
              <div>
                <label className={labelCls}>Fun Fact</label>
                <textarea value={selectedMember.fun_fact || ''} onChange={e => setSelectedMember({...selectedMember, fun_fact: e.target.value})} className={inputCls} rows={2} />
              </div>
              <div>
                <label className={labelCls}>Profile Photo</label>
                {selectedMember.image_url && !editImagePreview && (
                  <div className="mt-2 mb-3 flex items-center gap-3">
                    <img src={selectedMember.image_url} alt="Current" className="w-16 h-16 object-cover rounded-full border border-zinc-700" />
                    <button type="button" className="text-xs text-red-400 hover:text-red-300" onClick={() => setSelectedMember({...selectedMember, image_url: ''})}>Remove image</button>
                  </div>
                )}
                <div {...getEditRootProps()} className={`mt-1 flex flex-col items-center justify-center border border-dashed rounded p-5 cursor-pointer transition-colors ${isEditDragActive ? 'border-zinc-400 bg-zinc-800/30' : 'border-zinc-700'}`}>
                  <input {...getEditInputProps()} />
                  {editImagePreview ? (
                    <img src={editImagePreview} alt="Preview" className="w-20 h-20 rounded-full object-cover" />
                  ) : (
                    <p className="text-zinc-500 text-xs">Drag and drop or click to upload new photo</p>
                  )}
                </div>
              </div>
              <div className="flex gap-2 pt-2">
                <button type="submit" disabled={uploading} className="flex-1 bg-zinc-700 hover:bg-zinc-600 border border-zinc-600 text-zinc-100 py-2.5 rounded text-sm font-medium transition-colors disabled:opacity-50">Save Changes</button>
                <button type="button" onClick={() => setSelectedMember(null)} className="px-5 py-2.5 border border-zinc-700 text-zinc-400 hover:text-zinc-200 rounded text-sm transition-colors">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      {memberToDelete && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-zinc-900 p-6 rounded-md max-w-sm w-full border border-zinc-800">
            <h3 className="text-base font-semibold text-zinc-50 mb-2">Remove Member</h3>
            <p className="text-zinc-400 text-sm mb-5">Remove <span className="text-zinc-200 font-medium">{memberToDelete.name}</span> from the directory? This cannot be undone.</p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setMemberToDelete(null)} className="px-4 py-2 text-sm text-zinc-500 hover:text-zinc-200 transition-colors">Cancel</button>
              <button onClick={handleDeleteConfirm} className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm rounded transition-colors">Remove</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
