import { Link } from 'react-router-dom';
import { memo, useState } from 'react';

interface NavLogoProps {
  className?: string;
}

export const NavLogo = memo(function NavLogo({ className = '' }: NavLogoProps) {
  const [imageError, setImageError] = useState(false);
  const [currentSrc, setCurrentSrc] = useState('/images/vsa-logo.svg');

  const handleImageError = () => {
    if (currentSrc === '/images/vsa-logo.svg') {
      setCurrentSrc('/images/vsa-logo.jpg');
    } else if (currentSrc === '/images/vsa-logo.jpg') {
      setCurrentSrc('/images/vsa-logo.png');
    } else {
      setImageError(true);
    }
  };

  return (
    <Link to="/" className={`flex items-center ${className}`}>
      {!imageError ? (
        <img
          src={currentSrc}
          alt="VSA Logo"
          className="h-12 w-12 object-contain rounded-md shadow-md border-2 border-indigo-600 bg-white"
          onError={handleImageError}
          loading="lazy"
        />
      ) : (
        <div className="h-12 w-12 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-md flex items-center justify-center text-white font-bold text-lg shadow-md">
          VSA
        </div>
      )}
    </Link>
  );
});
