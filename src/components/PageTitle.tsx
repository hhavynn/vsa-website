import { useEffect } from 'react';

interface PageTitleProps {
  title: string;
}

export function PageTitle({ title }: PageTitleProps) {
  useEffect(() => {
    document.title = `VSA - ${title}`;
    return () => {
      document.title = 'VSA';
    };
  }, [title]);

  return null;
} 