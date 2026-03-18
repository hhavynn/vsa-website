import { Link } from 'react-router-dom';
import { memo, useState } from 'react';

interface NavLogoProps {
  className?: string;
}

const publicUrl = process.env.PUBLIC_URL || '';
const logoSources = [
  `${publicUrl}/images/vsa-logo.png`,
  `${publicUrl}/images/vsa-logo.jpg`,
];

export const NavLogo = memo(function NavLogo({ className = '' }: NavLogoProps) {
  const [imageError, setImageError] = useState(false);
  const [currentSrcIndex, setCurrentSrcIndex] = useState(0);

  const handleImageError = () => {
    if (currentSrcIndex < logoSources.length - 1) {
      setCurrentSrcIndex((prev) => prev + 1);
    } else {
      setImageError(true);
    }
  };

  return (
    <Link to="/" className={`flex items-center gap-2.5 group ${className}`}>
      {!imageError ? (
        <img
          src={logoSources[currentSrcIndex]}
          alt="VSA Logo"
          className="h-8 w-8 object-contain rounded border border-zinc-700 bg-zinc-900 group-hover:border-zinc-600 transition-colors duration-150"
          onError={handleImageError}
          loading="eager"
        />
      ) : (
        <div className="h-8 w-8 rounded border border-zinc-700 bg-brand-600 flex items-center justify-center text-white font-bold text-xs">
          VSA
        </div>
      )}
      <span className="font-sans font-semibold text-white text-sm tracking-tight hidden lg:block">
        VSA at UCSD
      </span>
    </Link>
  );
});
