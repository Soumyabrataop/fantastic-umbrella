"use client";

import { useAuth } from "@/hooks/useAuth";

export default function UserProfile() {
  const { user, loading, signOut } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center p-4">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="bg-white p-6 rounded-lg shadow-md">
      <h2 className="text-2xl font-bold mb-4">Welcome!</h2>

      <div className="space-y-2 mb-4">
        <p>
          <strong>Email:</strong> {user.email}
        </p>
        <p>
          <strong>User ID:</strong> {user.id}
        </p>
        <p>
          <strong>Created:</strong>{" "}
          {new Date(user.created_at).toLocaleDateString()}
        </p>
        <p>
          <strong>Last Sign In:</strong>{" "}
          {user.last_sign_in_at
            ? new Date(user.last_sign_in_at).toLocaleDateString()
            : "N/A"}
        </p>
      </div>

      <button
        onClick={() => signOut()}
        className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500"
      >
        Sign Out
      </button>
    </div>
  );
}
