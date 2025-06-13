import { Link } from 'react-router-dom';
import { RevealOnScrollWrapper } from '../components/RevealOnScrollWrapper';

export function NotFound() {
  return (
    <RevealOnScrollWrapper>
      <div className="text-center">
        <h1 className="text-4xl font-bold mb-6">404</h1>
        <p className="text-xl text-gray-600 mb-8">Oops! The page you're looking for doesn't exist.</p>
        <Link
          to="/"
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
        >
          Go back home
        </Link>
      </div>
    </RevealOnScrollWrapper>
  );
} 