import React from 'react';
import { FeedbackForm } from '../features/feedback/FeedbackForm';
import { useSiteSettings } from '../../context/SiteSettingsContext';

const socialLinks = [
  {
    label: 'Instagram', href: 'https://instagram.com/ucsdvsa',
    icon: <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg>,
  },
  {
    label: 'Discord', href: 'https://discord.gg/cSb6Q4gnW8',
    icon: <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/></svg>,
  },
  {
    label: 'Facebook', href: 'https://facebook.com/ucsdvsa',
    icon: <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>,
  },
  {
    label: 'Email', href: 'mailto:ucsdvsa@ucsd.edu',
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>,
  },
];

const Footer: React.FC = () => {
  const { settings } = useSiteSettings();

  return (
    <footer className="border-t mt-auto" style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}>
      <div className="mx-auto max-w-4xl px-5 py-8 sm:px-8 sm:py-10">
        <div className="flex flex-col items-center gap-6">

          <div className="text-center flex flex-col items-center gap-2">
            {settings.logoUrl ? (
              <img
                src={settings.logoUrl}
                alt={settings.logoAlt}
                className="h-14 w-14 rounded-full object-cover"
                style={{ border: '1px solid var(--color-border)' }}
              />
            ) : (
              <div
                className="h-14 w-14 rounded-full flex items-center justify-center font-sans text-sm font-semibold tracking-wide"
                style={{ background: 'var(--color-brand)', color: '#fff' }}
              >
                VSA
              </div>
            )}
            <p className="font-serif text-base text-[var(--color-text)] tracking-[-0.01em]">
              <em className="italic" style={{ color: 'var(--color-brand)' }}>VSA</em> at UCSD
            </p>
            <p className="font-sans text-xs text-[var(--color-text3)] -mt-1">Vietnamese Student Association · Est. 1977</p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-5">
            {socialLinks.map(link => (
              <a
                key={link.label}
                href={link.href}
                target={link.href.startsWith('mailto') ? undefined : '_blank'}
                rel="noopener noreferrer"
                aria-label={link.label}
                className="flex h-9 w-9 items-center justify-center rounded border text-[var(--color-text3)] transition-colors duration-150 hover:text-[var(--color-text2)]"
                style={{ borderColor: 'var(--color-border)' }}
              >
                {link.icon}
              </a>
            ))}
          </div>

          <div className="w-full max-w-md">
            <div className="rounded border p-5" style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface2)' }}>
              <h3 className="font-sans font-semibold text-[var(--color-text)] text-center text-sm mb-1">Send Feedback</h3>
              <p className="font-sans text-[var(--color-text3)] text-xs text-center mb-4">Help us improve — share thoughts or report issues.</p>
              <FeedbackForm />
            </div>
          </div>

          <p className="font-sans text-[11px] text-[var(--color-text3)]">
            © {new Date().getFullYear()} VSA at UCSD. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
