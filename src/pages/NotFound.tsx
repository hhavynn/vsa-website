import { Link } from 'react-router-dom';
import { PageTitle } from '../components/common/PageTitle';

export function NotFound() {
  return (
    <>
      <PageTitle title="404" />
      <div className="min-h-[70vh] flex flex-col items-center justify-center px-4 text-center">
        <p className="font-serif leading-none tracking-[-0.04em] text-brand-600 dark:text-brand-400" style={{ fontSize: 120 }}>
          404
        </p>
        <h1 className="font-sans text-lg font-semibold tracking-[-0.01em] mt-2 mb-2" style={{ color: 'var(--color-text)' }}>
          Page not found
        </h1>
        <p className="font-sans text-sm mb-8 max-w-sm" style={{ color: 'var(--color-text2)' }}>
          The page you're looking for doesn't exist or has been moved.
        </p>
        <Link
          to="/"
          className="inline-flex items-center gap-2 font-sans text-sm font-medium px-5 py-2.5 rounded border border-brand-600 text-brand-600 hover:bg-brand-600 hover:text-white dark:border-brand-400 dark:text-brand-400 dark:hover:bg-brand-400 dark:hover:text-zinc-950 transition-colors duration-150"
        >
          Go home
        </Link>
      </div>
    </>
  );
}
