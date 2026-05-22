import { useState, useEffect, useCallback, useMemo } from 'react';
import toast from 'react-hot-toast';
import { supabase } from '../../lib/supabase';
import { useDropzone } from 'react-dropzone';
import { PageTitle } from '../../components/common/PageTitle';
import { useCabinetYears } from '../../hooks/useCabinetYears';
import { getCurrentCabinetYear } from '../../lib/cabinetYears';
import { CabinetYear } from '../../types';
import { COLLEGE_OPTIONS, YEAR_OPTIONS } from '../../constants/cabinetOptions';
import { extractSupabasePublicObjectName, getUploadExtension, prepareImageForUpload } from '../../lib/imageUpload';

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
  cabinet_year_id: string | null;
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
  cabinet_year_id: null,
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

const ROLE_SUGGESTIONS = ['Historian', 'Public Relations Chair'];

const inputCls = 'mt-1 block w-full rounded border px-3 py-2.5 text-[15px] sm:py-2 sm:text-sm focus:outline-none focus:border-[var(--brand)] focus:ring-1 focus:ring-[var(--brand)] bg-[var(--color-surface2)] border-[var(--color-border)] text-[var(--color-text)] placeholder-[var(--color-text3)] transition';
const labelCls = 'block font-mono text-[10px] font-bold uppercase tracking-[0.1em] text-[var(--color-text3)]';

function CabinetYearSelect({
  value,
  cabinetYears,
  currentCabinetYear,
  loading,
  error,
  onChange,
}: {
  value?: string | null;
  cabinetYears: CabinetYear[];
  currentCabinetYear: CabinetYear | null;
  loading: boolean;
  error: unknown;
  onChange: (cabinetYearId: string | null) => void;
}) {
  const selectedYear = value ? cabinetYears.find((year) => year.id === value) : null;
  const helperText = selectedYear
    ? `Assigned to ${selectedYear.label}.`
    : currentCabinetYear
      ? `Defaults to active year: ${currentCabinetYear.label}.`
      : 'No active cabinet year is available yet.';
  const yearOptions = [
    <option key="default" value="">
      {loading ? 'Loading years...' : 'Use active cabinet year'}
    </option>,
    ...cabinetYears.map((year) => (
      <option key={year.id} value={year.id}>
        {year.label}
      </option>
    )),
  ];
  const children = [
    <label key="label" className={labelCls}>Cabinet Year</label>,
    <select
      key="select"
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value || null)}
      className={inputCls}
    >
      {yearOptions}
    </select>,
    <p key="helper" className="mt-1 text-xs text-zinc-500">
      {helperText}
    </p>,
  ];

  if (error) {
    children.push(
      <p key="error" className="mt-1 text-xs text-amber-500">
        Cabinet years could not be loaded. Existing cabinet member fields can still be edited.
      </p>
    );
  }

  return <div>{children}</div>;
}

