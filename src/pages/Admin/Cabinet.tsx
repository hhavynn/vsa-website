import { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import { supabase } from '../../lib/supabase';
import { useDropzone } from 'react-dropzone';
import { PageTitle } from '../../components/common/PageTitle';
import { AdminNav } from '../../components/features/admin/AdminNav';

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
  { name: 'Allyson Hong', role: 'Intern', category: 'Interns', image: 'https://drive.google.com/uc?id=14P1xdlZqq_dEj99opLaYllxdb8CwbN2Q', year: '1st Year', college: 'Eighth College', major: 'Human Biology', funFact: 'I can do the worm :P' },
  { name: 'Matthew Cao', role: 'Intern', category: 'Interns', image: 'https://drive.google.com/uc?id=1gCTg3o6nH11zUwAJpxApvmb2G2bEKLp_', year: '1st Year', college: 'ERC', major: 'Human Biology', funFact: 'I have a fear of spiders' },
  { name: 'Tristan Vu', role: 'Intern', category: 'Interns', image: 'https://drive.google.com/uc?id=1f9b4y5oVUglrGyXk2-pbxNfO95xYy4vW', year: '1st Year Transfer', college: 'Warren College', major: 'Bioengineering: Biotechnology', funFact: 'i LOVE McChickens' },
  { name: 'Teresa Pham', role: 'Intern', category: 'Interns', image: 'https://drive.google.com/uc?id=1ylqc3ijfu_AttzSk3ee0OxWN8TztC8S8', year: '1st Year Transfer', college: 'Marshall College', major: 'General Biology', funFact: 'i used to live in florida' },
  { name: 'Hailie Cheng', role: 'Intern', category: 'Interns', image: 'https://drive.google.com/uc?id=1trhJaQx_NUHJLdDUAop4KmgCO8vvWyI6', year: '2nd Year', college: 'Seventh College', major: 'Public Health with Concentration in Medicine Sciences', funFact: 'met daniela from katseye & met rice gum (at vsa aftersocial actually) last month' },
];

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
      toast.error('Name, Role, and Category are required');
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

      toast.success('Member added!');
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
      } else if (!selectedMember.image_url && editImagePreview === null && imageUrl) {
        // Handled removal logic implicitly if image_url was cleared out manually
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

      toast.success('Member updated!');
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
      // Note: Ideal to delete the storage object as well if no longer used.
      // But keeping it simple for now as it's an admin operation.
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
    // Basic sorting adjustment
    const categoryMembers = members.filter(m => m.category === member.category);
    const currentIndex = categoryMembers.findIndex(m => m.id === member.id);
    
    if (direction === 'up' && currentIndex > 0) {
      const prevMember = categoryMembers[currentIndex - 1];
      const newOrder1 = prevMember.display_order;
      const newOrder2 = member.display_order;
      
      await supabase.from('cabinet_members').update({ display_order: newOrder2 }).eq('id', prevMember.id);
      await supabase.from('cabinet_members').update({ display_order: newOrder1 }).eq('id', member.id);
      fetchMembers();
    } else if (direction === 'down' && currentIndex < categoryMembers.length - 1) {
      const nextMember = categoryMembers[currentIndex + 1];
      const newOrder1 = nextMember.display_order;
      const newOrder2 = member.display_order;
      
      await supabase.from('cabinet_members').update({ display_order: newOrder2 }).eq('id', nextMember.id);
      await supabase.from('cabinet_members').update({ display_order: newOrder1 }).eq('id', member.id);
      fetchMembers();
    }
  };

  const inputCls = 'mt-1 block w-full rounded-md border-gray-600 bg-gray-700 text-white shadow-sm focus:border-indigo-500 focus:ring-indigo-500 px-3 py-2 text-sm';
  const labelCls = 'block text-sm font-medium text-gray-300';

  return (
    <div className="container mx-auto px-4 py-8 bg-gray-50 dark:bg-gray-950 transition-colors duration-300">
      <PageTitle title="Cabinet Management" />
      <AdminNav />

      <div className="flex space-x-3 mb-6">
        <button onClick={() => setActiveTab('manage')} className={`px-5 py-2 rounded-lg font-medium text-sm ${activeTab === 'manage' ? 'bg-indigo-600 text-white' : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300'}`}>
          Manage Directory
        </button>
        <button onClick={() => setActiveTab('create')} className={`px-5 py-2 rounded-lg font-medium text-sm ${activeTab === 'create' ? 'bg-indigo-600 text-white' : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300'}`}>
          Add New Member
        </button>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 min-h-[500px]">
        {activeTab === 'create' ? (
          <div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-6">Add New Cabinet Member</h2>
            <form onSubmit={handleCreateMember} className="space-y-6">
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div><label className={labelCls}>Name *</label><input type="text" value={newMember.name} onChange={e => setNewMember({...newMember, name: e.target.value})} className={inputCls} required /></div>
                  <div><label className={labelCls}>Role/Title *</label><input type="text" value={newMember.role} onChange={e => setNewMember({...newMember, role: e.target.value})} className={inputCls} required /></div>
                  <div>
                    <label className={labelCls}>Category *</label>
                    <select value={newMember.category} onChange={e => setNewMember({...newMember, category: e.target.value})} className={inputCls} required>
                      {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div><label className={labelCls}>Sort Order (Low numbers first)</label><input type="number" value={newMember.display_order} onChange={e => setNewMember({...newMember, display_order: Number(e.target.value)})} className={inputCls} /></div>
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
                  <div {...getRootProps()} className={`mt-1 flex flex-col items-center justify-center border-2 border-dashed rounded-lg p-4 cursor-pointer transition-colors ${isDragActive ? 'border-indigo-500 bg-indigo-900/20' : 'border-gray-600 bg-gray-700/50'}`}>
                    <input {...getInputProps()} />
                    {imagePreview ? (
                      <img src={imagePreview} alt="Preview" className="w-24 h-24 rounded-full object-cover" />
                    ) : (
                      <p className="text-gray-400 text-xs">Drag & drop or click to upload</p>
                    )}
                  </div>
                </div>
              </div>
              <button type="submit" disabled={uploading} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2.5 rounded-lg disabled:opacity-50">
                {uploading ? 'Adding...' : 'Add Member'}
              </button>
            </form>
          </div>
        ) : (
          <div>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Directory</h2>
              {members.length === 0 && !loading && (
                <button 
                  onClick={handleBulkMigrate} 
                  disabled={uploading}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-lg transition-colors"
                >
                  {uploading ? 'Migrating...' : 'Run Initial Data Migration'}
                </button>
              )}
            </div>
            {loading ? (
              <p className="text-gray-400">Loading...</p>
            ) : CATEGORIES.map(category => {
              const categoryMembers = members.filter(m => m.category === category);
              if (categoryMembers.length === 0) return null;
              
              return (
                <div key={category} className="mb-8">
                  <h3 className="text-lg font-semibold text-indigo-400 border-b border-gray-700 pb-2 mb-4">{category}</h3>
                  <div className="space-y-3">
                    {categoryMembers.map((m, idx) => (
                      <div key={m.id} className="flex items-center justify-between p-3 bg-gray-900 rounded-lg border border-gray-700">
                        <div className="flex items-center gap-4">
                          <div className="flex flex-col gap-1 items-center px-2">
                            <button onClick={() => moveMember(m, 'up')} disabled={idx === 0} className="text-gray-500 hover:text-white disabled:opacity-30">▲</button>
                            <span className="text-xs text-gray-500">{m.display_order}</span>
                            <button onClick={() => moveMember(m, 'down')} disabled={idx === categoryMembers.length - 1} className="text-gray-500 hover:text-white disabled:opacity-30">▼</button>
                          </div>
                          {m.image_url ? (
                            <img src={m.image_url} alt={m.name} className="w-12 h-12 rounded-full object-cover" />
                          ) : (
                            <div className="w-12 h-12 rounded-full bg-gray-700 flex items-center justify-center text-gray-400 text-xs text-center border overflow-hidden">No Pic</div>
                          )}
                          <div>
                            <p className="font-semibold text-white leading-tight">{m.name}</p>
                            <p className="text-xs text-gray-400">{m.role}</p>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button onClick={() => setSelectedMember(m)} className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-white text-xs rounded-md">Edit</button>
                          <button onClick={() => setMemberToDelete(m)} className="px-3 py-1.5 bg-red-900/40 hover:bg-red-600 text-red-400 hover:text-white text-xs rounded-md">Delete</button>
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
          <div className="bg-gray-900 rounded-xl max-w-2xl w-full my-8 border border-gray-700">
            <div className="p-6 border-b border-gray-700 flex justify-between">
              <h2 className="text-xl font-bold text-white">Edit {selectedMember.name}</h2>
              <button onClick={() => setSelectedMember(null)} className="text-gray-400 hover:text-white text-2xl">&times;</button>
            </div>
            <form onSubmit={handleEditSubmit} className="p-6 space-y-6">
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div><label className={labelCls}>Name *</label><input type="text" value={selectedMember.name} onChange={e => setSelectedMember({...selectedMember, name: e.target.value})} className={inputCls} required /></div>
                  <div><label className={labelCls}>Role/Title *</label><input type="text" value={selectedMember.role} onChange={e => setSelectedMember({...selectedMember, role: e.target.value})} className={inputCls} required /></div>
                  <div>
                    <label className={labelCls}>Category *</label>
                    <select value={selectedMember.category} onChange={e => setSelectedMember({...selectedMember, category: e.target.value})} className={inputCls} required>
                      {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div><label className={labelCls}>Sort Order (Low numbers first)</label><input type="number" value={selectedMember.display_order} onChange={e => setSelectedMember({...selectedMember, display_order: Number(e.target.value)})} className={inputCls} /></div>
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
                    <div className="mt-2 mb-3">
                      <img src={selectedMember.image_url} alt="Current" className="w-24 h-24 object-cover rounded-full border border-gray-600" />
                      <button type="button" className="mt-2 text-xs text-red-400" onClick={() => setSelectedMember({...selectedMember, image_url: ''})}>Remove existing image</button>
                    </div>
                  )}
                  <div {...getEditRootProps()} className={`mt-1 flex flex-col items-center justify-center border-2 border-dashed rounded-lg p-4 cursor-pointer transition-colors ${isEditDragActive ? 'border-indigo-500 bg-indigo-900/20' : 'border-gray-600 bg-gray-700/50'}`}>
                    <input {...getEditInputProps()} />
                    {editImagePreview ? (
                      <img src={editImagePreview} alt="Preview" className="w-24 h-24 rounded-full object-cover" />
                    ) : (
                      <p className="text-gray-400 text-xs">Drag & drop or click to upload new photo</p>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex gap-3">
                <button type="submit" disabled={uploading} className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white py-2.5 rounded-lg">Save Changes</button>
                <button type="button" onClick={() => setSelectedMember(null)} className="px-6 py-2.5 bg-gray-700 text-white rounded-lg">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Modal */}
      {memberToDelete && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 p-6 rounded-xl max-w-md w-full border border-gray-700">
            <h3 className="text-xl font-bold text-white mb-2">Remove Member</h3>
            <p className="text-gray-400 mb-6">Are you sure you want to remove {memberToDelete.name} from the directory?</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setMemberToDelete(null)} className="px-4 py-2 text-gray-400 hover:text-white">Cancel</button>
              <button onClick={handleDeleteConfirm} className="px-5 py-2 bg-red-600 text-white rounded-lg">Remove</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
