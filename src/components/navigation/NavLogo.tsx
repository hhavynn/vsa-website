import { Link } from 'react-router-dom';
import { memo } from 'react';

interface NavLogoProps {
  className?: string;
}

export const NavLogo = memo(function NavLogo({ className = '' }: NavLogoProps) {
  return (
    <Link to="/" className={`flex items-center ${className}`}>
      <img
        src="/images/vsa-logo.png"
        alt="VSA Logo"
        className="h-12 w-12 object-contain rounded-md shadow-md border-2 border-indigo-600 bg-white"
      />
    </Link>
  );
});
