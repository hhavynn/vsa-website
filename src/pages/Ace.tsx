import { PageTitle } from '../components/PageTitle';
import { RevealOnScrollWrapper } from '../components/RevealOnScrollWrapper';

export function Ace() {
  return (
    <RevealOnScrollWrapper>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <PageTitle title="ACE Program" />
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-6">ACE Program</h1>
        <p className="text-gray-700 dark:text-gray-300">ACE stands for our Anh Chi Em program and it's VSA's big-little program! Each year, prospective "littos" meet and match up with their future bigs. Pairings can then develop into a close friendship, similar to that of actual siblings within a prior "fam". ACE usually consists of families with various and unique "lineages". It's like your actual family away from home, with bigs, "pseudos", siblings, and grands!</p>
      </div>
    </RevealOnScrollWrapper>
  );
} 