"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useVideoActions } from '@/hooks/useVideoActions';

export default function CreatePage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const { createVideo } = useVideoActions();
  const [prompt, setPrompt] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Redirect to home if not authenticated
  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/');
    }
  }, [user, authLoading, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!prompt.trim()) {
      return;
    }

    setIsSubmitting(true);
    
    try {
      await createVideo.mutateAsync(prompt);
      setPrompt('');
      // Redirect to feed after successful creation
      router.push('/feed');
    } catch (error) {
      console.error('Failed to create video:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-5xl mx-auto px-4 py-4">
          <h1 className="text-2xl font-bold text-gray-900">Create Video</h1>
        </div>
      </header>

      {/* Create Form */}
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="mb-6 text-center">
            <div className="text-6xl mb-4">✨</div>
            <h2 className="text-2xl font-semibold text-gray-900 mb-2">
              Generate AI Video
            </h2>
            <p className="text-gray-600">
              Describe what you want to see and our AI will create it
            </p>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="mb-6">
              <label
                htmlFor="prompt"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                Video Prompt
              </label>
              <textarea
                id="prompt"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="e.g., A cat playing piano in a jazz club, neon lights, cinematic"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                rows={6}
                maxLength={500}
                disabled={isSubmitting}
              />
              <div className="flex justify-between items-center mt-2">
                <p className="text-sm text-gray-500">
                  Be specific and creative for best results
                </p>
                <span className="text-sm text-gray-500">
                  {prompt.length}/500
                </span>
              </div>
            </div>

            {/* Example Prompts */}
            <div className="mb-6">
              <p className="text-sm font-medium text-gray-700 mb-3">
                Need inspiration? Try these:
              </p>
              <div className="grid gap-2">
                {examplePrompts.map((example, index) => (
                  <button
                    key={index}
                    type="button"
                    onClick={() => setPrompt(example)}
                    className="text-left px-4 py-2 bg-gray-50 hover:bg-gray-100 rounded-lg text-sm text-gray-700 transition-colors"
                    disabled={isSubmitting}
                  >
                    {example}
                  </button>
                ))}
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={!prompt.trim() || isSubmitting}
              className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  <span>Generating...</span>
                </>
              ) : (
                <>
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  <span>Generate Video</span>
                </>
              )}
            </button>
          </form>

          {/* Info Section */}
          <div className="mt-6 p-4 bg-blue-50 rounded-lg">
            <h3 className="font-medium text-blue-900 mb-2">ℹ️ How it works</h3>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>• Your video will be added to the generation queue</li>
              <li>• Processing usually takes 1-3 minutes</li>
              <li>• You'll see it in your profile once ready</li>
              <li>• Check the feed to see all generated videos</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

const examplePrompts = [
  "A futuristic city at sunset with flying cars, cyberpunk aesthetic",
  "An astronaut floating in space with Earth in the background, peaceful",
  "A dragon breathing fire in a medieval castle, epic cinematic",
  "Ocean waves crashing on a beach at golden hour, serene and beautiful",
  "A robot dancing in Times Square, New York, vibrant and energetic",
];
