import { useAuth } from '../hooks/useAuth';

export function Profile() {
  const { user } = useAuth();

  if (!user) {
    return <div>Please sign in to view your profile.</div>;
  }

  return (
    <div>
      <h1 className="text-3xl font-bold mb-6">Profile</h1>
      <div className="bg-white shadow rounded-lg p-6">
        <p><strong>Email:</strong> {user.email}</p>
        <p><strong>User ID:</strong> {user.id}</p>
      </div>
    </div>
  );
} 