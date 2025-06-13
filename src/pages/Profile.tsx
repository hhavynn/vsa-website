import { useAuth } from '../hooks/useAuth';
import { usePointsContext } from '../context/PointsContext';
import { Navigate } from 'react-router-dom';

export function Profile() {
  const { user } = useAuth();
  const { points, loading: pointsLoading } = usePointsContext();

  if (!user) {
    return <Navigate to="/" />;
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="bg-white shadow rounded-lg p-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Profile</h1>
        
        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <span className="text-lg font-medium text-gray-700">Points</span>
            {pointsLoading ? (
              <div className="flex items-center">
                <svg className="animate-spin h-5 w-5 mr-2 text-purple-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span className="text-gray-500">Loading...</span>
              </div>
            ) : (
              <span className="text-2xl font-bold text-purple-600">{points}</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
} 