export default function AdminCabinet() {
  const { cabinetYears, loading: yearsLoading, error: yearsError } = useCabinetYears();
  const currentCabinetYear = getCurrentCabinetYear(cabinetYears);
  const [members, setMembers] = useState<CabinetMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'create' | 'manage'>('manage');

  // Which cabinet year the admin is currently editing
  const [selectedAdminYearId, setSelectedAdminYearId] = useState<string | null>(null);

  const [selectedMember, setSelectedMember] = useState<CabinetMember | null>(null);
  const [newMember, setNewMember] = useState<Partial<CabinetMember>>(EMPTY_MEMBER);

  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  const [editImageFile, setEditImageFile] = useState<File | null>(null);
  const [editImagePreview, setEditImagePreview] = useState<string | null>(null);

  const [uploading, setUploading] = useState(false);
  const [memberToDelete, setMemberToDelete] = useState<CabinetMember | null>(null);

  // Once cabinet years load, default to the active/most-recent year
  useEffect(() => {
    if (selectedAdminYearId === null && cabinetYears.length > 0) {
      const defaultYear = currentCabinetYear ?? cabinetYears[0];
      setSelectedAdminYearId(defaultYear?.id ?? null);
    }
  }, [cabinetYears, currentCabinetYear, selectedAdminYearId]);

  // Keep new-member cabinet_year_id in sync with the selected admin year
  useEffect(() => {
    setNewMember(prev => ({ ...prev, cabinet_year_id: selectedAdminYearId }));
  }, [selectedAdminYearId]);

  const selectedAdminYear = cabinetYears.find(y => y.id === selectedAdminYearId) ?? null;

  // Members visible in the manage tab: only those belonging to the selected year.
  // Null-year members are shown alongside the current/active year (matching public page behaviour).
  const filteredMembers = useMemo(() => {
    if (!selectedAdminYearId) return members;
    return members.filter(m =>
      m.cabinet_year_id === selectedAdminYearId ||
      (!m.cabinet_year_id && selectedAdminYearId === currentCabinetYear?.id)
    );
  }, [members, selectedAdminYearId, currentCabinetYear?.id]);

  // When saving, fall back to the currently selected admin year if no year was explicitly chosen
  const resolveCabinetYearId = (cabinetYearId?: string | null) =>
    cabinetYearId || selectedAdminYearId || currentCabinetYear?.id || null;

  const getCabinetYearLabel = (cabinetYearId?: string | null) => {
    const year = cabinetYearId ? cabinetYears.find((item) => item.id === cabinetYearId) : currentCabinetYear;
    return year?.label ?? 'Unassigned year';
  };
  const roleSuggestions = Array.from(
    new Set([...filteredMembers.map((member) => member.role), ...ROLE_SUGGESTIONS])
  ).filter(Boolean).sort((a, b) => a.localeCompare(b));

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
          cabinet_year_id: resolveCabinetYearId(null),
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
    maxSize: 8 * 1024 * 1024,
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
    maxSize: 8 * 1024 * 1024,
  });

  const uploadImage = async (file: File): Promise<string> => {
    const preparedFile = await prepareImageForUpload(file, 'cabinet');
    const fileExt = getUploadExtension(preparedFile);
    const fileName = `${crypto.randomUUID()}.${fileExt}`;
    const { error } = await supabase.storage.from('cabinet_images').upload(fileName, preparedFile, {
      cacheControl: '31536000',
      contentType: preparedFile.type,
    });
    if (error) throw error;
    const { data } = supabase.storage.from('cabinet_images').getPublicUrl(fileName);
    return data.publicUrl;
  };

  async function removeCabinetImage(url?: string | null) {
    const objectName = extractSupabasePublicObjectName(url, 'cabinet_images');
    if (objectName) await supabase.storage.from('cabinet_images').remove([objectName]);
  }

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
        cabinet_year_id: resolveCabinetYearId(newMember.cabinet_year_id),
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
      let imageUrlToRemove: string | null = null;
      if (editImageFile) {
        imageUrlToRemove = selectedMember.image_url;
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
        cabinet_year_id: resolveCabinetYearId(selectedMember.cabinet_year_id),
      }).eq('id', selectedMember.id);

      if (error) throw error;
      await removeCabinetImage(imageUrlToRemove);

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
      await removeCabinetImage(memberToDelete.image_url);
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
    const categoryMembers = filteredMembers.filter(m => m.category === member.category);
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
    <div className="flex-1 overflow-y-auto">
      <PageTitle title="Cabinet Management" />

      <div className="border-b px-6 py-6 sm:flex sm:items-center sm:justify-between sm:gap-4 sm:px-8 sm:py-8" style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}>
        <div className="mb-4 sm:mb-0">
          <h1 className="font-serif text-3xl font-bold tracking-tight sm:text-4xl" style={{ color: 'var(--color-text)' }}>Cabinet</h1>
          <p className="mt-2 font-sans text-sm" style={{ color: 'var(--color-text2)' }}>Manage the cabinet directory</p>
        </div>
        <div className="inline-flex overflow-hidden rounded border" style={{ borderColor: 'var(--color-border)' }}>
          {(['manage', 'create'] as const).map((tab, i) => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className="font-sans text-[13px] font-semibold transition-colors duration-150 sm:text-sm"
              style={{ padding: '8px 16px', fontWeight: activeTab === tab ? 600 : 500, background: activeTab === tab ? 'var(--color-surface2)' : 'transparent', color: activeTab === tab ? 'var(--color-text)' : 'var(--color-text2)', borderLeft: i > 0 ? '1px solid var(--color-border)' : 'none', cursor: 'pointer' }}>
              {tab === 'manage' ? 'Manage' : 'Add Member'}
            </button>
          ))}
        </div>
      </div>

      {/* Cabinet year selector */}
      <div className="flex flex-wrap items-center gap-4 border-b px-6 py-4 sm:px-8" style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}>
        <span className="font-mono text-[10px] font-bold uppercase tracking-[0.1em]" style={{ color: 'var(--color-text3)', whiteSpace: 'nowrap' }}>
          Cabinet Year
        </span>
        {yearsLoading ? (
          <span className="font-sans text-[13px]" style={{ color: 'var(--color-text3)' }}>Loading years…</span>
        ) : cabinetYears.length === 0 ? (
          <span className="font-sans text-[13px]" style={{ color: 'var(--color-text3)' }}>No cabinet years configured</span>
        ) : (
          <div className="flex flex-wrap items-center gap-3">
            <select
              value={selectedAdminYearId ?? ''}
              onChange={e => setSelectedAdminYearId(e.target.value || null)}
              className="rounded border bg-[var(--color-surface2)] px-3 py-1.5 font-sans text-[13px] text-[var(--color-text)] focus:border-[var(--brand)] focus:outline-none focus:ring-1 focus:ring-[var(--brand)]"
              style={{ borderColor: 'var(--color-border)' }}
            >
              {cabinetYears.map(year => (
                <option key={year.id} value={year.id}>
                  {year.label}{year.is_active ? ' (Active)' : ''}
                </option>
              ))}
            </select>
            {selectedAdminYear && (
              <span className="font-sans text-[13px]" style={{ color: 'var(--color-text2)' }}>
                Editing: <strong style={{ color: 'var(--color-text)' }}>{selectedAdminYear.label} Cabinet</strong>
                {selectedAdminYear.is_active && (
                  <span className="ml-2 inline-flex items-center rounded border px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-[0.1em]"
                    style={{ background: 'var(--color-surface2)', color: 'var(--color-text2)', borderColor: 'var(--color-border)' }}>
                    Active
                  </span>
                )}
              </span>
            )}
          </div>
        )}
      </div>

      <div className="p-4 sm:p-6 lg:p-8">
      <div className="scrapbook-paper min-h-[500px]" style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}>
        {activeTab === 'create' ? (
          <div className="p-6 sm:p-8">
            <h2 className="mb-6 font-serif text-xl font-bold" style={{ color: 'var(--color-text)' }}>Add Cabinet Member</h2>
            <form onSubmit={handleCreateMember} className="space-y-5">
              <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:gap-6">
                <div><label className={labelCls}>Name *</label><input type="text" value={newMember.name} onChange={e => setNewMember({...newMember, name: e.target.value})} className={inputCls} required /></div>
                <div><label className={labelCls}>Role / Title *</label><input type="text" list="cabinet-role-options" value={newMember.role} onChange={e => setNewMember({...newMember, role: e.target.value})} className={inputCls} required /></div>
                <div>
                  <label className={labelCls}>Category *</label>
                  <select value={newMember.category} onChange={e => setNewMember({...newMember, category: e.target.value})} className={inputCls} required>
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <CabinetYearSelect
                  value={newMember.cabinet_year_id}
                  cabinetYears={cabinetYears}
                  currentCabinetYear={currentCabinetYear}
                  loading={yearsLoading}
                  error={yearsError}
                  onChange={(cabinetYearId) => setNewMember({ ...newMember, cabinet_year_id: cabinetYearId })}
                />
                <div><label className={labelCls}>Sort Order</label><input type="number" value={newMember.display_order} onChange={e => setNewMember({...newMember, display_order: Number(e.target.value)})} className={inputCls} /></div>
                <div>
                  <label className={labelCls}>College</label>
                  <select value={newMember.college || ''} onChange={e => setNewMember({...newMember, college: e.target.value || null})} className={inputCls}>
                    <option value="">—</option>
                    {COLLEGE_OPTIONS.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Year</label>
                  <select value={newMember.year || ''} onChange={e => setNewMember({...newMember, year: e.target.value || null})} className={inputCls}>
                    <option value="">—</option>
                    {YEAR_OPTIONS.map(y => <option key={y} value={y}>{y}</option>)}
                  </select>
                </div>
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
                <div {...getRootProps()} className={`mt-2 flex flex-col items-center justify-center border border-dashed rounded-lg p-8 cursor-pointer transition-colors ${isDragActive ? 'border-[var(--brand)] bg-[var(--brand)]/5' : 'border-[var(--color-border)] hover:bg-[var(--color-surface2)]'}`}>
                  <input {...getInputProps()} />
                  {imagePreview ? (
                    <img src={imagePreview} alt="Preview" className="h-24 w-24 rounded-full object-cover shadow-sm" />
                  ) : (
                    <p className="text-xs" style={{ color: 'var(--color-text3)' }}>Drag and drop or click to upload</p>
                  )}
                </div>
              </div>
              <div className="pt-2">
                <button type="submit" disabled={uploading} className="vsa-btn-primary w-full py-3 disabled:opacity-50">
                  {uploading ? 'Adding...' : 'Add Member'}
                </button>
              </div>
            </form>
          </div>
        ) : (
          <div className="p-6 sm:p-8">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="font-serif text-xl font-bold" style={{ color: 'var(--color-text)' }}>Directory</h2>
              {members.length === 0 && !loading && (
                <button
                  onClick={handleBulkMigrate}
                  disabled={uploading}
                  className="vsa-btn-primary py-2 text-xs disabled:opacity-50"
                >
                  {uploading ? 'Migrating...' : 'Run Initial Data Migration'}
                </button>
              )}
            </div>
            {loading ? (
              <p className="py-8 text-center text-sm" style={{ color: 'var(--color-text3)' }}>Loading...</p>
            ) : filteredMembers.length === 0 && !loading ? (
              <p className="py-8 text-center text-sm" style={{ color: 'var(--color-text3)' }}>
                No members for {selectedAdminYear?.label ?? 'this cabinet year'} yet. Switch to "Add Member" to create one.
              </p>
            ) : CATEGORIES.map(category => {
              const categoryMembers = filteredMembers.filter(m => m.category === category);
              if (categoryMembers.length === 0) return null;

              return (
                <div key={category} className="mb-8">
                  <div className="mb-3 flex items-center gap-3 border-b pb-2" style={{ borderColor: 'var(--color-border)' }}>
                    <h3 className="font-mono text-[10px] font-bold uppercase tracking-[0.1em]" style={{ color: 'var(--color-text3)' }}>{category}</h3>
                    <span className="font-sans text-[11px]" style={{ color: 'var(--color-text3)' }}>{categoryMembers.length}</span>
                  </div>
                  <div className="space-y-2">
                    {categoryMembers.map((m, idx) => (
                      <div key={m.id} className="flex flex-col gap-3 rounded border bg-[var(--color-surface2)] p-3 transition-colors hover:bg-[var(--color-surface)] sm:flex-row sm:items-center sm:justify-between" style={{ borderColor: 'var(--color-border)' }}>
                        <div className="flex items-center gap-3">
                          <div className="flex flex-col items-center gap-0.5 px-1">
                            <button onClick={() => moveMember(m, 'up')} disabled={idx === 0} className="text-xs leading-none transition-colors disabled:opacity-20" style={{ color: 'var(--color-text3)' }}>▲</button>
                            <span className="font-mono text-[10px]" style={{ color: 'var(--color-text3)' }}>{m.display_order}</span>
                            <button onClick={() => moveMember(m, 'down')} disabled={idx === categoryMembers.length - 1} className="text-xs leading-none transition-colors disabled:opacity-20" style={{ color: 'var(--color-text3)' }}>▼</button>
                          </div>
                          {m.image_url ? (
                            <img src={m.image_url} alt={m.name} className="h-12 w-12 shrink-0 rounded-full border object-cover shadow-sm" style={{ borderColor: 'var(--color-border)' }} />
                          ) : (
                            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border text-[13px] font-semibold" style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text2)' }}>
                              {m.name.charAt(0)}
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="truncate font-sans text-[15px] font-bold leading-tight" style={{ color: 'var(--color-text)' }}>{m.name}</p>
                            <p className="truncate font-sans text-xs" style={{ color: 'var(--color-text2)' }}>{m.role}</p>
                            <p className="mt-1 font-mono text-[9px] uppercase tracking-[0.1em]" style={{ color: 'var(--color-text3)' }}>
                              {getCabinetYearLabel(m.cabinet_year_id)}
                            </p>
                          </div>
                        </div>
                        <div className="flex shrink-0 gap-2 pl-11 sm:pl-0">
                          <button onClick={() => setSelectedMember({ ...m, cabinet_year_id: resolveCabinetYearId(m.cabinet_year_id) })} className="flex-1 rounded border bg-[var(--color-surface)] px-3 py-1.5 text-xs font-semibold transition-colors hover:bg-[var(--color-surface2)] sm:flex-none" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text2)' }}>Edit</button>
                          <button onClick={() => setMemberToDelete(m)} className="flex-1 rounded border border-red-900/30 px-3 py-1.5 text-xs font-semibold text-red-600 transition-colors hover:bg-red-600 hover:text-white sm:flex-none">Remove</button>
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
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-4 backdrop-blur-sm sm:items-center">
          <div className="scrapbook-paper my-8 w-full max-w-2xl sm:my-0" style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}>
            <div className="flex items-center justify-between border-b px-6 py-5" style={{ borderColor: 'var(--color-border)' }}>
              <h2 className="font-serif text-xl font-bold" style={{ color: 'var(--color-text)' }}>Edit {selectedMember.name}</h2>
              <button onClick={() => setSelectedMember(null)} className="text-2xl leading-none transition-colors hover:text-[var(--color-text)]" style={{ color: 'var(--color-text3)' }}>&times;</button>
            </div>
            <form onSubmit={handleEditSubmit} className="space-y-5 p-6 sm:p-8">
              <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:gap-6">
                <div><label className={labelCls}>Name *</label><input type="text" value={selectedMember.name} onChange={e => setSelectedMember({...selectedMember, name: e.target.value})} className={inputCls} required /></div>
                <div><label className={labelCls}>Role / Title *</label><input type="text" list="cabinet-role-options" value={selectedMember.role} onChange={e => setSelectedMember({...selectedMember, role: e.target.value})} className={inputCls} required /></div>
                <div>
                  <label className={labelCls}>Category *</label>
                  <select value={selectedMember.category} onChange={e => setSelectedMember({...selectedMember, category: e.target.value})} className={inputCls} required>
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <CabinetYearSelect
                  value={selectedMember.cabinet_year_id}
                  cabinetYears={cabinetYears}
                  currentCabinetYear={currentCabinetYear}
                  loading={yearsLoading}
                  error={yearsError}
                  onChange={(cabinetYearId) => setSelectedMember({ ...selectedMember, cabinet_year_id: cabinetYearId })}
                />
                <div><label className={labelCls}>Sort Order</label><input type="number" value={selectedMember.display_order} onChange={e => setSelectedMember({...selectedMember, display_order: Number(e.target.value)})} className={inputCls} /></div>
                <div>
                  <label className={labelCls}>College</label>
                  <select value={selectedMember.college || ''} onChange={e => setSelectedMember({...selectedMember, college: e.target.value || null})} className={inputCls}>
                    <option value="">—</option>
                    {selectedMember.college && !(COLLEGE_OPTIONS as readonly string[]).includes(selectedMember.college) && (
                      <option value={selectedMember.college}>{selectedMember.college} (legacy)</option>
                    )}
                    {COLLEGE_OPTIONS.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Year</label>
                  <select value={selectedMember.year || ''} onChange={e => setSelectedMember({...selectedMember, year: e.target.value || null})} className={inputCls}>
                    <option value="">—</option>
                    {selectedMember.year && !(YEAR_OPTIONS as readonly string[]).includes(selectedMember.year) && (
                      <option value={selectedMember.year}>{selectedMember.year} (legacy)</option>
                    )}
                    {YEAR_OPTIONS.map(y => <option key={y} value={y}>{y}</option>)}
                  </select>
                </div>
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
                  <div className="mb-4 mt-2 flex items-center gap-4">
                    <img src={selectedMember.image_url} alt="Current" className="h-20 w-20 rounded-full border object-cover shadow-sm" style={{ borderColor: 'var(--color-border)' }} />
                    <button type="button" className="text-xs font-semibold text-red-500 hover:text-red-600" onClick={() => setSelectedMember({...selectedMember, image_url: ''})}>Remove image</button>
                  </div>
                )}
                <div {...getEditRootProps()} className={`mt-2 flex flex-col items-center justify-center border border-dashed rounded-lg p-6 cursor-pointer transition-colors ${isEditDragActive ? 'border-[var(--brand)] bg-[var(--brand)]/5' : 'border-[var(--color-border)] hover:bg-[var(--color-surface2)]'}`}>
                  <input {...getEditInputProps()} />
                  {editImagePreview ? (
                    <img src={editImagePreview} alt="Preview" className="h-20 w-20 rounded-full object-cover shadow-sm" />
                  ) : (
                    <p className="text-xs" style={{ color: 'var(--color-text3)' }}>Drag and drop or click to upload new photo</p>
                  )}
                </div>
              </div>
              <div className="flex flex-col gap-3 pt-4 sm:flex-row-reverse sm:justify-start">
                <button type="submit" disabled={uploading} className="vsa-btn-primary sm:px-8 disabled:opacity-50">Save Changes</button>
                <button type="button" onClick={() => setSelectedMember(null)} className="rounded border bg-transparent px-6 py-2.5 text-sm font-semibold transition-colors hover:bg-[var(--color-surface2)]" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text2)' }}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      {memberToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="scrapbook-paper w-full max-w-sm p-6 sm:p-8" style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}>
            <h3 className="mb-3 font-serif text-xl font-bold" style={{ color: 'var(--color-text)' }}>Remove Member</h3>
            <p className="mb-6 font-sans text-[15px] text-[var(--color-text)]">Remove <span className="font-bold">{memberToDelete.name}</span> from the directory? This cannot be undone.</p>
            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button onClick={() => setMemberToDelete(null)} className="rounded border px-4 py-2.5 text-sm font-semibold transition-colors hover:bg-[var(--color-surface2)]" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text2)' }}>Cancel</button>
              <button onClick={handleDeleteConfirm} className="rounded bg-red-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-red-700">Remove</button>
            </div>
          </div>
        </div>
      )}
      <datalist id="cabinet-role-options">
        {roleSuggestions.map((role) => (
          <option key={role} value={role} />
        ))}
      </datalist>
      </div>
    </div>
  );
}
