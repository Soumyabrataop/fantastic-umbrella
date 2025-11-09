"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";

interface DriveConnectionStatus {
  is_connected: boolean;
  email: string | null;
}

export default function ConnectDrive() {
  const { user, session } = useAuth();
  const [driveStatus, setDriveStatus] = useState<DriveConnectionStatus | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    checkDriveStatus();

    // Check for successful connection from callback
    const params = new URLSearchParams(window.location.search);
    if (params.get("google_drive_connected") === "true") {
      // Remove query param
      window.history.replaceState({}, "", window.location.pathname);
      // Refresh status
      checkDriveStatus();
    }
  }, []);

  const checkDriveStatus = async () => {
    if (!session?.access_token) {
      setLoading(false);
      return;
    }

    try {
      // Use the Next.js dev proxy so the Authorization header is forwarded
      // to the backend. This allows the backend to associate the OAuth state
      // with the authenticated Supabase user.
      const proxyPath = `/api/backend/auth/google/status`;
      const response = await fetch(proxyPath, {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) throw new Error("Failed to check Drive status");

      const data = await response.json();
      setDriveStatus(data);
    } catch (err: any) {
      console.error("Drive status check error:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const connectDrive = async () => {
    if (!session?.access_token) {
      setError("You must be signed in to connect Google Drive.");
      return;
    }

    try {
      setLoading(true);
      const proxyPath = `/api/backend/auth/google/initiate`;
      const resp = await fetch(proxyPath, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "content-type": "application/json",
        },
      });

      if (!resp.ok) {
        const text = await resp.text();
        throw new Error(`Failed to initiate Drive connect: ${text}`);
      }

      const data = await resp.json();
      if (!data?.url) throw new Error("Invalid response from server");

      // Redirect the browser to Google's consent screen URL returned by the backend
      window.location.href = data.url;
    } catch (err: any) {
      console.error("Connect Drive error:", err);
      setError(err.message || "Failed to initiate Drive connection");
    } finally {
      setLoading(false);
    }
  };

  const disconnectDrive = async () => {
    if (!session?.access_token) return;

    try {
      setLoading(true);
      const proxyPath = `/api/backend/auth/google/disconnect`;
      const response = await fetch(proxyPath, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) throw new Error("Failed to disconnect Drive");

      await checkDriveStatus();
    } catch (err: any) {
      console.error("Disconnect error:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-800 rounded-lg">
        <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin"></div>
        <span className="text-sm text-gray-600 dark:text-gray-400">
          Checking Drive status...
        </span>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="w-full">
      {error && (
        <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <p className="text-red-600 dark:text-red-400 text-sm">{error}</p>
        </div>
      )}

      {driveStatus?.is_connected ? (
        <div className="flex items-center justify-between p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-100 dark:bg-green-800 rounded-full flex items-center justify-center">
              <svg
                className="w-5 h-5 text-green-600 dark:text-green-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
            <div>
              <p className="font-semibold text-green-900 dark:text-green-100">
                Google Drive Connected
              </p>
              <p className="text-sm text-green-700 dark:text-green-300">
                {driveStatus.email}
              </p>
            </div>
          </div>
          <button
            onClick={disconnectDrive}
            disabled={loading}
            className="px-4 py-2 text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg transition-colors disabled:opacity-50"
          >
            Disconnect
          </button>
        </div>
      ) : (
        <div className="p-6 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 border-2 border-dashed border-blue-200 dark:border-blue-800 rounded-xl">
          <div className="text-center">
            <div className="w-16 h-16 bg-blue-100 dark:bg-blue-800 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M6.5 12L0 20h6.5V12z"
                />
                <path
                  fill="#FBBC05"
                  d="M6.5 4L0 12h6.5V4z"
                />
                <path
                  fill="#34A853"
                  d="M12 4l6.5 8L12 20V4z"
                />
                <path
                  fill="#EA4335"
                  d="M18.5 12L12 4h12l-5.5 8z"
                />
                <path
                  fill="#4285F4"
                  d="M18.5 12L12 20h12l-5.5-8z"
                />
              </svg>
            </div>
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
              Connect Your Google Drive
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              Your videos will be stored securely in your own Google Drive.
              <br />
              You'll have full control over your content.
            </p>
            <button
              onClick={connectDrive}
              disabled={loading}
              className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-colors shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path
                  fill="currentColor"
                  d="M6.5 12L0 20h6.5V12z"
                />
                <path
                  fill="currentColor"
                  d="M6.5 4L0 12h6.5V4z"
                />
                <path
                  fill="currentColor"
                  d="M12 4l6.5 8L12 20V4z"
                />
              </svg>
              <span>Connect Google Drive</span>
            </button>
            <p className="mt-3 text-xs text-gray-500 dark:text-gray-500">
              We'll only access files created by InstaVEO
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
