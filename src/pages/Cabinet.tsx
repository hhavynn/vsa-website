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
      <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
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
        <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6 mb-12">
          <h2 className="text-2xl font-bold text-purple-600 dark:text-purple-400 text-center mb-8">{title}</h2>
          <div className="space-y-12">
            {Object.entries(roleGroups).map(([role, roleMembers]) => (
              <div key={role} className="space-y-6">
                {role !== 'All' && (
                  <h3 className="text-xl font-bold text-purple-600 dark:text-purple-400 text-center">{role}</h3>
                )}
                
                <div className={`grid ${displayConfig === 'intern' ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-8' : roleMembers.length === 1 ? 'grid-cols-1 max-w-md mx-auto gap-8' : 'grid-cols-1 md:grid-cols-2 gap-8'}`}>
                  {roleMembers.map((member) => (
                    <div key={member.id} className="bg-gray-50 dark:bg-gray-700 rounded-lg p-6 flex flex-col items-center">
                      <div className="w-32 h-32 rounded-full bg-gray-200 dark:bg-gray-600 flex items-center justify-center overflow-hidden mb-4 shrink-0">
                        <CabinetPhoto image={member.image_url} name={member.name} />
                      </div>
                      <div className="text-center w-full">
                        <p className="text-lg font-medium text-gray-900 dark:text-white mb-2">{member.name}</p>
                        <div className="space-y-1 text-sm text-gray-600 dark:text-gray-300">
                          {member.year && <p><strong>Year:</strong> {member.year}</p>}
                          {member.college && <p><strong>College:</strong> {member.college}</p>}
                          {member.major && <p><strong>Major:</strong> {member.major}</p>}
                          {member.minor && <p><strong>Minor:</strong> {member.minor}</p>}
                          {member.pronouns && <p><strong>Pronouns:</strong> {member.pronouns}</p>}
                          {member.favorite_snack && <p><strong>Favorite Snack:</strong> {member.favorite_snack}</p>}
                          {member.fun_fact && displayConfig !== 'intern' && <p className="mt-3 italic">"{member.fun_fact}"</p>}
                        </div>
                      </div>
                    </div>
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
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <PageTitle title="Cabinet" />

      <div className="w-full bg-purple-600 text-white text-center py-6 rounded-lg shadow-lg mb-8 transform transition-transform duration-1000 ease-out animate-slideUp">
        <h1 className="text-4xl font-bold">Introducing: Mi Xao Moggers</h1>
      </div>

      <div className="space-y-0">
        {loading ? (
          <div className="flex justify-center p-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
          </div>
        ) : members.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-12 text-center text-gray-500">
            Cabinet information is currently being updated for the new year. Check back soon!
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
    </div>
  );
}
