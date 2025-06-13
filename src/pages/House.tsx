import { PageTitle } from '../components/PageTitle';
import { RevealOnScrollWrapper } from '../components/RevealOnScrollWrapper';

export function House() {
  return (
    <RevealOnScrollWrapper>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <PageTitle title="House System" />
        <h1 className="text-3xl font-bold text-white mb-6">House System</h1>
        <p className="text-gray-300">The House system was created to provide members a smaller sub-group within VSA to easily meet new people, attend more close-knit events, and create memories with newfound friends. House can be compared to UCSD's colleges or the Hogwarts houses but unlike the fams established within the ACE program, the Houses are changed every year allowing members to consistently meet new people and experience different events every time. Each House is guided by two House Parents who look over all the members within the House, as well as plan, communicate, and execute several quarterly events for the House members to attend. There are also opportunities for Houses to "collab" and host events with each other in order to create bonds with other Houses as well. Each House is also able to earn points by participating in VSA events such as attending GBMS, external events, etc. in order to claim the grand prize at the end of the year. House is an amazing opportunity for members to create lasting friendships and comfortably meet new people through smaller events, and we hope you all come out and join us for a year of fun and new memories! </p>
      </div>
    </RevealOnScrollWrapper>
  );
} 