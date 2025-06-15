import { PageTitle } from '../components/PageTitle';
import { RevealOnScrollWrapper } from '../components/RevealOnScrollWrapper';

export function VCN() {
  return (
    <RevealOnScrollWrapper>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <PageTitle title="VCN" />
        <h1 className="text-3xl font-bold text-gray-950 dark:text-white mb-6">Vietnamese Culture Night (VCN)</h1>
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-md">
          <p className="text-gray-950 dark:text-gray-300 mb-4">
            UCSD VSA pays homage to Vietnamese culture with a unique performance consisting of a plethora of modern and traditional dances, as well as an amazing play that touches the traditions and attitudes of both Vietnamese and Vietnamese-American cultures!
          </p>
          <p className="text-gray-950 dark:text-gray-300 mb-4">
            Join UCSD VSA's biggest event in showcasing Vietnamese culture and learn what it really means to be a part of such a wonderful ethnic group. Everything is student-run; from the play to the dances, each step is meticulously drawn out to give our audience the most organic performance.
          </p>
          <p className="text-gray-950 dark:text-gray-300">
            It is fun for the whole family, and free to watch as well!
          </p>
        </div>
      </div>
    </RevealOnScrollWrapper>
  );
} 