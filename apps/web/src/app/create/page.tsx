"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useVideoActions } from "@/hooks/useVideoActions";
import { videoAPI, Video, getPreferredVideoUrl } from "@/utils/api";
import { toast } from "@/utils/toast";
import Loader from "@/components/Loader";

const POLL_INTERVAL_MS = 5000;
const PROGRESS_INTERVAL_MS = 1500;
const PROGRESS_PENDING_TARGET = 60;
const PROGRESS_FINALIZING_TARGET = 99;
const POLL_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes max polling

function extractErrorMessage(error: unknown, fallback: string): string {
  if (typeof error === "string") {
    return error;
  }

  if (error && typeof error === "object") {
    const anyError = error as {
      message?: string;
      response?: { data?: { message?: string } };
    };

    return anyError?.response?.data?.message || anyError?.message || fallback;
  }

  return fallback;
}

export default function CreatePage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const { createVideo } = useVideoActions();

  const [prompt, setPrompt] = useState("");
  const [stage, setStage] = useState<"input" | "loading" | "complete">("input");
  const [progress, setProgress] = useState(0);
  const [generatedVideo, setGeneratedVideo] = useState("");
  const [pageLoading, setPageLoading] = useState(true);
  const [pollingVideoId, setPollingVideoId] = useState<string | null>(null);
  const [videoStatus, setVideoStatus] = useState<Video["status"] | "idle">(
    "idle"
  );
  const [error, setError] = useState<string | null>(null);
  const [failureReason, setFailureReason] = useState<string | null>(null);
  const [pollingStartTime, setPollingStartTime] = useState<number | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const progressIntervalRef = useRef<ReturnType<typeof setInterval> | null>(
    null
  );
  const progressTargetRef = useRef<number>(PROGRESS_PENDING_TARGET);

  // React Query polling for video status with timeout
  const { data: pollingVideo } = useQuery({
    queryKey: ["video-status", pollingVideoId],
    queryFn: async () => {
      if (!pollingVideoId) return null;

      // Check for timeout (10 minutes)
      if (pollingStartTime && Date.now() - pollingStartTime > POLL_TIMEOUT_MS) {
        setError(
          "Video generation timed out after 10 minutes. Please try again."
        );
        setPollingVideoId(null);
        handleVideoFailure();
        throw new Error("Polling timeout");
      }

      try {
        return await videoAPI.syncVideoStatus(pollingVideoId);
      } catch (syncError: any) {
        const status = syncError?.status || syncError?.response?.status;

        // Handle authentication errors
        if (status === 401) {
          setError("Session expired. Please sign in again.");
          throw syncError;
        }

        // Handle rate limit errors
        if (status === 429) {
          const retryAfter = syncError?.retryAfter || 60;
          setError(
            `Rate limit exceeded. Please wait ${retryAfter} seconds before trying again.`
          );
          throw syncError;
        }

        // Handle network errors
        if (syncError?.type === "network") {
          setError(
            "Network error. Please check your connection and try again."
          );
          throw syncError;
        }

        // Fallback to getVideo if sync fails
        try {
          return await videoAPI.getVideo(pollingVideoId);
        } catch (fallbackError: any) {
          console.error("Failed to poll video status", fallbackError);
          setError(
            (prev) =>
              prev ||
              extractErrorMessage(
                fallbackError,
                "Unable to fetch video status."
              )
          );
          throw fallbackError;
        }
      }
    },
    enabled:
      pollingVideoId !== null &&
      (videoStatus === "pending" || videoStatus === "processing"),
    refetchInterval: POLL_INTERVAL_MS,
    retry: 2,
  });

  const clearProgressInterval = () => {
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }
  };

  const startProgress = () => {
    clearProgressInterval();
    progressTargetRef.current = PROGRESS_PENDING_TARGET;
    setProgress(5);
    progressIntervalRef.current = setInterval(() => {
      setProgress((prev) => {
        const target = Math.min(
          progressTargetRef.current,
          PROGRESS_FINALIZING_TARGET
        );
        if (prev >= target) {
          return target;
        }
        const next = prev + 1;
        return next > target ? target : next;
      });
    }, PROGRESS_INTERVAL_MS);
  };

  const handleVideoCompletion = (video: Video) => {
    const playbackUrl = getPreferredVideoUrl(video);
    if (playbackUrl) {
      setGeneratedVideo(playbackUrl);
      setError(null);
    } else {
      setError((prev) => prev || "Video completed but media is unavailable.");
    }

    setStage("complete");
    progressTargetRef.current = 100;
    setProgress(100);
    clearProgressInterval();
    setPollingVideoId(null); // Stop polling
  };

  const handleVideoFailure = () => {
    clearProgressInterval();
    setPollingVideoId(null); // Stop polling
    setStage("input");
    setProgress(0);
    setGeneratedVideo("");
    setVideoStatus("idle");
    progressTargetRef.current = PROGRESS_PENDING_TARGET;
  };

  // Handle polling video updates from React Query
  useEffect(() => {
    if (pollingVideo) {
      setVideoStatus(pollingVideo.status);

      if (pollingVideo.status === "pending") {
        progressTargetRef.current = Math.max(
          progressTargetRef.current,
          PROGRESS_PENDING_TARGET
        );
      } else if (pollingVideo.status === "processing") {
        progressTargetRef.current = Math.max(
          progressTargetRef.current,
          PROGRESS_FINALIZING_TARGET
        );
      }

      if (pollingVideo.status === "completed") {
        toast.success("Video generated successfully!");
        handleVideoCompletion(pollingVideo);
      } else if (pollingVideo.status === "failed") {
        // Extract failure reason from video if available
        const reason =
          (pollingVideo as any).failureReason || "Video generation failed";
        setError(reason);
        setFailureReason(reason);
        toast.error(reason);
        handleVideoFailure();
      }
    }
  }, [pollingVideo]);

  const resetState = () => {
    clearProgressInterval();
    setPollingVideoId(null);
    setStage("input");
    setPrompt("");
    setProgress(0);
    setGeneratedVideo("");
    setVideoStatus("idle");
    setError(null);
    setFailureReason(null);
    setPollingStartTime(null);
    progressTargetRef.current = PROGRESS_PENDING_TARGET;
  };

  useEffect(() => {
    return () => {
      clearProgressInterval();
    };
  }, []);

  useEffect(() => {
    if (generatedVideo && stage === "complete" && videoRef.current) {
      videoRef.current.load();
    }
  }, [generatedVideo, stage]);

  // Simulate page loading
  useEffect(() => {
    const timer = setTimeout(() => {
      setPageLoading(false);
    }, 1000);
    return () => clearTimeout(timer);
  }, []);

  // Redirect to auth if not authenticated
  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/auth");
    }
  }, [user, authLoading, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!prompt.trim() || createVideo.isPending) {
      return;
    }

    clearProgressInterval();
    setError(null);
    setStage("loading");
    setProgress(0);
    setGeneratedVideo("");
    setVideoStatus("idle");
    startProgress();

    try {
      const created = await createVideo.mutateAsync(prompt.trim());
      setPollingVideoId(created.id);
      setVideoStatus(created.status);
      setPollingStartTime(Date.now()); // Start timeout timer
    } catch (submitError: any) {
      console.error("Failed to create video", submitError);
      const status = submitError?.status || submitError?.response?.status;

      if (status === 401 || submitError?.type === "auth") {
        setError(
          "Authentication failed. Please refresh and sign in again before generating."
        );
      } else if (status === 429 || submitError?.type === "rate_limit") {
        const retryAfter = submitError?.retryAfter || 60;
        setError(
          `Rate limit exceeded. Please wait ${retryAfter} seconds before creating another video.`
        );
      } else if (submitError?.type === "network") {
        setError("Network error. Please check your connection and try again.");
      } else {
        setError(
          submitError?.message ||
            extractErrorMessage(
              submitError,
              "Failed to create video. Please try again."
            )
        );
      }
      clearProgressInterval();
      setStage("input");
      setProgress(0);
    }
  };

  const handlePublish = () => {
    router.push("/feed");
  };

  const handleShare = async () => {
    if (!pollingVideoId) {
      window.alert("Video is not ready to share yet.");
      return;
    }

    const shareUrl = `${window.location.origin}/video/${pollingVideoId}`;

    try {
      if (navigator.share) {
        await navigator.share({
          title: "Check out this InstaVEO video",
          text: pollingVideo?.prompt || "Amazing AI-generated video",
          url: shareUrl,
        });
      } else {
        await navigator.clipboard.writeText(shareUrl);
        window.alert("Share link copied to clipboard!");
      }
    } catch (shareError) {
      console.error("Failed to share video", shareError);
      window.alert("Unable to share the video right now.");
    }
  };

  const handleDownload = () => {
    if (!generatedVideo) {
      window.alert("Video is not ready yet.");
      return;
    }

    window.open(generatedVideo, "_blank", "noopener,noreferrer");
  };

  const handleReset = () => {
    resetState();
    createVideo.reset();
  };

  if (pageLoading || authLoading) {
    return <Loader message="LOADING CREATE..." />;
  }

  return (
    <div className="min-h-screen bg-linear-to-br from-cream via-pink-100 to-purple-100 dark:from-background dark:via-gray-900 dark:to-purple-900 flex items-center justify-center p-4 pb-32 md:pb-4">
      <div className="w-full max-w-5xl">
        {error && (
          <div className="mb-6 rounded-xl border-3 border-black bg-white/90 p-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:border-red-400 dark:bg-gray-900/80">
            <div className="flex items-start gap-3">
              <svg
                className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                  clipRule="evenodd"
                />
              </svg>
              <div className="flex-1">
                <p className="text-sm font-bold text-red-600 dark:text-red-300">
                  {error}
                </p>
                {failureReason && failureReason !== error && (
                  <p className="text-xs text-red-500 dark:text-red-400 mt-1">
                    Details: {failureReason}
                  </p>
                )}
              </div>
              {stage === "input" && (
                <button
                  onClick={() => setError(null)}
                  className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-200 transition-colors"
                  aria-label="Dismiss error"
                >
                  <svg
                    className="w-5 h-5"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                      clipRule="evenodd"
                    />
                  </svg>
                </button>
              )}
            </div>
          </div>
        )}

        {/* Input Stage */}
        {stage === "input" && (
          <div className="space-y-4 animate-fade-slide-up">
            {/* Title */}
            <div className="text-center mb-6">
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2 drop-shadow-lg">
                Create AI Video
              </h1>
              <p className="text-sm text-gray-600 dark:text-gray-300 flex items-center justify-center gap-2">
                Describe your video and watch the magic happen
                <svg
                  className="w-4 h-4"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
              </p>
            </div>

            {/* Main Content - Video Card Left, Form Right */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
              {/* Video Card Preview - LEFT */}
              <div className="relative w-full max-w-sm mx-auto aspect-9/16 bg-gray-200 dark:bg-gray-800 rounded-2xl border-3 border-black dark:border-purple-500 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] dark:shadow-[8px_8px_0px_0px_rgba(168,85,247,1)] overflow-hidden flex items-center justify-center">
                <div className="text-center p-4">
                  <svg
                    className="w-20 h-20 mx-auto mb-2 text-gray-500 dark:text-gray-400 animate-retro-pulse"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path d="M2 6a2 2 0 012-2h6a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V6zM14.553 7.106A1 1 0 0014 8v4a1 1 0 00.553.894l2 1A1 1 0 0018 13V7a1 1 0 00-1.447-.894l-2 1z" />
                  </svg>
                  <p className="text-gray-500 dark:text-gray-400 font-bold text-sm">
                    Your video will appear here
                  </p>
                </div>
              </div>

              {/* Input Form - RIGHT */}
              <form
                onSubmit={handleSubmit}
                className="space-y-4 flex flex-col justify-center h-full"
              >
                {/* Text Input */}
                <div>
                  <label className="text-gray-900 dark:text-white font-bold text-base mb-3 flex items-center gap-2">
                    <svg
                      className="w-5 h-5"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                    </svg>
                    Enter your prompt:
                  </label>
                  <textarea
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder="TYPE HERE..."
                    rows={6}
                    className="w-full px-5 py-4 text-base bg-white dark:bg-gray-900 text-gray-900 dark:text-white border-4 border-black dark:border-purple-500 rounded-xl shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] dark:shadow-[6px_6px_0px_0px_rgba(168,85,247,1)] focus:outline-none focus:translate-x-0.5 focus:translate-y-0.5 focus:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:focus:shadow-[4px_4px_0px_0px_rgba(168,85,247,1)] transition-all duration-200 font-medium placeholder:text-gray-400 placeholder:font-bold resize-none"
                    required
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 font-medium flex items-center gap-1">
                    <svg
                      className="w-3 h-3"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                        clipRule="evenodd"
                      />
                    </svg>
                    Be creative and specific for best results!
                  </p>
                </div>

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={!prompt.trim() || createVideo.isPending}
                  className="w-full bg-linear-to-r from-pink-500 to-purple-600 text-white px-6 py-4 rounded-xl font-bold text-lg border-4 border-black dark:border-purple-400 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] dark:shadow-[6px_6px_0px_0px_rgba(168,85,247,1)] hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:hover:shadow-[4px_4px_0px_0px_rgba(168,85,247,1)] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-x-0 disabled:hover:translate-y-0 transition-all duration-200 flex items-center justify-center gap-2"
                >
                  {createVideo.isPending ? "Generating..." : "Generate Video"}
                  {!createVideo.isPending && (
                    <svg
                      className="w-6 h-6"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z"
                        clipRule="evenodd"
                      />
                    </svg>
                  )}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* Loading Stage - Old TV Style */}
        {stage === "loading" && (
          <div className="space-y-4 animate-fade-slide-up">
            <div className="text-center mb-4">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                Generating Your Video...
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-300 line-clamp-1">
                "{prompt}"
              </p>
              <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                {videoStatus === "processing"
                  ? "Processing in Flow"
                  : videoStatus === "pending"
                  ? "Queued for generation"
                  : "Contacting generator"}
              </p>
            </div>

            {/* Old TV Screen */}
            <div className="relative w-full max-w-xs mx-auto aspect-9/16 bg-gray-900 rounded-2xl border-3 border-black dark:border-purple-500 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] dark:shadow-[8px_8px_0px_0px_rgba(168,85,247,1)] overflow-hidden">
              {/* TV Static Effect */}
              <div className="w-full h-full bg-linear-to-br from-gray-800 via-gray-700 to-gray-900 relative">
                {/* Animated Static Lines */}
                <div className="absolute inset-0 opacity-30">
                  {[...Array(50)].map((_, i) => (
                    <div
                      key={i}
                      className="absolute h-0.5 w-full bg-white"
                      style={{
                        top: `${i * 2}%`,
                        animation: `static-line ${
                          0.1 + Math.random() * 0.3
                        }s infinite`,
                        animationDelay: `${Math.random() * 0.5}s`,
                      }}
                    />
                  ))}
                </div>

                {/* Center Loading Icon */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center">
                    <div className="w-20 h-20 border-6 border-white border-t-transparent rounded-full animate-spin mb-4"></div>
                    <p className="text-white font-mono text-lg font-bold animate-pulse">
                      {progress >= 95
                        ? "FINALIZING..."
                        : videoStatus === "processing"
                        ? "PROCESSING..."
                        : "QUEUED..."}
                    </p>
                  </div>
                </div>

                {/* Scanline Effect */}
                <div className="absolute inset-0 pointer-events-none">
                  <div className="w-full h-full opacity-20 bg-linear-to-b from-transparent via-white to-transparent animate-scan-line"></div>
                </div>
              </div>
            </div>

            {/* Retro Progress Bar */}
            <div className="bg-white dark:bg-gray-900 p-4 rounded-lg border-3 border-black dark:border-purple-500 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_0px_rgba(168,85,247,1)]">
              <div className="flex items-center justify-between mb-2">
                <span className="text-gray-900 dark:text-white font-bold text-sm">
                  Progress
                </span>
                <span className="text-gray-900 dark:text-white font-mono font-bold text-base">
                  {progress}%
                </span>
              </div>
              <div className="w-full h-6 bg-gray-200 dark:bg-gray-800 border-3 border-black dark:border-purple-600 rounded-lg overflow-hidden">
                <div
                  className="h-full bg-linear-to-r from-pink-500 to-purple-600 transition-all duration-100 flex items-center justify-end px-2"
                  style={{ width: `${progress}%` }}
                >
                  {progress > 10 && (
                    <span className="text-white font-bold text-xs">▶</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Complete Stage */}
        {stage === "complete" && (
          <div className="space-y-4 animate-fade-slide-up">
            <div className="text-center mb-4">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2 flex items-center justify-center gap-2">
                Video Generated!
                <svg
                  className="w-7 h-7"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                    clipRule="evenodd"
                  />
                </svg>
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-300 line-clamp-1">
                "{prompt}"
              </p>
            </div>

            {/* Generated Video Card */}
            <div className="relative w-full max-w-xs mx-auto aspect-9/16 bg-black rounded-2xl border-3 border-black dark:border-purple-500 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] dark:shadow-[8px_8px_0px_0px_rgba(168,85,247,1)] overflow-hidden">
              {generatedVideo ? (
                <video
                  ref={videoRef}
                  src={generatedVideo}
                  className="w-full h-full object-cover"
                  controls
                  autoPlay
                  loop
                  muted
                />
              ) : (
                <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center text-sm text-gray-300">
                  <svg
                    className="h-10 w-10 text-purple-400"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm11 7l-6 3.75V6.25L15 10z" />
                  </svg>
                  <p className="font-semibold uppercase tracking-wide text-purple-200">
                    Video ready! Preparing playback link...
                  </p>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="grid grid-cols-3 gap-2">
              {/* Publish Button */}
              <button
                onClick={handlePublish}
                className="bg-linear-to-r from-green-500 to-emerald-600 text-white px-3 py-2.5 rounded-lg font-bold text-xs border-3 border-black dark:border-emerald-400 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_0px_rgba(34,197,94,1)] hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all duration-200 flex items-center justify-center gap-1"
                disabled={!pollingVideoId}
              >
                <svg
                  className="w-4 h-4"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                  <path
                    fillRule="evenodd"
                    d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z"
                    clipRule="evenodd"
                  />
                </svg>
                Publish
              </button>

              {/* Share Button */}
              <button
                onClick={handleShare}
                className="bg-linear-to-r from-blue-500 to-cyan-600 text-white px-3 py-2.5 rounded-lg font-bold text-xs border-3 border-black dark:border-cyan-400 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_0px_rgba(34,211,238,1)] hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all duration-200 flex items-center justify-center gap-1"
                disabled={!pollingVideoId}
              >
                <svg
                  className="w-4 h-4"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path d="M15 8a3 3 0 10-2.977-2.63l-4.94 2.47a3 3 0 100 4.319l4.94 2.47a3 3 0 10.895-1.789l-4.94-2.47a3.027 3.027 0 000-.74l4.94-2.47C13.456 7.68 14.19 8 15 8z" />
                </svg>
                Share
              </button>

              {/* Download Button */}
              <button
                onClick={handleDownload}
                className="bg-linear-to-r from-purple-500 to-pink-600 text-white px-3 py-2.5 rounded-lg font-bold text-xs border-3 border-black dark:border-pink-400 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_0px_rgba(236,72,153,1)] hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all duration-200 flex items-center justify-center gap-1"
                disabled={!generatedVideo}
              >
                <svg
                  className="w-4 h-4"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z"
                    clipRule="evenodd"
                  />
                </svg>
                Download
              </button>
            </div>

            {/* Create Another Button */}
            <button
              onClick={handleReset}
              className="w-full bg-white dark:bg-gray-900 text-gray-900 dark:text-white px-4 py-2 rounded-lg font-bold text-sm border-3 border-black dark:border-purple-500 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_0px_rgba(168,85,247,1)] hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:hover:shadow-[2px_2px_0px_0px_rgba(168,85,247,1)] transition-all duration-200 flex items-center justify-center gap-2"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z"
                  clipRule="evenodd"
                />
              </svg>
              Create Another Video
            </button>
          </div>
        )}
      </div>

      {/* Custom Animations in Style Tag */}
      <style jsx>{`
        @keyframes static-line {
          0%,
          100% {
            opacity: 0.1;
          }
          50% {
            opacity: 0.5;
          }
        }

        @keyframes scan-line {
          0% {
            transform: translateY(-100%);
          }
          100% {
            transform: translateY(100%);
          }
        }

        .animate-scan-line {
          animation: scan-line 3s linear infinite;
        }
      `}</style>
    </div>
  );
}
