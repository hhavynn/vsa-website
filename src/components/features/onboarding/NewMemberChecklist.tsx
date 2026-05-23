import React from 'react';
import { Link } from 'react-router-dom';
import { cn } from '../../../lib/utils';

interface ChecklistItemProps {
  title: string;
  description: string;
  link: string;
  isExternal?: boolean;
  completed?: boolean;
}

function ChecklistItem({ title, description, link, isExternal, completed }: ChecklistItemProps) {
  const content = (
    <div className="group flex items-start gap-4 p-4 transition-colors duration-150 hover:bg-[var(--surface2)]">
      <div className={cn(
        "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
        completed ? "border-green-500 bg-green-500 text-white" : "border-[var(--border)] group-hover:border-[var(--brand)]"
      )}>
        {completed ? (
          <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
          </svg>
        ) : (
          <div className="h-2 w-2 rounded-full bg-transparent group-hover:bg-[var(--brand)]" />
        )}
      </div>
      <div className="min-w-0">
        <h4 className="font-sans text-[15px] font-semibold leading-tight group-hover:text-[var(--brand)]" style={{ color: 'var(--text)' }}>
          {title}
        </h4>
        <p className="mt-1 font-sans text-xs leading-relaxed" style={{ color: 'var(--text3)' }}>
          {description}
        </p>
      </div>
    </div>
  );

  if (isExternal) {
    return (
      <a href={link} target="_blank" rel="noopener noreferrer" className="block border-b last:border-0" style={{ borderColor: 'var(--border)' }}>
        {content}
      </a>
    );
  }

  return (
    <Link to={link} className="block border-b last:border-0" style={{ borderColor: 'var(--border)' }}>
      {content}
    </Link>
  );
}

export function NewMemberChecklist() {
  const items = [
    {
      title: 'Attend an Event',
      description: 'Check our calendar for upcoming GBMs, socials, and more.',
      link: '/events',
    },
    {
      title: 'Join the House System',
      description: 'Find your smaller community within VSA and compete for the House Cup.',
      link: '/house-system',
    },
    {
      title: 'Sign up for ACE',
      description: 'Get paired with a mentor (Anh) or mentee (Em) in our lineage program.',
      link: '/ace',
    },
    {
      title: 'Check the Leaderboard',
      description: 'See how points work and track your journey as a VSA member.',
      link: '/leaderboard',
    },
    {
      title: 'Explore the Intern Program',
      description: 'Shadow the cabinet and build leadership skills from the inside.',
      link: '/intern-program',
    },
    {
      title: 'Discover VCN & WNC',
      description: 'Learn about our culture show and collegiate comedy night.',
      link: '/vcn',
    },
    {
      title: 'Connect on Discord',
      description: 'Join our server to chat with other members and get live updates.',
      link: 'https://discord.gg/cSb6Q4gnW8',
      isExternal: true,
    },
    {
      title: 'Submit Feedback',
      description: 'Have a question or suggestion? We want to hear from you!',
      link: '/feedback',
    },
  ];

  return (
    <div className="vsa-animate-slide-up scrapbook-paper relative overflow-hidden p-0">
      <div className="bg-[var(--brand)] px-6 py-4">
        <div className="flex items-center justify-between">
          <h3 className="font-serif text-xl text-[#f8fbfb]">
            New Member <span className="italic">Checklist</span>
          </h3>
          <span className="scrapbook-sticker scrapbook-sticker-gold">Passport</span>
        </div>
      </div>
      
      <div className="flex flex-col">
        {items.map((item) => (
          <ChecklistItem key={item.link} {...item} />
        ))}
      </div>

      <div className="bg-[var(--surface2)] px-6 py-4 text-center">
        <p className="font-sans text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text3)' }}>
          Welcome to the Family
        </p>
      </div>
      <span className="scrapbook-pin" aria-hidden />
    </div>
  );
}
