"use client";

import { useAuth } from "@/hooks/useAuth";
import AuthForm from "@/components/AuthForm";
import UserProfile from "@/components/UserProfile";

export default function Home() {
  const { user, loading, hasCredentials } = useAuth();

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            AI Video Generator
          </h1>
          <p className="text-xl text-gray-600 mb-8">
            Turborepo + Next.js + Supabase Integration
          </p>

          <div
            className={`inline-flex items-center px-4 py-2 rounded-full text-sm font-medium ${
              hasCredentials
                ? "bg-green-100 text-green-800"
                : "bg-yellow-100 text-yellow-800"
            }`}
          >
            <div
              className={`w-2 h-2 rounded-full mr-2 ${
                hasCredentials ? "bg-green-400" : "bg-yellow-400"
              }`}
            ></div>
            {hasCredentials ? "Supabase Connected" : "Supabase Setup Required"}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-6">
              Authentication
            </h2>
            {!hasCredentials ? (
              <div className="bg-yellow-50 border border-yellow-200 p-6 rounded-lg">
                <h3 className="text-lg font-semibold text-yellow-800 mb-2">
                  ⚠️ Setup Required
                </h3>
                <p className="text-yellow-700 mb-4">
                  To test authentication, you need to configure your Supabase
                  credentials.
                </p>
                <ol className="text-sm text-yellow-700 space-y-1 mb-4">
                  <li>
                    1. Create a project at{" "}
                    <a href="https://supabase.com" className="underline">
                      supabase.com
                    </a>
                  </li>
                  <li>2. Copy your project URL and anon key</li>
                  <li>
                    3. Create{" "}
                    <code className="bg-yellow-100 px-1 rounded">
                      .env.local
                    </code>{" "}
                    file
                  </li>
                  <li>4. Add your credentials and restart the dev server</li>
                </ol>
                <p className="text-xs text-yellow-600">
                  See <code>apps/web/.env.local.example</code> for the template.
                </p>
              </div>
            ) : loading ? (
              <div className="flex items-center justify-center p-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              </div>
            ) : user ? (
              <UserProfile />
            ) : (
              <AuthForm />
            )}
          </div>

          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-6">
              Project Setup
            </h2>
            <div className="bg-white p-6 rounded-lg shadow-md">
              <h3 className="text-lg font-semibold mb-4">
                🚀 What&apos;s Included
              </h3>
              <ul className="space-y-2 text-gray-600">
                <li className="flex items-center">
                  <span className="text-green-500 mr-2">✓</span>
                  Turborepo monorepo structure
                </li>
                <li className="flex items-center">
                  <span className="text-green-500 mr-2">✓</span>
                  Next.js 16 with App Router
                </li>
                <li className="flex items-center">
                  <span className="text-green-500 mr-2">✓</span>
                  TypeScript configuration
                </li>
                <li className="flex items-center">
                  <span className="text-green-500 mr-2">✓</span>
                  Tailwind CSS styling
                </li>
                <li className="flex items-center">
                  <span className="text-green-500 mr-2">✓</span>
                  Supabase client integration
                </li>
                <li className="flex items-center">
                  <span className="text-green-500 mr-2">✓</span>
                  Authentication hooks & components
                </li>
              </ul>

              <h3 className="text-lg font-semibold mt-6 mb-4">📝 Next Steps</h3>
              <ol className="space-y-2 text-gray-600 text-sm">
                <li>
                  1. Create a Supabase project at{" "}
                  <a
                    href="https://supabase.com"
                    className="text-blue-600 hover:underline"
                  >
                    supabase.com
                  </a>
                </li>
                <li>2. Copy your project URL and anon key</li>
                <li>
                  3. Create{" "}
                  <code className="bg-gray-100 px-1 rounded">.env.local</code>{" "}
                  from the example file
                </li>
                <li>4. Add your Supabase credentials</li>
                <li>5. Start building your AI video features!</li>
              </ol>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
