import { PageTitle } from '../components/PageTitle';

interface Position {
  title: string;
  count: number;
  description?: string;
  members: Array<{
    name: string;
    image: string;
    year?: string;
    college?: string;
    major?: string;
    minor?: string;
    pronouns?: string;
    favoriteSnack?: string;
    funFact?: string;
  }>;
}

const executiveBoard: Position[] = [
  {
    title: 'Co-President',
    count: 2,
    description: '',
    members: [
      { name: 'Gracie Nguyen', image: '/images/cabinet/gracie_nguyen.jpg', year: 'Second Year', college: 'Marshall College', major: 'General Biology' },
      { name: 'Phuong Le', image: '/images/cabinet/phuong_le.jpg', year: 'Second Year', college: 'Muir College', major: 'Political Science - International Relations' },
    ],
  },
  {
    title: 'Co-Intercollegiate Council',
    count: 2,
    description: '',
    members: [
      { name: 'Stephanie Nguyen', image: '/images/cabinet/stephanie_nguyen.jpg', year: 'Second Year Transfer', college: 'ERC College', major: 'Applied Math' },
      { name: 'Kirsten Ngo', image: '/images/cabinet/kirsten_ngo.jpg', year: 'Second Year', college: 'Revelle College', major: 'Human Biology' },
    ],
  },
  {
    title: 'Internal Vice President',
    count: 1,
    description: '',
    members: [
      { name: 'Mindy Tran', image: '/images/cabinet/mindy_tran.jpg', year: 'Second Year', college: 'Muir College', major: 'General Biology' },
    ],
  },
  {
    title: 'Secretary',
    count: 1,
    description: '',
    members: [
      { name: 'Martin Dang', image: '/images/cabinet/martin_dang.jpg', year: 'Second Year', college: 'Revelle College', major: 'Math-CS' },
    ],
  },
  {
    title: 'Treasurer',
    count: 1,
    description: '',
    members: [
      { name: 'Brandon Thach', image: '/images/cabinet/brandon_thach.jpg', year: 'First Year', college: 'Seventh College', major: 'Business Economics' },
    ],
  },
];

const generalBoard: Position[] = [
  { title: 'Co-Media Director', count: 2, description: '', members: [] },
  { title: 'Co-Events Chair', count: 2, description: '', members: [] },
  {
    title: 'VCN Director & Executive Producer',
    count: 2,
    description: '',
    members: [],
  },
  { title: 'Anh Chi Em Chair', count: 1, description: '', members: [] },
  { title: 'Fundraising Chair', count: 1, description: '', members: [] },
  { title: 'Community Relations Chair', count: 1, description: '', members: [] },
  { title: 'Culture & Philanthropy Chair', count: 1, description: '', members: [] },
  { title: 'Co-Historian', count: 2, description: '', members: [] },
];

export function Cabinet() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <PageTitle title="Cabinet" />
      
      <div className="space-y-12">
        {/* Executive Board Section */}
        <div className="bg-gray-800 shadow rounded-lg p-6">
          <h2 className="text-2xl font-bold text-white mb-8 text-center">Executive Board</h2>
          <div className="space-y-12">
            {executiveBoard.map((position, index) => (
              <div key={index} className="space-y-6">
                <h3 className="text-xl font-bold text-purple-400 text-center">{position.title}</h3>
                {position.description && (
                  <p className="text-gray-300 text-center max-w-2xl mx-auto">{position.description}</p>
                )}
                <div className={`grid ${position.count === 1 ? 'grid-cols-1 max-w-md mx-auto' : 'grid-cols-1 md:grid-cols-2'} gap-8`}>
                  {position.members.map((member, memberIndex) => (
                    <div key={memberIndex} className="bg-gray-700 rounded-lg p-6">
                      <div className="flex flex-col items-center space-y-4">
                        <div className="w-32 h-32 rounded-full bg-gray-600 flex items-center justify-center overflow-hidden">
                          {member.image ? (
                            <img src={member.image} alt={member.name} className="object-cover w-full h-full" />
                          ) : (
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
                              <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                            </svg>
                          )}
                        </div>
                        <div className="text-center">
                          <p className="text-lg font-medium text-white">{member.name}</p>
                          {member.year && <p className="text-sm text-gray-300">Year: {member.year}</p>}
                          {member.college && <p className="text-sm text-gray-300">College: {member.college}</p>}
                          {member.major && <p className="text-sm text-gray-300">Major: {member.major}</p>}
                          {member.minor && <p className="text-sm text-gray-300">Minor: {member.minor}</p>}
                          {member.pronouns && <p className="text-sm text-gray-300">Pronouns: {member.pronouns}</p>}
                          {member.favoriteSnack && <p className="text-sm text-gray-300">Favorite Snack: {member.favoriteSnack}</p>}
                          {member.funFact && <p className="text-sm text-gray-300">Fun Fact: {member.funFact}</p>}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* General Board Section */}
        <div className="bg-gray-800 shadow rounded-lg p-6">
          <h2 className="text-2xl font-bold text-white mb-8 text-center">General Board</h2>
          <div className="space-y-12">
            {generalBoard.map((position, index) => (
              <div key={index} className="space-y-6">
                <h3 className="text-xl font-bold text-purple-400 text-center">{position.title}</h3>
                {position.description && (
                  <p className="text-gray-300 text-center max-w-2xl mx-auto">{position.description}</p>
                )}
                <div className={`grid ${position.count === 1 ? 'grid-cols-1 max-w-md mx-auto' : 'grid-cols-1 md:grid-cols-2'} gap-8`}>
                  {Array.from({ length: position.count }).map((_, memberIndex) => (
                    <div key={memberIndex} className="bg-gray-700 rounded-lg p-6">
                      <div className="flex flex-col items-center space-y-4">
                        <div className="w-32 h-32 rounded-full bg-gray-600 flex items-center justify-center overflow-hidden">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                          </svg>
                        </div>
                        <div className="text-center">
                          <p className="text-lg font-medium text-white">Member Name</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
} 