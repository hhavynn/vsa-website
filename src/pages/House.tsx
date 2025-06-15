import { PageTitle } from '../components/PageTitle';
import { RevealOnScrollWrapper } from '../components/RevealOnScrollWrapper';

export function House() {
  return (
    <RevealOnScrollWrapper>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <PageTitle title="House System" />
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-6">House System</h1>
        <p className="text-gray-700 dark:text-gray-300 mb-6">
          The House System is a way to foster friendly competition and camaraderie among VSA members. Members are sorted into one of four houses at the beginning of each semester, and houses compete for points through various activities and events.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-md">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">House Points</h2>
            <p className="text-gray-700 dark:text-gray-300">
              Points are awarded for participation in events, winning competitions, and contributing to the VSA community. The house with the most points at the end of the semester wins the House Cup!
            </p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-md">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">House Events</h2>
            <p className="text-gray-700 dark:text-gray-300">
              Each house hosts special events throughout the semester, including social gatherings, community service projects, and friendly competitions with other houses.
            </p>
          </div>
        </div>
      </div>
    </RevealOnScrollWrapper>
  );
} 