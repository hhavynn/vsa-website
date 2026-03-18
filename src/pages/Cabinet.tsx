import { useState, useEffect } from 'react';
import { PageTitle } from '../components/common/PageTitle';
import { RevealOnScrollWrapper } from '../components/common/RevealOnScrollWrapper';
import { supabase } from '../lib/supabase';

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

const publicUrl = process.env.PUBLIC_URL || '';
const cabinetImage = (fileName: string) => `${publicUrl}/images/cabinet/${fileName}`;

function CabinetPhoto({ image, name }: { image?: string | null; name: string }) {
  const [hasError, setHasError] = useState(false);

  if (!image || hasError) {
    return (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-zinc-500" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
      </svg>
    );
  }

  // Handle local public paths vs remote Supabase storage URLs
  const imageUrl = image.startsWith('http') || image.startsWith('data:')
    ? image
    : cabinetImage(image);

  return (
    <img
      src={imageUrl}
      alt={name}
      className="object-cover w-full h-full"
      loading="lazy"
      onError={() => setHasError(true)}
    />
  );
}

function MemberCard({ member, compact = false }: { member: CabinetMember; compact?: boolean }) {
  return (
    <div className="border border-zinc-200 dark:border-[#27272a] bg-white dark:bg-[#18181b] rounded-md p-5 flex flex-col items-center">
      <div className={`${compact ? 'w-20 h-20' : 'w-28 h-28'} rounded-full bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 flex items-center justify-center overflow-hidden mb-4 shrink-0`}>
        <CabinetPhoto image={member.image_url} name={member.name} />
      </div>
      <div className="text-center w-full">
        <p className={`font-semibold text-zinc-900 dark:text-zinc-50 mb-1 ${compact ? 'text-sm' : 'text-base'}`}>{member.name}</p>
        {!compact && (
          <div className="space-y-0.5 text-xs text-zinc-500 dark:text-zinc-400 mt-2">
            {member.year && <p>{member.year}</p>}
            {member.college && <p>{member.college}</p>}
            {member.major && <p>{member.major}</p>}
            {member.minor && <p>Minor: {member.minor}</p>}
            {member.pronouns && <p className="text-zinc-400 dark:text-zinc-500">{member.pronouns}</p>}
            {member.favorite_snack && <p className="mt-2 text-zinc-600 dark:text-zinc-400">Snack: {member.favorite_snack}</p>}
            {member.fun_fact && (
              <p className="mt-2 text-zinc-500 dark:text-zinc-400 italic text-xs leading-relaxed">"{member.fun_fact}"</p>
            )}
          </div>
        )}
        {compact && member.year && (
          <p className="text-xs text-zinc-400 mt-0.5">{member.year}</p>
        )}
      </div>
    </div>
  );
}

export function Cabinet() {
  const [members, setMembers] = useState<CabinetMember[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchCabinet() {
      try {
        const { data, error } = await supabase
          .from('cabinet_members')
          .select('*')
          .order('display_order', { ascending: true })
          .order('created_at', { ascending: true });

        if (error) {
          console.warn('Failed to fetch cabinet members:', error);
          setMembers([]);
        } else {
          setMembers(data as CabinetMember[]);
        }
      } catch (err) {
        console.error('Fetch error:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchCabinet();
  }, []);

  const execBoard = members.filter(m => m.category === 'Executive Board');
  const genBoard = members.filter(m => m.category === 'General Board');
  const internBoard = members.filter(m => m.category === 'Interns');
  const otherBoard = members.filter(m => !['Executive Board', 'General Board', 'Interns'].includes(m.category));

  const renderGroup = (title: string, groupData: CabinetMember[], displayConfig: 'standard' | 'intern' = 'standard') => {
    if (groupData.length === 0) return null;

    const roleGroups: Record<string, CabinetMember[]> = {};
    groupData.forEach(m => {
      const key = displayConfig === 'intern' ? 'All' : m.role;
      if (!roleGroups[key]) roleGroups[key] = [];
      roleGroups[key].push(m);
    });

    return (
      <RevealOnScrollWrapper key={title}>
        <div className="mb-10">
          <div className="flex items-center gap-3 mb-6">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50 tracking-tight">{title}</h2>
            <div className="flex-1 h-px bg-zinc-200 dark:bg-zinc-800" />
            <span className="text-xs text-zinc-400 tabular-nums">{groupData.length}</span>
          </div>
          <div className="space-y-8">
            {Object.entries(roleGroups).map(([role, roleMembers]) => (
              <div key={role}>
                {role !== 'All' && (
                  <p className="text-xs font-semibold uppercase tracking-label text-zinc-400 dark:text-zinc-500 mb-3">{role}</p>
                )}
                <div className={`grid gap-4 ${displayConfig === 'intern'
                    ? 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4'
                    : roleMembers.length === 1
                      ? 'grid-cols-1 max-w-xs mx-auto'
                      : roleMembers.length === 2
                        ? 'grid-cols-1 sm:grid-cols-2 max-w-2xl mx-auto'
                        : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'
                  }`}>
                  {roleMembers.map(member => (
                    <MemberCard
                      key={member.id}
                      member={member}
                      compact={displayConfig === 'intern'}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </RevealOnScrollWrapper>
    );
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <PageTitle title="Cabinet" />

      <RevealOnScrollWrapper>
        <div className="mb-10">
          <h1 className="font-sans font-bold text-3xl text-zinc-900 dark:text-zinc-50 tracking-tight mb-1">Cabinet</h1>
          <p className="text-zinc-500 text-sm">Meet the 2025–2026 leadership team — Mi Xao Moggers</p>
        </div>
      </RevealOnScrollWrapper>

      {loading ? (
        <div className="flex justify-center p-16">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-zinc-300 dark:border-zinc-700 border-t-brand-600" />
        </div>
      ) : members.length === 0 ? (
        <div className="border border-zinc-200 dark:border-zinc-800 rounded-md p-12 text-center text-zinc-500 text-sm">
          Cabinet information is currently being updated. Check back soon.
        </div>
      ) : (
        <>
          {renderGroup('Executive Board', execBoard, 'standard')}
          {renderGroup('General Board', genBoard, 'standard')}
          {renderGroup('Interns', internBoard, 'intern')}
          {renderGroup('Other Leadership', otherBoard, 'standard')}
        </>
      )}
    </div>
  );
}
