import { PageTitle } from '../components/common/PageTitle';
import { RevealOnScrollWrapper } from '../components/common/RevealOnScrollWrapper';
import { useState } from 'react';

interface Position {
  title: string;
  count: number;
  description: string;
  members: Array<{
    name: string;
    image?: string;
    year?: string;
    college?: string;
    major?: string;
    minor?: string;
    pronouns?: string;
    favoriteSnack?: string;
    funFact?: string;
  }>;
}

const publicUrl = process.env.PUBLIC_URL || '';
const cabinetImage = (fileName: string) => `${publicUrl}/images/cabinet/${fileName}`;

function CabinetPhoto({ image, name }: { image?: string; name: string }) {
  const [hasError, setHasError] = useState(false);

  if (!image || hasError) {
    return (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
      </svg>
    );
  }

  return (
    <img
      src={image}
      alt={name}
      className="object-cover w-full h-full"
      loading="lazy"
      onError={() => setHasError(true)}
    />
  );
}

const executiveBoard: Position[] = [
  {
    title: 'Co-President',
    count: 2,
    description: '',
    members: [
      { name: 'Gracie Nguyen', image: cabinetImage('gracie_nguyen.png'), year: 'Second Year', college: 'Marshall College', major: 'General Biology' },
      { name: 'Phuong Le', image: cabinetImage('phuong_le.png'), year: 'Second Year', college: 'Muir College', major: 'Political Science - International Relations' },
    ],
  },
  {
    title: 'Co-Intercollegiate Council',
    count: 2,
    description: '',
    members: [
      { name: 'Stephanie Nguyen', year: 'Second Year Transfer', college: 'ERC College', major: 'Applied Math' },
      { name: 'Kirsten Ngo', image: cabinetImage('kirsten_ngo.png'), year: 'Second Year', college: 'Revelle College', major: 'Human Biology' },
    ],
  },
  {
    title: 'Internal Vice President',
    count: 1,
    description: '',
    members: [
      { name: 'Mindy Tran', image: cabinetImage('mindy_tran.png'), year: 'Second Year', college: 'Muir College', major: 'General Biology' },
    ],
  },
  {
    title: 'Secretary',
    count: 1,
    description: '',
    members: [
      { name: 'Martin Dang', image: cabinetImage('martin_dang.png'), year: 'Second Year', college: 'Revelle College', major: 'Math-CS' },
    ],
  },
  {
    title: 'Treasurer',
    count: 1,
    description: '',
    members: [
      { name: 'Brandon Thach', image: cabinetImage('brandon_thach.png'), year: 'First Year', college: 'Seventh College', major: 'Business Economics' },
    ],
  },
];

const generalBoard: Position[] = [
  {
    title: 'Co-Media Director',
    count: 2,
    description: '',
    members: [
      { name: 'Asia Martin', year: 'Second Year Transfer', college: 'Sixth College', major: 'Human Biology' },
      { name: 'Anne Fa', year: 'First Year', college: 'Seventh College', major: 'Business Economics' },
    ],
  },
  {
    title: 'Co-Events Chair',
    count: 2,
    description: '',
    members: [
      { name: 'Amy Nguyen', image: cabinetImage('amy_nguyen.png'), year: 'First Year', college: 'Marshall College', major: 'Human Development' },
      { name: 'Havyn Nguyen', image: cabinetImage('havyn_nguyen.png'), year: 'Second Year', college: 'Sixth College', major: 'Math-CS' },
    ],
  },
  {
    title: 'VCN Director & Executive Producer',
    count: 2,
    description: '',
    members: [
      { name: 'Jonas Truong', image: cabinetImage('jonas_truong.png'), year: 'First Year', college: 'Seventh College', major: 'Political Science - Public Law' },
      { name: 'Robert Le', image: cabinetImage('robert_le.png'), year: 'Second Year', college: 'Seventh College', major: 'Structural Engineering' },
    ],
  },
  {
    title: 'Anh Chi Em Chair',
    count: 1,
    description: '',
    members: [
      { name: 'April Pham', image: cabinetImage('april_pham.png'), year: 'Second Year', college: 'Eighth College', major: 'Molecular & Cell Biology' },
    ],
  },
  {
    title: 'Fundraising Chair',
    count: 1,
    description: '',
    members: [
      { name: 'Kayla Truong', year: 'First Year', college: 'Muir College', major: 'Cognitive Science' },
    ],
  },
  {
    title: 'Community Relations Chair',
    count: 1,
    description: '',
    members: [
      { name: 'Ingyin Moh', image: cabinetImage('ingyin_moh.png'), year: 'Second Year', college: 'Muir College', major: 'Public Health' },
    ],
  },
  {
    title: 'Culture & Philanthropy Chair',
    count: 1,
    description: '',
    members: [
      { name: 'Abby Le', image: cabinetImage('abby_le.png'), year: 'First Year', college: 'Seventh College', major: 'Business Economics' },
    ],
  },
  {
    title: 'Co-Historian',
    count: 2,
    description: '',
    members: [
      { name: 'Andy Tran', image: cabinetImage('andy_tran.png'), year: 'First Year', college: 'Seventh College', major: 'Human Biology' },
      { name: 'Faith Nguyen', year: 'First Year', college: 'Seventh College', major: 'Business Psychology' },
    ],
  },
];

