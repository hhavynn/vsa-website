import { Link } from 'react-router-dom';
import { memo } from 'react';

export const NavLogo = memo(function NavLogo() {
  return (
    <Link
      to="/"
      className="font-serif text-[17px] tracking-[-0.01em] text-[var(--color-text)] hover:opacity-80 transition-opacity duration-150 shrink-0"
    >
      <em className="not-italic italic text-brand-600 dark:text-brand-400">VSA</em>
      {' '}at UCSD
    </Link>
  );
});
