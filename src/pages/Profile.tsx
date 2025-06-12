import { useAuth } from '../hooks/useAuth';

export function Profile() {
  const { user } = useAuth();

  if (!user) {
    return (
      <div className="text-center">
        <h1 className="text-4xl font-bold mb-6">Profile</h1>
        <p className="text-gray-600">Please sign in to view your profile.</p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-4xl font-bold mb-6">Profile</h1>
      <div className="bg-white shadow rounded-lg p-6">
        <div className="space-y-4">
          <div>
            <h2 className="text-lg font-medium text-gray-900">Email</h2>
            <p className="mt-1 text-gray-600">{user.email}</p>
          </div>
          <div>
            <h2 className="text-lg font-medium text-gray-900">User ID</h2>
            <p className="mt-1 text-gray-600">{user.id}</p>
          </div>
        </div>
      </div>
    </div>
  );
} 