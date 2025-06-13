import { PageTitle } from '../components/PageTitle';
import { RevealOnScrollWrapper } from '../components/RevealOnScrollWrapper';

export function Vcn() {
  return (
    <RevealOnScrollWrapper>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <PageTitle title="VCN" />
        <h1 className="text-3xl font-bold text-white mb-6">Vietnamese Culture Night (VCN)</h1>
        <p className="text-gray-300">UCSD VSA pays homage to Vietnamese culture with a unique performance consisting of a plethora of modern and traditional dances, as well as an amazing play that touches the traditions and attitudes of both Vietnamese and Vietnamese-American cultures! Join UCSD VSA's biggest event in showcasing Vietnamese culture and learn what it really means to be a part of such a wonderful ethnic group. Everything is student-run; from the play to the dances, each step is meticulously drawn out to give our audience the most organic performance. It is fun for the whole family, and free to watch as well!</p>
      </div>
    </RevealOnScrollWrapper>
  );
} 