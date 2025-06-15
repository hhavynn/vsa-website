import { PageTitle } from '../components/PageTitle';
import { RevealOnScrollWrapper } from '../components/RevealOnScrollWrapper';

export function WildNCulture() {
  return (
    <RevealOnScrollWrapper>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <PageTitle title="Wild n' Culture" />
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-6">Wild n' Culture</h1>
        <p className="text-gray-700 dark:text-gray-300 mb-6">
          Wild n' Culture is VSA's annual cultural showcase that combines traditional Vietnamese performances with modern entertainment. It's a night of celebration, learning, and fun for the whole community!
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-md">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Cultural Showcase</h2>
            <p className="text-gray-700 dark:text-gray-300">
              Experience a blend of traditional Vietnamese dances, modern performances, and cultural skits that highlight the rich heritage and contemporary vibrancy of Vietnamese culture.
            </p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-md">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Join the Fun</h2>
            <p className="text-gray-700 dark:text-gray-300">
              Whether you want to perform, help with production, or just enjoy the show, Wild n' Culture is open to everyone. Come be part of this amazing celebration of culture and community!
            </p>
          </div>
        </div>
      </div>
    </RevealOnScrollWrapper>
  );
}