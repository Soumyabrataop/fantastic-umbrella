"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function AuthCallbackPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleCallback = async () => {
      try {
        // Check for errors in URL params first
        const params = new URLSearchParams(window.location.search);
        const errorParam = params.get("error");
        const errorDescription = params.get("error_description");

        if (errorParam) {
          throw new Error(errorDescription || errorParam);
        }

        // Supabase automatically handles the OAuth callback with detectSessionInUrl: true
        // Wait for session to be established
        await new Promise((resolve) => setTimeout(resolve, 1000));

        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (session) {
          // Successful login - redirect to profile
          router.push("/profile");
        } else {
          // No session after waiting - redirect to auth
          router.push("/auth");
        }
      } catch (err: any) {
        console.error("Auth callback error:", err);
        setError(err.message || "Authentication failed");
        // Redirect to auth page after 3 seconds
        setTimeout(() => router.push("/auth"), 3000);
      }
    };

    handleCallback();
  }, [router]);

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-pink-50 dark:from-gray-900 dark:to-red-900 flex items-center justify-center p-4">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 max-w-md w-full">
          <div className="text-center">
            <div className="text-6xl mb-4">❌</div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              Authentication Failed
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mb-4">{error}</p>
            <p className="text-sm text-gray-500 dark:text-gray-500">
              Redirecting to login page...
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-50 dark:from-gray-900 dark:to-purple-900 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 max-w-md w-full">
        <div className="text-center">
          <div className="inline-block mb-4">
            <div className="w-16 h-16 border-4 border-purple-200 border-t-purple-600 rounded-full animate-spin"></div>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            Completing Sign In...
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            Please wait while we set up your account
          </p>
        </div>
      </div>
    </div>
  );
}
