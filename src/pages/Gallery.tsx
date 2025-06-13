import { PageTitle } from '../components/PageTitle';
import { RevealOnScrollWrapper } from '../components/RevealOnScrollWrapper';

export function Gallery() {
  return (
    <RevealOnScrollWrapper>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <PageTitle title="Gallery" />
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-6">Our Gallery</h1>
        <p className="text-gray-700 dark:text-gray-300">Welcome to the VSA Gallery! Content coming soon.</p>
      </div>
    </RevealOnScrollWrapper>
  );
} 