import React, { FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

const socialLinks = [
  {
    label: 'Instagram',
    href: 'https://instagram.com/vsaatucsd',
    icon: <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" /></svg>,
  },
  {
    label: 'Discord',
    href: 'https://discord.gg/cSb6Q4gnW8',
    icon: <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4"><path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z" /></svg>,
  },
  {
    label: 'Facebook',
    href: 'https://facebook.com/ucsdvsa',
    icon: <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" /></svg>,
  },
];

const footerGroups = [
  {
    title: 'Navigate',
    links: [
      { label: 'Home', to: '/' },
      { label: 'Events', to: '/events' },
      { label: 'Cabinet', to: '/cabinet' },
      { label: 'Gallery', to: '/gallery' },
      { label: 'Leaderboard', to: '/leaderboard' },
    ],
  },
  {
    title: 'Programs',
    links: [
      { label: 'ACE', to: '/ace' },
      { label: 'House System', to: '/house-system' },
      { label: 'Intern Program', to: '/intern-program' },
      { label: 'VCN', to: '/vcn' },
      { label: "Wild n' Culture", to: '/wild-n-culture' },
    ],
  },
];

const Footer: React.FC = () => {
  const navigate = useNavigate();
  const [bugTitle, setBugTitle] = useState('');

  const handleBugReport = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const params = new URLSearchParams({ type: 'bug' });
    const title = bugTitle.trim();
    if (title) params.set('title', title);
    navigate(`/feedback?${params.toString()}`);
  };

  return (
    <footer className="border-t" style={{ borderColor: 'var(--border)', background: 'var(--bg2)' }}>
      <div className="vsa-container py-12 sm:py-14">
        <div className="grid gap-10 lg:grid-cols-[1.5fr_1fr_1fr_1fr]">
          <div>
            <div className="font-serif text-[22px]" style={{ color: 'var(--text)' }}>
              <span className="italic" style={{ color: 'var(--brand)' }}>VSA</span> at UCSD
            </div>
            <p className="mt-3 max-w-sm font-sans text-[13px] leading-[1.7]" style={{ color: 'var(--text3)' }}>
              Vietnamese Student Association at UC San Diego. Promoting and preserving Vietnamese culture since 1977. Open to all students.
            </p>
            <div className="mt-5 flex gap-2">
              {socialLinks.map((link) => (
                <a
                  key={link.label}
                  href={link.href}
                  target={link.href.startsWith('mailto') ? undefined : '_blank'}
                  rel={link.href.startsWith('mailto') ? undefined : 'noopener noreferrer'}
                  aria-label={link.label}
                  className="inline-flex h-[38px] w-[38px] items-center justify-center rounded-[10px] border text-[var(--text3)] transition-colors duration-150 hover:border-[var(--brand)] hover:text-[var(--brand)]"
                  style={{ borderColor: 'var(--border)' }}
                >
                  {link.icon}
                </a>
              ))}
            </div>
          </div>

          {footerGroups.map((group) => (
            <div key={group.title}>
              <div className="mb-4 font-sans text-[11px] font-bold uppercase tracking-[0.1em]" style={{ color: 'var(--text3)' }}>
                {group.title}
              </div>
              {group.links.map((link) => (
                <Link
                  key={link.to}
                  to={link.to}
                  className="mb-2.5 block font-sans text-[13.5px] text-[var(--text2)] transition-colors duration-150 hover:text-[var(--brand)]"
                >
                  {link.label}
                </Link>
              ))}
            </div>
          ))}

          <div>
            <div className="mb-4 font-sans text-[11px] font-bold uppercase tracking-[0.1em]" style={{ color: 'var(--text3)' }}>
              Connect
            </div>
            <a className="mb-2.5 block font-sans text-[13.5px] text-[var(--text2)] transition-colors duration-150 hover:text-[var(--brand)]" href="https://instagram.com/vsaatucsd" target="_blank" rel="noopener noreferrer">@vsaatucsd</a>
            <a className="mb-2.5 block font-sans text-[13.5px] text-[var(--text2)] transition-colors duration-150 hover:text-[var(--brand)]" href="https://discord.gg/cSb6Q4gnW8" target="_blank" rel="noopener noreferrer">Discord Server</a>
            <form onSubmit={handleBugReport} className="mt-5">
              <label htmlFor="footer-bug-title" className="mb-2 block font-sans text-[11px] font-bold uppercase tracking-[0.1em]" style={{ color: 'var(--text3)' }}>
                Bug Report
              </label>
              <div className="flex overflow-hidden rounded-lg border" style={{ borderColor: 'var(--border)' }}>
                <input
                  id="footer-bug-title"
                  value={bugTitle}
                  onChange={(event) => setBugTitle(event.target.value)}
                  placeholder="What broke?"
                  className="min-w-0 flex-1 bg-[var(--surface)] px-3 py-2 font-sans text-[13px] text-[var(--text)] outline-none placeholder:text-[var(--text3)]"
                />
                <button
                  type="submit"
                  className="shrink-0 bg-[var(--brand)] px-3 py-2 font-sans text-[12px] font-semibold text-[#f8fbfb] transition-opacity duration-150 hover:opacity-90"
                >
                  Report
                </button>
              </div>
            </form>
          </div>
        </div>

        <div className="mt-10 flex flex-col gap-3 border-t pt-6 sm:flex-row sm:items-center sm:justify-between" style={{ borderColor: 'var(--border)' }}>
          <span className="font-sans text-xs" style={{ color: 'var(--text3)' }}>
            Copyright {new Date().getFullYear()} VSA at UCSD. Est. 1977.
          </span>
          <div className="flex gap-5">
            <Link to="/feedback?type=bug" className="font-sans text-xs text-[var(--text3)] transition-colors duration-150 hover:text-[var(--brand)]">Bug Report</Link>
            <Link to="/feedback" className="font-sans text-xs text-[var(--text3)] transition-colors duration-150 hover:text-[var(--brand)]">Feedback</Link>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
