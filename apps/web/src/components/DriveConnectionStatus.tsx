"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";

export default function DriveConnectionStatus() {
  const { user, session } = useAuth();
  const [driveConnected, setDriveConnected] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const checkDriveStatus = async () => {
      if (!user || !session) {
        setChecking(false);
        return;
      }

      try {
        const response = await fetch("/api/backend/auth/google/status", {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        });

        if (response.ok) {
          const data = await response.json();
          setDriveConnected(data.connected);
        }
      } catch (error) {
        console.error("Failed to check Drive status:", error);
      } finally {
        setChecking(false);
      }
    };

    checkDriveStatus();
  }, [user, session]);

  if (!user) return null;

  if (checking) {
    return (
      <div className="flex items-center gap-2 text-sm text-gray-600">
        <div className="animate-spin h-4 w-4 border-2 border-gray-300 border-t-blue-500 rounded-full"></div>
        <span>Checking Drive connection...</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 text-sm">
      {driveConnected ? (
        <>
          <div className="w-2 h-2 bg-green-500 rounded-full"></div>
          <span className="text-green-700">Google Drive connected</span>
        </>
      ) : (
        <>
          <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
          <span className="text-yellow-700">
            Google Drive not connected (re-login required)
          </span>
        </>
      )}
    </div>
  );
}
