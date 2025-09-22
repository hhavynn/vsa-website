import { Link } from 'react-router-dom';
import { memo, useState } from 'react';

interface NavLogoProps {
  className?: string;
}

export const NavLogo = memo(function NavLogo({ className = '' }: NavLogoProps) {
  const [imageError, setImageError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const handleImageError = () => {
    setImageError(true);
    setIsLoading(false);
  };

  const handleImageLoad = () => {
    setIsLoading(false);
  };

  return (
    <Link to="/" className={`flex items-center ${className}`}>
      {isLoading && (
        <div className="h-12 w-12 bg-gray-200 rounded-md animate-pulse flex items-center justify-center">
          <span className="text-xs text-gray-500">VSA</span>
        </div>
      )}
      {!imageError ? (
        <img
          src="/images/vsa-logo.jpg"
          alt="VSA Logo"
          className={`h-12 w-12 object-contain rounded-md shadow-md border-2 border-indigo-600 bg-white ${isLoading ? 'hidden' : ''}`}
          onError={handleImageError}
          onLoad={handleImageLoad}
        />
      ) : (
        <div className="h-12 w-12 bg-indigo-600 rounded-md flex items-center justify-center text-white font-bold text-lg">
          VSA
        </div>
      )}
    </Link>
  );
});
