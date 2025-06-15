import { PageTitle } from '../components/PageTitle';
import { RevealOnScrollWrapper } from '../components/RevealOnScrollWrapper';

interface Program {
  title: string;
  description: string;
  image: string;
  link: string;
}

const programs: Program[] = [
  {
    title: 'ANH CHỊ EM',
    description: 'ACE stands for our Anh Chi Em program and it\'s VSA\'s big-little program! Each year, prospective "littos" meet and match up with their future bigs.',
    image: '/images/get-involved/ace.jpg',
    link: '/ace',
  },
  {
    title: 'HOUSE PROGRAM',
    description: 'The House system was created to provide members a smaller sub-group within VSA to easily meet new people, attend more close-knit events, and create memories with newfound friends.',
    image: '/images/get-involved/house.jpg',
    link: '/house-system',
  },
  {
    title: 'INTERN PROGRAM',
    description: 'Our internship program is designed for those with an interest in learning how VSA is run and the behind-the-scenes work that board members do.',
    image: '/images/get-involved/intern.jpg',
    link: '/intern-program',
  },
];

export function GetInvolved() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <PageTitle title="Get Involved" />
      
      <RevealOnScrollWrapper>
        <div className="space-y-12">
          {programs.map((program, index) => (
            <div key={index} className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
              <div className={`flex flex-col md:flex-row ${index % 2 === 1 ? 'md:flex-row-reverse' : ''} items-center md:items-start space-y-6 md:space-y-0 md:space-x-8`}>
                <div className="w-full md:w-1/2 flex justify-center items-center">
                  <img src={program.image} alt={program.title} className="rounded-lg shadow-md object-cover w-full h-64 md:h-auto" />
                </div>
                <div className="w-full md:w-1/2 text-center md:text-left space-y-4">
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-white">{program.title}</h2>
                  <p className="text-gray-700 dark:text-gray-300">{program.description}</p>
                  <a href={program.link} className="inline-block px-4 py-2 bg-purple-600 text-white font-semibold rounded-md hover:bg-purple-700 transition-colors duration-200">
                    LEARN MORE
                  </a>
                </div>
              </div>
            </div>
          ))}
        </div>
      </RevealOnScrollWrapper>
    </div>
  );
} 