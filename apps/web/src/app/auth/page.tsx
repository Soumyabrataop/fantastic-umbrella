"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import "./auth.css";

export default function AuthPage() {
  const router = useRouter();
  const { signInWithGoogle, user, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Redirect if already logged in
  useEffect(() => {
    if (user && !authLoading) {
      router.push("/feed");
    }
  }, [user, authLoading, router]);

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setError("");

    try {
      const { error } = await signInWithGoogle();

      if (error) throw error;

      // Redirect will happen automatically via OAuth flow
      console.log("Google sign-in initiated");
    } catch (err: any) {
      console.error("Google sign-in error:", err);
      setError(err.message || "Failed to sign in with Google");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-blue-50 dark:from-gray-900 dark:via-purple-900 dark:to-gray-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo/Brand */}
        <div className="text-center mb-8">
          <h1 className="text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-pink-600 mb-3">
            InstaVEO
          </h1>
          <p className="text-gray-600 dark:text-gray-400 text-lg">
            Create AI videos, share with the world
          </p>
        </div>

        {/* Auth Card */}
        <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl p-8 border border-gray-200 dark:border-gray-700">
          <div className="text-center mb-6">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              Welcome!
            </h2>
            <p className="text-gray-600 dark:text-gray-400">
              Sign in to start creating videos
            </p>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <p className="text-red-600 dark:text-red-400 text-sm font-medium">
                {error}
              </p>
            </div>
          )}

          {/* Google Sign-In Button */}
          <button
            onClick={handleGoogleSignIn}
            disabled={loading || authLoading}
            className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-white dark:bg-gray-700 border-2 border-gray-300 dark:border-gray-600 rounded-xl font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600 hover:border-gray-400 dark:hover:border-gray-500 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm hover:shadow-md"
          >
            {loading || authLoading ? (
              <>
                <div className="w-5 h-5 border-2 border-gray-400 border-t-transparent rounded-full animate-spin"></div>
                <span>Connecting...</span>
              </>
            ) : (
              <>
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
                <span>Continue with Google</span>
              </>
            )}
          </button>

          {/* Privacy Notice */}
          <p className="mt-6 text-xs text-center text-gray-500 dark:text-gray-400">
            By continuing, you agree to store your videos in your Google Drive.
            <br />
            We'll ask for Drive permissions after you sign in.
          </p>
        </div>

        {/* Features */}
        <div className="mt-8 grid grid-cols-3 gap-4 text-center">
          <div className="p-3 bg-white/50 dark:bg-gray-800/50 rounded-xl backdrop-blur">
            <div className="text-2xl mb-1">🎨</div>
            <p className="text-xs text-gray-600 dark:text-gray-400 font-medium">
              AI-Powered
            </p>
          </div>
          <div className="p-3 bg-white/50 dark:bg-gray-800/50 rounded-xl backdrop-blur">
            <div className="text-2xl mb-1">🔒</div>
            <p className="text-xs text-gray-600 dark:text-gray-400 font-medium">
              Your Drive
            </p>
          </div>
          <div className="p-3 bg-white/50 dark:bg-gray-800/50 rounded-xl backdrop-blur">
            <div className="text-2xl mb-1">🚀</div>
            <p className="text-xs text-gray-600 dark:text-gray-400 font-medium">
              Instant Share
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
