import { PageTitle } from '../components/PageTitle';
import { RevealOnScrollWrapper } from '../components/RevealOnScrollWrapper';

export function Internship() {
  return (
    <RevealOnScrollWrapper>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <PageTitle title="Internship Program" />
        <h1 className="text-3xl font-bold text-white mb-6">Internship Program</h1>
        <p className="text-gray-300">Our internship program is designed for those with an interest in learning how VSA is run and the behind-the-scenes work that board members do. Through this internship, you will have the opportunity to develop leadership skills, communication skills, network and professionalism. You will also be working alongside other interns and board members and have the chance to contribute ideas that will impact the general member experience and help VSA grow as an organization. We hope for you to become the future of UCSD VSA!</p>
      </div>
    </RevealOnScrollWrapper>
  );
} 