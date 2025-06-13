import { PageTitle } from '../components/PageTitle';
import { RevealOnScrollWrapper } from '../components/RevealOnScrollWrapper';

export function Vcn() {
  return (
    <RevealOnScrollWrapper>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <PageTitle title="VCN" />
        <h1 className="text-3xl font-bold text-white mb-6">Vietnamese Culture Night (VCN)</h1>
        <p className="text-gray-300">Details about Vietnamese Culture Night (VCN) coming soon!</p>
      </div>
    </RevealOnScrollWrapper>
  );
} 