export function Cabinet() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <PageTitle title="Cabinet" />

      <div className="w-full bg-purple-600 text-white text-center py-6 rounded-lg shadow-lg mb-8 transform transition-transform duration-1000 ease-out animate-slideUp">
        <h1 className="text-4xl font-bold">Introducing: Mi Xao Moggers</h1>
      </div>

      <div className="space-y-12">
        {/* Executive Board Section */}
        <RevealOnScrollWrapper>
          <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
            <h2 className="text-2xl font-bold text-purple-600 dark:text-purple-400 text-center mb-8">Executive Board</h2>
            <div className="space-y-12">
              {executiveBoard.map((position, index) => (
                <div key={index} className="space-y-6">
                  <h3 className="text-xl font-bold text-purple-600 dark:text-purple-400 text-center">{position.title}</h3>
                  {position.description && (
                    <p className="text-gray-700 dark:text-gray-300 text-center max-w-2xl mx-auto">{position.description}</p>
                  )}
                  <div className={`grid ${position.count === 1 ? 'grid-cols-1 max-w-md mx-auto' : 'grid-cols-1 md:grid-cols-2'} gap-8`}>
                    {position.members.map((member, memberIndex) => (
                      <div key={memberIndex} className="bg-gray-50 dark:bg-gray-700 rounded-lg p-6">
                        <div className="flex flex-col items-center space-y-4">
                          <div className="w-32 h-32 rounded-full bg-gray-200 dark:bg-gray-600 flex items-center justify-center overflow-hidden">
                            <CabinetPhoto image={member.image} name={member.name} />
                          </div>
                          <div className="text-center">
                            <p className="text-lg font-medium text-gray-900 dark:text-white">{member.name}</p>
                            {member.year && <p className="text-sm text-gray-600 dark:text-gray-300">Year: {member.year}</p>}
                            {member.college && <p className="text-sm text-gray-600 dark:text-gray-300">College: {member.college}</p>}
                            {member.major && <p className="text-sm text-gray-600 dark:text-gray-300">Major: {member.major}</p>}
                            {member.minor && <p className="text-sm text-gray-600 dark:text-gray-300">Minor: {member.minor}</p>}
                            {member.pronouns && <p className="text-sm text-gray-600 dark:text-gray-300">Pronouns: {member.pronouns}</p>}
                            {member.favoriteSnack && <p className="text-sm text-gray-600 dark:text-gray-300">Favorite Snack: {member.favoriteSnack}</p>}
                            {member.funFact && <p className="text-sm text-gray-600 dark:text-gray-300">Fun Fact: {member.funFact}</p>}
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

        {/* General Board Section */}
        <RevealOnScrollWrapper>
          <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
            <h2 className="text-2xl font-bold text-purple-600 dark:text-purple-400 text-center mb-8">General Board</h2>
            <div className="space-y-12">
              {generalBoard.map((position, index) => (
                <div key={index} className="space-y-6">
                  <h3 className="text-xl font-bold text-purple-600 dark:text-purple-400 text-center">{position.title}</h3>
                  {position.description && (
                    <p className="text-gray-700 dark:text-gray-300 text-center max-w-2xl mx-auto">{position.description}</p>
                  )}
                  <div className={`grid ${position.count === 1 ? 'grid-cols-1 max-w-md mx-auto' : 'grid-cols-1 md:grid-cols-2'} gap-8`}>
                    {position.members.map((member, memberIndex) => (
                      <div key={memberIndex} className="bg-gray-50 dark:bg-gray-700 rounded-lg p-6">
                        <div className="flex flex-col items-center space-y-4">
                          <div className="w-32 h-32 rounded-full bg-gray-200 dark:bg-gray-600 flex items-center justify-center overflow-hidden">
                            <CabinetPhoto image={member.image} name={member.name} />
                          </div>
                          <div className="text-center">
                            <p className="text-lg font-medium text-gray-900 dark:text-white">{member.name}</p>
                            {member.year && <p className="text-sm text-gray-600 dark:text-gray-300">Year: {member.year}</p>}
                            {member.college && <p className="text-sm text-gray-600 dark:text-gray-300">College: {member.college}</p>}
                            {member.major && <p className="text-sm text-gray-600 dark:text-gray-300">Major: {member.major}</p>}
                            {member.minor && <p className="text-sm text-gray-600 dark:text-gray-300">Minor: {member.minor}</p>}
                            {member.pronouns && <p className="text-sm text-gray-600 dark:text-gray-300">Pronouns: {member.pronouns}</p>}
                            {member.favoriteSnack && <p className="text-sm text-gray-600 dark:text-gray-300">Favorite Snack: {member.favoriteSnack}</p>}
                            {member.funFact && <p className="text-sm text-gray-600 dark:text-gray-300">Fun Fact: {member.funFact}</p>}
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
      </div>
    </div>
  );
}
