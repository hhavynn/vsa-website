import { useEffect, useMemo, useState } from 'react';

interface OptimizedImageProps {
  src: string;
  alt: string;
  className?: string;
  imgClassName?: string;
  sizes?: string;
  loading?: 'lazy' | 'eager';
  fallbackSrc?: string;
}

export function OptimizedImage({
  src,
  alt,
  className = '',
  imgClassName = '',
  sizes = '100vw',
  loading = 'lazy',
  fallbackSrc
}: OptimizedImageProps) {
  const [currentSrc, setCurrentSrc] = useState(() => src || fallbackSrc || '');
  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    setCurrentSrc(src || fallbackSrc || '');
  }, [src, fallbackSrc]);

  const resolvedSrcSet = useMemo(() => {
    if (!currentSrc) {
      return undefined;
    }

    const separator = currentSrc.includes('?') ? '&' : '?';
    const widths = [400, 800, 1200];

    return widths
      .map((width) => `${currentSrc}${separator}w=${width} ${width}w`)
      .join(', ');
  }, [currentSrc]);

  useEffect(() => {
    if (!currentSrc) {
      setError(true);
      return;
    }

    setIsLoaded(false);
    setError(false);

    const img = new Image();
    img.onload = () => setIsLoaded(true);
    img.onerror = () => {
      if (fallbackSrc && currentSrc !== fallbackSrc) {
        setCurrentSrc(fallbackSrc);
      } else {
        setError(true);
      }
    };
    img.src = currentSrc;

    return () => {
      img.onload = null;
      img.onerror = null;
    };
  }, [currentSrc, fallbackSrc]);

  if (error) {
    return (
      <div className={`bg-gray-800 flex items-center justify-center ${className}`}>
        <span className="text-gray-400">Failed to load image</span>
      </div>
    );
  }

  return (
    <div className={`relative ${className}`}>
      {!isLoaded && (
        <div className="absolute inset-0 bg-gray-800 animate-pulse" />
      )}
      <img
        src={currentSrc}
        alt={alt}
        loading={loading}
        className={`w-full h-full object-cover transition-opacity duration-300 ${
          isLoaded ? 'opacity-100' : 'opacity-0'
        } ${imgClassName}`}
        sizes={sizes}
        srcSet={resolvedSrcSet}
      />
    </div>
  );
}
