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
          className="h-9 w-9 object-contain rounded-lg border border-indigo-500/30 bg-slate-900 shadow-glow-sm group-hover:border-indigo-400/60 transition-all duration-200"
          onError={handleImageError}
          loading="eager"
        />
      ) : (
        <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-indigo-600 to-violet-600 flex items-center justify-center text-white font-bold text-sm shadow-glow-sm">
          VSA
        </div>
      )}
      <span className="font-heading font-bold text-white text-base hidden lg:block">
        VSA at UCSD
      </span>
    </Link>
  );
});
