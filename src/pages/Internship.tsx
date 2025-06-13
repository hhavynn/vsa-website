import { PageTitle } from '../components/PageTitle';
import { RevealOnScrollWrapper } from '../components/RevealOnScrollWrapper';

export function Internship() {
  return (
    <RevealOnScrollWrapper>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <PageTitle title="Internship Program" />
        <h1 className="text-3xl font-bold text-white mb-6">Internship Program</h1>
        <p className="text-gray-300">More details about the VSA Internship Program coming soon!</p>
      </div>
    </RevealOnScrollWrapper>
  );
} 