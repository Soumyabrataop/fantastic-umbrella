"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { useVideoActions } from "@/hooks/useVideoActions";

export default function CreatePage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const { createVideo } = useVideoActions();
  const [prompt, setPrompt] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Redirect to home if not authenticated
  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/");
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
      setPrompt("");
      // Redirect to feed after successful creation
      router.push("/feed");
    } catch (error) {
      console.error("Failed to create video:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#1A1423] retro-scanlines">
        <div className="text-center">
          <div className="text-[#00F5FF] text-6xl mb-4 retro-glow font-['Press_Start_2P']">
            ▓▓▓
          </div>
          <p className="text-[#9D4EDD] text-xl font-['VT323']">LOADING...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-[#1A1423] pb-24 retro-scanlines">
      {/* Retro Grid Background */}
      <div className="fixed inset-0 opacity-10">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `
            linear-gradient(#9D4EDD 1px, transparent 1px),
            linear-gradient(90deg, #9D4EDD 1px, transparent 1px)
          `,
            backgroundSize: "50px 50px",
          }}
        ></div>
      </div>

      {/* Header */}
      <header
        className="bg-[#240046] border-b-4 border-[#FF006E] sticky top-0 z-40"
        style={{
          boxShadow: "0 0 20px rgba(255, 0, 110, 0.5)",
        }}
      >
        <div className="max-w-5xl mx-auto px-4 py-4">
          <h1
            className="text-2xl font-['Press_Start_2P'] text-[#00F5FF] retro-glow"
            style={{ fontSize: "16px" }}
          >
            ✦ CREATE VIDEO ✦
          </h1>
        </div>
      </header>

      {/* Create Form */}
      <div className="max-w-2xl mx-auto px-4 py-8 relative">
        <div className="retro-card p-8">
          <div className="mb-8 text-center">
            <div
              className="text-8xl mb-4 retro-glow"
              style={{ color: "#FFBE0B" }}
            >
              ✦
            </div>
            <h2
              className="text-2xl font-['Press_Start_2P'] text-[#FF006E] mb-4 retro-glow"
              style={{ fontSize: "16px" }}
            >
              GENERATE VIDEO
            </h2>
            <p className="text-[#00F5FF] text-xl font-['VT323']">
              &gt; DESCRIBE YOUR VISION
            </p>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="mb-6">
              <label
                htmlFor="prompt"
                className="block text-sm font-['Press_Start_2P'] text-[#9D4EDD] mb-3"
                style={{ fontSize: "10px" }}
              >
                :: VIDEO PROMPT ::
              </label>
              <textarea
                id="prompt"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="TYPE YOUR IDEA HERE..."
                className="retro-input w-full resize-none"
                rows={6}
                maxLength={500}
                disabled={isSubmitting}
              />
              <div className="flex justify-between items-center mt-2">
                <p className="text-sm font-['VT323'] text-[#FFBE0B]">
                  BE CREATIVE FOR BEST RESULTS
                </p>
                <span className="text-sm font-['VT323'] text-[#9D4EDD]">
                  {prompt.length}/500
                </span>
              </div>
            </div>

            {/* Example Prompts */}
            <div className="mb-6 retro-card p-4 bg-[#0D0221]">
              <p
                className="text-sm font-['Press_Start_2P'] text-[#00F5FF] mb-4"
                style={{ fontSize: "10px" }}
              >
                &gt;&gt; NEED IDEAS?
              </p>
              <div className="grid gap-2">
                {examplePrompts.map((example, index) => (
                  <button
                    key={index}
                    type="button"
                    onClick={() => setPrompt(example)}
                    className="text-left px-3 py-2 bg-[#240046] hover:bg-[#3C096C] border-2 border-[#9D4EDD] text-sm font-['VT323'] text-[#FFBE0B] transition-all hover:scale-105"
                    style={{
                      boxShadow: "0 0 10px rgba(157, 78, 221, 0.3)",
                    }}
                    disabled={isSubmitting}
                  >
                    ▶ {example}
                  </button>
                ))}
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={!prompt.trim() || isSubmitting}
              className="w-full retro-btn disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
            >
              {isSubmitting ? (
                <>
                  <span className="text-2xl retro-glow">▓▓▓</span>
                  <span>GENERATING...</span>
                </>
              ) : (
                <>
                  <span className="text-2xl">▶</span>
                  <span>GENERATE NOW</span>
                </>
              )}
            </button>
          </form>

          {/* Info Section */}
          <div
            className="mt-8 p-4 bg-[#0D0221] border-3 border-[#00F5FF]"
            style={{
              boxShadow: "0 0 15px rgba(0, 245, 255, 0.3)",
            }}
          >
            <h3
              className="font-['Press_Start_2P'] text-[#00F5FF] mb-3"
              style={{ fontSize: "10px" }}
            >
              ℹ HOW IT WORKS
            </h3>
            <ul className="text-base font-['VT323'] text-[#FFBE0B] space-y-1">
              <li>&gt; ADDED TO GENERATION QUEUE</li>
              <li>&gt; PROCESSING: 1-3 MINUTES</li>
              <li>&gt; CHECK YOUR PROFILE WHEN READY</li>
              <li>&gt; VIEW ALL VIDEOS IN FEED</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

const examplePrompts = [
  "FUTURISTIC CITY SUNSET FLYING CARS CYBERPUNK",
  "ASTRONAUT FLOATING SPACE EARTH BACKGROUND",
  "DRAGON FIRE MEDIEVAL CASTLE EPIC CINEMATIC",
  "OCEAN WAVES BEACH GOLDEN HOUR SERENE",
  "ROBOT DANCING TIMES SQUARE VIBRANT ENERGY",
];
