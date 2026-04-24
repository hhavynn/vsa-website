import { useState } from 'react';
import { Link } from 'react-router-dom';
import { PageTitle } from '../components/common/PageTitle';
import { Label } from '../components/ui/Label';

// ─────────────────────────────────────────────────────────────────────────────
// HOUSE PROGRAM CONFIG — Update this section each year.
// ─────────────────────────────────────────────────────────────────────────────

const APPLICATIONS_OPEN = false;
const APPLICATION_LINK = '';
const CYCLE_LABEL = '';

interface HouseData {
  name: string;
  meaning: string;
  color: string;
  trait: string;
  desc: string;
}

interface HouseParent {
  name: string;
  house: string;
  emoji: string;
  bio: string;
  photo?: string;
}

const HOUSES: HouseData[] = [
  { name: 'House Boo', meaning: 'Ghost', color: '#e2e8f0', trait: 'Sneaky & Spooky', desc: 'The house that lurks in the shadows — always watching, always ready. Strength lies in the element of surprise.' },
  { name: 'House Bowser', meaning: 'Koopa King', color: '#f97316', trait: 'Fierce & Mighty', desc: 'Bold, powerful, and unapologetically competitive. House Bowser comes to win every single time.' },
  { name: 'House Toad', meaning: 'Mushroom Retainer', color: '#ef4444', trait: 'Loyal & Cheerful', desc: 'Warm, welcoming, and endlessly enthusiastic. House Toad is the beating heart of every event.' },
  { name: 'House Donkey Kong', meaning: 'Jungle King', color: '#eab308', trait: 'Strong & Wild', desc: 'Raw energy, unstoppable momentum, and house pride that shakes the whole jungle.' },
];

const HOUSE_PARENTS: HouseParent[] = [
  // Example — replace with actual House Parents each year:
  // { name: 'First Last', house: 'House Boo', emoji: '👻', bio: 'Short bio here.' },
];

const steps = [
  { num: '01', title: 'Join the Program', desc: "Sign up when applications or sign-ups open each year. Check VSA's Instagram for the latest announcements." },
  { num: '02', title: 'Get Sorted', desc: 'You are placed into one of four houses. A house reveal kicks off the year and introduces you to your new community.' },
  { num: '03', title: 'Meet Your House', desc: 'Connect with your House Parents and fellow house members through socials, bonding events, and activities throughout the year.' },
  { num: '04', title: 'Earn Points & Compete', desc: "Show up, participate, and earn points for your house. The house with the most points at year's end wins a special reward." },
];

const eventTypes = [
  'House Reveal', 'Meet & Greet', 'Game Nights', 'Study Jams',
  'Beach Outings', 'Karaoke', 'House Dinners', 'DIY Activities',
  'Movie Nights', 'Inter-House Collabs', 'Competitions', 'End-of-Year Celebration',
];

const faqs = [
  { q: 'What is the House Program?', a: "The House Program is a year-long community experience within VSA. Members are placed into one of four houses and participate in socials, bonding activities, and VSA events to earn points and build friendships throughout the year." },
  { q: 'Do I need to already know people in VSA to join?', a: "Not at all. The program is specifically designed to help members meet new people and feel more connected — especially if you are newer to VSA or looking for a tighter-knit community within the organization." },
  { q: 'What kinds of events are part of the program?', a: 'Events vary by house and cycle but may include house reveals, meet-and-greets, bonding socials, study jams, beach outings, karaoke, DIY activities, movie nights, inter-house collaborations, and competitions.' },
  { q: 'What do House Parents do?', a: 'House Parents lead their house throughout the year. They plan socials and bonding activities, communicate with members, encourage participation, and help create a welcoming environment for everyone in the house.' },
  { q: 'Is there competition between houses?', a: 'Yes. Houses earn points through participation in events and activities across the year. At the end of the year, the house with the most points receives a special reward.' },
  { q: 'When do sign-ups or applications open?', a: "Sign-up timelines are announced at the start of each year through VSA's official channels. Follow @vsaatucsd on Instagram to stay up to date." },
];

export function House() {
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  return (
    <>
      <PageTitle title="House Program" />

      <div className="border-b" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)', padding: '36px 52px 28px' }}>
        <div className="flex items-center gap-2 mb-3">
          <Link to="/get-involved" className="font-sans text-xs" style={{ color: 'var(--color-text3)' }}>Get Involved</Link>
          <span className="font-sans text-xs" style={{ color: 'var(--color-text3)' }}>→</span>
          <span className="font-sans text-xs" style={{ color: 'var(--color-text2)' }}>House Program</span>
        </div>
        <h1 className="font-serif leading-none tracking-[-0.03em]" style={{ fontSize: 44, color: 'var(--color-text)' }}>House Program</h1>
        <p className="font-sans text-sm mt-2" style={{ color: 'var(--color-text2)' }}>
          Year-long community competition · UCSD VSA
          {APPLICATIONS_OPEN && CYCLE_LABEL && <span className="ml-3 font-sans text-[11px] font-semibold text-brand-600 dark:text-brand-400">Applications Open · {CYCLE_LABEL}</span>}
        </p>
      </div>

      <div style={{ padding: '40px 52px' }}>

        {/* CTA */}
        {APPLICATIONS_OPEN && APPLICATION_LINK && (
          <div className="border rounded p-5 mb-8 flex items-center justify-between" style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}>
            <div className="font-sans text-sm font-medium" style={{ color: 'var(--color-text)' }}>Applications are now open{CYCLE_LABEL ? ` · ${CYCLE_LABEL}` : ''}</div>
            <a href={APPLICATION_LINK} target="_blank" rel="noopener noreferrer" className="font-sans text-sm font-medium px-4 py-2 rounded border border-brand-600 text-brand-600 hover:bg-brand-600 hover:text-white dark:border-brand-400 dark:text-brand-400 dark:hover:bg-brand-400 dark:hover:text-zinc-950 transition-colors duration-150">
              Apply Now →
            </a>
          </div>
        )}

        {/* About */}
        <div className="mb-10">
          <Label className="mb-4">About the Program</Label>
          <p className="font-sans text-sm leading-[1.75]" style={{ color: 'var(--color-text2)', maxWidth: 640 }}>
            The House Program is a year-long community experience within VSA. Members are placed into one of four houses and participate in socials, bonding activities, and VSA events to earn points and build friendships. At the end of the year, the house with the most points wins.
          </p>
          <p className="font-sans text-sm leading-[1.75] mt-3" style={{ color: 'var(--color-text2)', maxWidth: 640 }}>
            Whether you're new to VSA or looking for a tighter-knit community within the organization, the House Program is built to help you connect and belong.
          </p>
        </div>

        {/* The Four Houses */}
        <div className="mb-10">
          <Label className="mb-4">The Four Houses</Label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 0 }}>
            {HOUSES.map((house, i) => (
              <div
                key={house.name}
                className="border-l px-5 pb-5"
                style={{ borderColor: 'var(--color-border)' }}
              >
                <div
                  className="w-3 h-3 rounded-full mb-3"
                  style={{ background: house.color }}
                />
                <div className="font-sans text-sm font-semibold mb-0.5" style={{ color: 'var(--color-text)' }}>{house.name}</div>
                <div className="font-sans text-[11px] mb-2" style={{ color: 'var(--color-text3)' }}>{house.trait}</div>
                <p className="font-sans text-xs leading-relaxed" style={{ color: 'var(--color-text2)' }}>{house.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* House Parents */}
        {HOUSE_PARENTS.length > 0 && (
          <div className="mb-10">
            <Label className="mb-4">House Parents</Label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0 24px' }}>
              {HOUSE_PARENTS.map(hp => (
                <div key={hp.name} className="border-t py-3" style={{ borderColor: 'var(--color-border)' }}>
                  <div className="font-sans text-sm font-semibold" style={{ color: 'var(--color-text)' }}>{hp.name}</div>
                  <div className="font-sans text-[11px] mt-0.5" style={{ color: 'var(--color-text3)' }}>{hp.house}</div>
                  {hp.bio && <p className="font-sans text-xs mt-1.5 leading-relaxed" style={{ color: 'var(--color-text2)' }}>{hp.bio}</p>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* How it works */}
        <div className="mb-10">
          <Label className="mb-4">How It Works</Label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 0 }}>
            {steps.map((step) => (
              <div key={step.num} className="border-l px-5 pb-4" style={{ borderColor: 'var(--color-border)' }}>
                <div className="font-serif leading-none mb-3" style={{ fontSize: 32, color: 'var(--color-text3)' }}>{step.num}</div>
                <div className="font-sans text-sm font-semibold mb-1.5" style={{ color: 'var(--color-text)' }}>{step.title}</div>
                <p className="font-sans text-xs leading-relaxed" style={{ color: 'var(--color-text2)' }}>{step.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Events */}
        <div className="mb-10">
          <Label className="mb-4">What You'll Do</Label>
          <div className="flex flex-wrap gap-2">
            {eventTypes.map(e => (
              <span key={e} className="font-sans text-xs border rounded-sm px-3 py-1.5" style={{ color: 'var(--color-text2)', borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}>{e}</span>
            ))}
          </div>
        </div>

        {/* FAQ */}
        <div className="mb-10">
          <Label className="mb-4">FAQ</Label>
          <div className="border rounded overflow-hidden" style={{ borderColor: 'var(--color-border)' }}>
            {faqs.map((faq, i) => (
              <div key={i} className="border-b last:border-b-0" style={{ borderColor: 'var(--color-border)' }}>
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full flex items-center justify-between text-left"
                  style={{ padding: '14px 20px', background: 'var(--color-surface)', border: 'none', cursor: 'pointer' }}
                >
                  <span className="font-sans text-sm font-medium" style={{ color: 'var(--color-text)' }}>{faq.q}</span>
                  <span style={{ color: 'var(--color-text3)', transform: openFaq === i ? 'rotate(45deg)' : 'none', transition: 'transform 0.2s', display: 'inline-block', fontSize: 18, marginLeft: 16, flexShrink: 0 }}>+</span>
                </button>
                {openFaq === i && (
                  <div className="border-t" style={{ padding: '12px 20px 16px', borderColor: 'var(--color-border)', background: 'var(--color-surface2)' }}>
                    <p className="font-sans text-sm leading-relaxed" style={{ color: 'var(--color-text2)' }}>{faq.a}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="border-t pt-6 flex gap-3" style={{ borderColor: 'var(--color-border)' }}>
          <a href="https://www.instagram.com/vsaatucsd/" target="_blank" rel="noopener noreferrer" className="font-sans text-sm font-medium px-4 py-2 rounded" style={{ background: 'var(--color-text)', color: 'var(--color-bg)', border: 'none' }}>
            Follow @vsaatucsd
          </a>
          <Link to="/get-involved" className="font-sans text-sm px-4 py-2 rounded border" style={{ color: 'var(--color-text2)', borderColor: 'var(--color-border)', background: 'transparent' }}>
            ← All Programs
          </Link>
        </div>

      </div>
    </>
  );
}
