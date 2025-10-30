"use client";

import { useEffect, useRef, useState } from "react";
import type { Video } from "@/types";
import { generateMockVideos } from "@/utils/mockData";
import Link from "next/link";

// Video Card Component with Instagram-style preloading
function FeedVideoCard({
  video,
  index,
  onRecreate,
  isActive,
  isPrevious,
  isNext,
}: {
  video: Video;
  index: number;
  onRecreate: (videoId: string) => void;
  isActive: boolean;
  isPrevious: boolean;
  isNext: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isMuted, setIsMuted] = useState(true);
  const [displayLikes, setDisplayLikes] = useState(video.likes);
  const [displayDislikes, setDisplayDislikes] = useState(video.dislikes);
  const [hasLiked, setHasLiked] = useState(false);
  const [hasDisliked, setHasDisliked] = useState(false);
  const [isBuffered, setIsBuffered] = useState(false);
  const [scrollY, setScrollY] = useState(0);
  const playPromiseRef = useRef<Promise<void> | null>(null);

  // Instagram-style controls state
  const [showLikeAnimation, setShowLikeAnimation] = useState(false);
  const [showMuteIcon, setShowMuteIcon] = useState(false);
  const lastTapRef = useRef<number>(0);

  // Preload first few seconds when video is near viewport
  useEffect(() => {
    const videoElement = videoRef.current;
    if (!videoElement) return;

    // Priority preloading: Active video + adjacent videos
    if (isActive || isPrevious || isNext) {
      videoElement.preload = "auto";

      // Force load first few seconds - await play promise to prevent AbortError
      if (!isBuffered && videoElement.readyState < 2) {
        // If there's an ongoing play promise, wait for it before loading
        if (playPromiseRef.current) {
          playPromiseRef.current
            .then(() => {
              // Play completed, safe to load
              if (!isBuffered && videoElement.readyState < 2) {
                videoElement.load();
              }
            })
            .catch(() => {
              // Play failed, safe to load
              if (!isBuffered && videoElement.readyState < 2) {
                videoElement.load();
              }
            });
        } else {
          // No ongoing play, safe to load immediately
          videoElement.load();
        }
      }

      // Buffer check
      const handleProgress = () => {
        if (videoElement.buffered.length > 0) {
          const bufferedEnd = videoElement.buffered.end(0);
          // Check if at least 3 seconds are buffered
          if (bufferedEnd >= 3) {
            setIsBuffered(true);
          }
        }
      };

      videoElement.addEventListener("progress", handleProgress);
      return () => videoElement.removeEventListener("progress", handleProgress);
    } else {
      // Unload videos far from viewport to save memory
      videoElement.preload = "none";
      if (!videoElement.paused) {
        videoElement.pause();
      }
    }
  }, [isActive, isPrevious, isNext, isBuffered]);

  // Auto-play/pause based on active state
  useEffect(() => {
    const videoElement = videoRef.current;
    if (!videoElement) return;

    if (isActive) {
      videoElement.muted = true;
      const playPromise = videoElement.play();
      playPromiseRef.current = playPromise; // Store promise to prevent AbortError

      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            console.log(`Video ${index} playing`);
            playPromiseRef.current = null; // Clear after success
          })
          .catch((error) => {
            console.log(`Video ${index} play failed:`, error);
            playPromiseRef.current = null; // Clear after error
            // Retry once
            setTimeout(() => {
              videoElement.muted = true;
              videoElement.play().catch((e) => console.log("Retry failed:", e));
            }, 100);
          });
      }
    } else {
      videoElement.pause();
      playPromiseRef.current = null; // Clear when pausing
    }
  }, [isActive, index]);

  // Parallax effect on scroll (desktop only)
  useEffect(() => {
    if (!containerRef.current) return;

    const handleScroll = () => {
      if (window.innerWidth >= 768 && containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        const scrollProgress = -rect.top / window.innerHeight;
        setScrollY(scrollProgress);
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();

    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const handleLike = () => {
    if (!hasLiked) {
      setDisplayLikes(displayLikes + 1);
      setHasLiked(true);
      if (hasDisliked) {
        setDisplayDislikes(displayDislikes - 1);
        setHasDisliked(false);
      }
    }
  };

  const handleDislike = () => {
    if (!hasDisliked) {
      setDisplayDislikes(displayDislikes + 1);
      setHasDisliked(true);
      if (hasLiked) {
        setDisplayLikes(displayLikes - 1);
        setHasLiked(false);
      }
    }
  };

  const handleRecreate = () => {
    onRecreate(video.id);
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Video by ${video.username}`,
          text: video.prompt,
          url: window.location.href,
        });
      } catch (error) {
        console.log("Share cancelled or failed");
      }
    } else {
      alert("Share feature not supported on this browser");
    }
  };

  // Instagram-style video controls
  const handleVideoClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const now = Date.now();
    const timeSinceLastTap = now - lastTapRef.current;

    // Double tap to like (within 300ms)
    if (timeSinceLastTap < 300 && timeSinceLastTap > 0) {
      // Only increment like if not already liked
      if (!hasLiked) {
        handleLike();
        setShowLikeAnimation(true);
        setTimeout(() => setShowLikeAnimation(false), 1000);
      } else {
        // Just show animation if already liked
        setShowLikeAnimation(true);
        setTimeout(() => setShowLikeAnimation(false), 1000);
      }
      lastTapRef.current = 0; // Reset to prevent triple tap
      return;
    }

    // Single tap to mute/unmute (wait to see if it's a double tap)
    lastTapRef.current = now;
    setTimeout(() => {
      if (lastTapRef.current === now) {
        // Still the same tap, so it's a single tap
        if (videoRef.current) {
          const newMutedState = !isMuted;
          videoRef.current.muted = newMutedState;
          setIsMuted(newMutedState);
          setShowMuteIcon(true);
          setTimeout(() => setShowMuteIcon(false), 800);
        }
      }
    }, 300);
  };

  return (
    <>
      {/* Desktop Layout - Card Stack with Parallax */}
      <div
        ref={containerRef}
        className="hidden md:block relative h-screen w-full bg-linear-to-br from-lime-50 via-yellow-50 to-green-50 dark:from-black dark:via-gray-950 dark:to-black snap-item"
        style={{
          transform: `translateY(${scrollY * 20}px)`,
          transition: "transform 0.1s ease-out",
        }}
      >
        <div className="flex items-center justify-center h-full p-4">
          {/* Card Stack Container with Parallax */}
          <div
            className="relative w-full max-w-2xl h-[80vh]"
            style={{
              transform: `perspective(1000px) rotateY(${scrollY * 2}deg)`,
              transition: "transform 0.2s ease-out",
            }}
          >
            {/* Background Card (Blue Shadow) - Rightmost, smallest offset */}
            <div className="absolute top-8 right-0 w-[45%] h-[88%] bg-blue-600 rounded-3xl z-0"></div>

            {/* Yellow Info Card - Middle layer, smaller than video card */}
            <div className="absolute top-6 right-1 w-[45%] h-[88%] bg-linear-to-br from-yellow-400 to-yellow-500 rounded-3xl border-4 border-black dark:border-white shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] dark:shadow-[8px_8px_0px_0px_rgba(255,255,255,1)] z-10 overflow-hidden">
              <div className="h-full p-6 flex flex-col">
                {/* Prompt Section */}
                <div className="mb-6">
                  <h3 className="text-black font-black text-xl mb-3">
                    Prompt:
                  </h3>
                  <p className="text-black text-sm font-medium leading-relaxed">
                    {video.prompt}
                  </p>
                </div>

                {/* Spacer */}
                <div className="flex-1"></div>

                {/* Share Button */}
                <button
                  onClick={handleShare}
                  className="w-full bg-white text-black px-5 py-3 rounded-xl font-black text-lg border-3 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all duration-200 flex items-center justify-center gap-2 mb-5"
                >
                  Share
                  <svg
                    className="w-6 h-6 ml-auto"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3"
                  >
                    <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
                  </svg>
                </button>

                {/* Action Icons Row */}
                <div className="flex items-center justify-around gap-2">
                  {/* Like */}
                  <button
                    onClick={handleLike}
                    className="flex flex-col items-center gap-1.5"
                  >
                    <div
                      className={`w-16 h-16 rounded-2xl flex items-center justify-center border-3 border-black transition-all ${
                        hasLiked
                          ? "bg-red-500 scale-110"
                          : "bg-red-400 hover:bg-red-500"
                      }`}
                    >
                      <svg
                        className="w-8 h-8"
                        viewBox="0 0 24 24"
                        fill={hasLiked ? "white" : "none"}
                        stroke={hasLiked ? "white" : "black"}
                        strokeWidth="2"
                      >
                        <path
                          d="m7.234 3.004c-2.652 0-5.234 1.829-5.234 5.177 0 3.725 4.345 7.727 9.303 12.54.194.189.446.283.697.283s.503-.094.697-.283c4.977-4.831 9.303-8.814 9.303-12.54 0-3.353-2.58-5.168-5.229-5.168-1.836 0-3.646.866-4.771 2.554-1.13-1.696-2.935-2.563-4.766-2.563zm0 1.5c1.99.001 3.202 1.353 4.155 2.7.14.198.368.316.611.317.243 0 .471-.117.612-.314.955-1.339 2.19-2.694 4.159-2.694 1.796 0 3.729 1.148 3.729 3.668 0 2.671-2.881 5.673-8.5 11.127-5.454-5.285-8.5-8.389-8.5-11.127 0-1.125.389-2.069 1.124-2.727.673-.604 1.625-.95 2.61-.95z"
                          fillRule="nonzero"
                        />
                      </svg>
                    </div>
                    <span className="text-black font-black text-base">
                      {displayLikes}
                    </span>
                  </button>

                  {/* Recreate */}
                  <button
                    onClick={handleRecreate}
                    className="flex flex-col items-center gap-1.5"
                  >
                    <div className="w-16 h-16 bg-yellow-600 rounded-2xl flex items-center justify-center border-3 border-black hover:bg-yellow-700 transition-all">
                      <svg className="w-8 h-8" viewBox="0 0 24 24" fill="white">
                        <path
                          d="m21.897 13.404.008-.057v.002c.024-.178.044-.357.058-.537.024-.302-.189-.811-.749-.811-.391 0-.715.3-.747.69-.018.221-.044.44-.078.656-.645 4.051-4.158 7.153-8.391 7.153-3.037 0-5.704-1.597-7.206-3.995l1.991-.005c.414 0 .75-.336.75-.75s-.336-.75-.75-.75h-4.033c-.414 0-.75.336-.75.75v4.049c0 .414.336.75.75.75s.75-.335.75-.75l.003-2.525c1.765 2.836 4.911 4.726 8.495 4.726 5.042 0 9.217-3.741 9.899-8.596zm-19.774-2.974-.009.056v-.002c-.035.233-.063.469-.082.708-.024.302.189.811.749.811.391 0 .715-.3.747-.69.022-.28.058-.556.107-.827.716-3.968 4.189-6.982 8.362-6.982 3.037 0 5.704 1.597 7.206 3.995l-1.991.005c-.414 0-.75.336-.75.75s.336.75.75.75h4.033c.414 0 .75-.336.75-.75v-4.049c0-.414-.336-.75-.75-.75s-.75.335-.75.75l-.003 2.525c-1.765-2.836-4.911-4.726-8.495-4.726-4.984 0-9.12 3.654-9.874 8.426z"
                          fillRule="nonzero"
                        />
                      </svg>
                    </div>
                    <span className="text-black font-black text-base">
                      1.2k
                    </span>
                  </button>

                  {/* Dislike */}
                  <button
                    onClick={handleDislike}
                    className="flex flex-col items-center gap-1.5"
                  >
                    <div
                      className={`w-16 h-16 rounded-2xl flex items-center justify-center border-3 border-black transition-all ${
                        hasDisliked
                          ? "bg-red-600 scale-110"
                          : "bg-red-500 hover:bg-red-600"
                      }`}
                    >
                      <svg className="w-8 h-8" viewBox="0 0 24 24" fill="white">
                        <path d="M19.406 14.442c1.426-.06 2.594-.858 2.594-2.506 0-1-.986-6.373-1.486-8.25-.714-2.689-2.471-3.686-5.009-3.686-2.283 0-4.079.617-5.336 1.158-2.585 1.113-4.665 1.842-8.169 1.842v9.928c3.086.401 6.43.956 8.4 7.744.483 1.66.972 3.328 2.833 3.328 3.448 0 3.005-5.531 2.196-8.814 1.107-.466 2.767-.692 3.977-.744zm-.207-1.992c-2.749.154-5.06 1.013-6.12 1.556.431 1.747.921 3.462.921 5.533 0 2.505-.781 3.666-1.679.574-1.993-6.859-5.057-8.364-8.321-9.113v-6c2.521-.072 4.72-1.041 6.959-2.005 1.731-.745 4.849-1.495 6.416-.614 1.295.836 1.114 1.734.292 1.661l-.771-.032c-.815-.094-.92 1.068-.109 1.141 0 0 1.321.062 1.745.115.976.123 1.028 1.607-.04 1.551-.457-.024-1.143-.041-1.143-.041-.797-.031-.875 1.078-.141 1.172 0 0 .714.005 1.761.099s1.078 1.609-.004 1.563c-.868-.037-1.069-.027-1.069-.027-.75.005-.874 1.028-.141 1.115l1.394.167c1.075.13 1.105 1.526.05 1.585z" />
                      </svg>
                    </div>
                    <span className="text-black font-black text-base">
                      {displayDislikes}
                    </span>
                  </button>
                </div>
              </div>
            </div>

            {/* Video Card - Front layer, with proper white/light border */}
            <div className="absolute top-0 left-0 w-[58%] h-full rounded-3xl z-20 overflow-hidden">
              {/* White/Light Border Container */}
              <div className="w-full h-full bg-white dark:bg-gray-200 rounded-3xl">
                {/* Inner Video Container with black border */}
                <div className="w-full h-full bg-black rounded-[20px] border-4 border-black dark:border-white shadow-[10px_10px_0px_0px_rgba(0,0,0,1)] dark:shadow-[10px_10px_0px_0px_rgba(255,255,255,1)] overflow-hidden relative">
                  <video
                    ref={videoRef}
                    src={video.videoUrl}
                    poster={video.thumbnailUrl}
                    className="w-full h-full object-cover cursor-pointer select-none"
                    style={{
                      transform: "translateZ(0)",
                      willChange: "transform",
                    }}
                    loop
                    playsInline
                    autoPlay
                    muted={isMuted}
                    preload="metadata"
                    onClick={handleVideoClick}
                    onContextMenu={(e) => e.preventDefault()}
                    onLoadedData={(e) => {
                      const video = e.currentTarget;
                      video.muted = true;
                      video
                        .play()
                        .catch((err) =>
                          console.log("Play on load failed:", err)
                        );
                    }}
                  />

                  {/* Double Tap Like Animation */}
                  {showLikeAnimation && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-50">
                      <div className="animate-ping">
                        <svg
                          className="w-32 h-32 text-red-500 drop-shadow-2xl"
                          fill="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            fillRule="evenodd"
                            d="m7.234 3.004c-2.652 0-5.234 1.829-5.234 5.177 0 3.725 4.345 7.727 9.303 12.54.194.189.446.283.697.283s.503-.094.697-.283c4.977-4.831 9.303-8.814 9.303-12.54 0-3.353-2.58-5.168-5.229-5.168-1.836 0-3.646.866-4.771 2.554-1.13-1.696-2.935-2.563-4.766-2.563z"
                            clipRule="evenodd"
                          />
                        </svg>
                      </div>
                    </div>
                  )}

                  {/* Mute/Unmute Icon Animation */}
                  {showMuteIcon && (
                    <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 pointer-events-none z-40">
                      <div className="bg-black/70 rounded-full p-4 border-3 border-white animate-fade-scale">
                        {isMuted ? (
                          <svg
                            className="w-10 h-10 text-white"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"
                            />
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2"
                            />
                          </svg>
                        ) : (
                          <svg
                            className="w-10 h-10 text-white"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"
                            />
                          </svg>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Layout - Full Screen Video with Side Actions */}
      <div className="md:hidden relative h-screen w-full bg-black snap-item overflow-hidden">
        {/* Video Container */}
        <div className="absolute inset-0">
          <video
            ref={videoRef}
            src={video.videoUrl}
            poster={video.thumbnailUrl}
            className="w-full h-full object-cover cursor-pointer select-none"
            style={{ transform: "translateZ(0)", willChange: "transform" }}
            loop
            playsInline
            autoPlay
            muted={isMuted}
            preload="metadata"
            onClick={handleVideoClick}
            onContextMenu={(e) => e.preventDefault()}
            onLoadedData={(e) => {
              const video = e.currentTarget;
              video.muted = true;
              video
                .play()
                .catch((err) => console.log("Play on load failed:", err));
            }}
          />

          {/* Action Buttons - Right Side */}
          <div className="absolute right-3 bottom-24 flex flex-col gap-4 z-30">
            {/* Like Button */}
            <button
              onClick={handleLike}
              className="flex flex-col items-center gap-1"
            >
              <div
                className={`w-14 h-14 rounded-full flex items-center justify-center transition-all ${
                  hasLiked ? "bg-red-500 scale-110" : "bg-white/90"
                }`}
              >
                <svg
                  className="w-7 h-7"
                  viewBox="0 0 24 24"
                  fill={hasLiked ? "white" : "#FF0050"}
                >
                  <path d="m7.234 3.004c-2.652 0-5.234 1.829-5.234 5.177 0 3.725 4.345 7.727 9.303 12.54.194.189.446.283.697.283s.503-.094.697-.283c4.977-4.831 9.303-8.814 9.303-12.54 0-3.353-2.58-5.168-5.229-5.168-1.836 0-3.646.866-4.771 2.554-1.13-1.696-2.935-2.563-4.766-2.563z" />
                </svg>
              </div>
              <span className="text-white font-bold text-sm drop-shadow-lg">
                {displayLikes}
              </span>
            </button>

            {/* Dislike Button */}
            <button
              onClick={handleDislike}
              className="flex flex-col items-center gap-1"
            >
              <div
                className={`w-14 h-14 rounded-full flex items-center justify-center transition-all ${
                  hasDisliked ? "bg-pink-500 scale-110" : "bg-white/90"
                }`}
              >
                <svg
                  className="w-7 h-7"
                  viewBox="0 0 24 24"
                  fill={hasDisliked ? "white" : "#FF1493"}
                >
                  <path d="M19.406 14.442c1.426-.06 2.594-.858 2.594-2.506 0-1-.986-6.373-1.486-8.25-.714-2.689-2.471-3.686-5.009-3.686-2.283 0-4.079.617-5.336 1.158-2.585 1.113-4.665 1.842-8.169 1.842v9.928c3.086.401 6.43.956 8.4 7.744.483 1.66.972 3.328 2.833 3.328 3.448 0 3.005-5.531 2.196-8.814 1.107-.466 2.767-.692 3.977-.744zm-.207-1.992c-2.749.154-5.06 1.013-6.12 1.556.431 1.747.921 3.462.921 5.533 0 2.505-.781 3.666-1.679.574-1.993-6.859-5.057-8.364-8.321-9.113v-6c2.521-.072 4.72-1.041 6.959-2.005 1.731-.745 4.849-1.495 6.416-.614 1.295.836 1.114 1.734.292 1.661l-.771-.032c-.815-.094-.92 1.068-.109 1.141 0 0 1.321.062 1.745.115.976.123 1.028 1.607-.04 1.551-.457-.024-1.143-.041-1.143-.041-.797-.031-.875 1.078-.141 1.172 0 0 .714.005 1.761.099s1.078 1.609-.004 1.563c-.868-.037-1.069-.027-1.069-.027-.75.005-.874 1.028-.141 1.115l1.394.167c1.075.13 1.105 1.526.05 1.585z" />
                </svg>
              </div>
              <span className="text-white font-bold text-sm drop-shadow-lg">
                {displayDislikes}
              </span>
            </button>

            {/* Share Button */}
            <button
              onClick={handleShare}
              className="flex flex-col items-center gap-1"
            >
              <div className="w-14 h-14 rounded-full bg-white/90 flex items-center justify-center">
                <svg
                  className="w-6 h-6"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="black"
                  strokeWidth="2.5"
                >
                  <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
                </svg>
              </div>
              <span className="text-white font-bold text-sm drop-shadow-lg">
                Share
              </span>
            </button>

            {/* Recreate Button */}
            <button
              onClick={handleRecreate}
              className="flex flex-col items-center gap-1"
            >
              <div className="w-14 h-14 rounded-full bg-yellow-400 flex items-center justify-center">
                <svg className="w-7 h-7" viewBox="0 0 24 24" fill="black">
                  <path d="m21.897 13.404.008-.057v.002c.024-.178.044-.357.058-.537.024-.302-.189-.811-.749-.811-.391 0-.715.3-.747.69-.018.221-.044.44-.078.656-.645 4.051-4.158 7.153-8.391 7.153-3.037 0-5.704-1.597-7.206-3.995l1.991-.005c.414 0 .75-.336.75-.75s-.336-.75-.75-.75h-4.033c-.414 0-.75.336-.75.75v4.049c0 .414.336.75.75.75s.75-.335.75-.75l.003-2.525c1.765 2.836 4.911 4.726 8.495 4.726 5.042 0 9.217-3.741 9.899-8.596zm-19.774-2.974-.009.056v-.002c-.035.233-.063.469-.082.708-.024.302.189.811.749.811.391 0 .715-.3.747-.69.022-.28.058-.556.107-.827.716-3.968 4.189-6.982 8.362-6.982 3.037 0 5.704 1.597 7.206 3.995l-1.991.005c-.414 0-.75.336-.75.75s.336.75.75.75h4.033c.414 0 .75-.336.75-.75v-4.049c0-.414-.336-.75-.75-.75s-.75.335-.75.75l-.003 2.525c-1.765-2.836-4.911-4.726-8.495-4.726-4.984 0-9.12 3.654-9.874 8.426z" />
                </svg>
              </div>
              <span className="text-white font-bold text-sm drop-shadow-lg">
                1.2k
              </span>
            </button>
          </div>

          {/* Prompt Info - Bottom Left */}
          <div className="absolute left-3 bottom-24 right-20 z-20">
            <div className="bg-linear-to-r from-yellow-400 to-yellow-500 rounded-2xl border-3 border-black px-4 py-3 shadow-lg">
              <h3 className="text-black font-black text-sm mb-1">Prompt:</h3>
              <p className="text-black text-xs font-semibold line-clamp-2">
                {video.prompt}
              </p>
            </div>
          </div>

          {/* Double Tap Like Animation */}
          {showLikeAnimation && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-50">
              <div className="animate-ping">
                <svg
                  className="w-32 h-32 text-red-500 drop-shadow-2xl"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    fillRule="evenodd"
                    d="m7.234 3.004c-2.652 0-5.234 1.829-5.234 5.177 0 3.725 4.345 7.727 9.303 12.54.194.189.446.283.697.283s.503-.094.697-.283c4.977-4.831 9.303-8.814 9.303-12.54 0-3.353-2.58-5.168-5.229-5.168-1.836 0-3.646.866-4.771 2.554-1.13-1.696-2.935-2.563-4.766-2.563z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
            </div>
          )}

          {/* Mute/Unmute Icon Animation */}
          {showMuteIcon && (
            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 pointer-events-none z-40">
              <div className="bg-black/70 rounded-full p-4 border-3 border-white animate-fade-scale">
                {isMuted ? (
                  <svg
                    className="w-10 h-10 text-white"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2"
                    />
                  </svg>
                ) : (
                  <svg
                    className="w-10 h-10 text-white"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"
                    />
                  </svg>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

export default function FeedPage() {
  const [mockVideos] = useState(() => generateMockVideos(10));
  const [currentIndex, setCurrentIndex] = useState(0);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const isScrollingRef = useRef(false);
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Instagram-style snap scrolling with proper index tracking
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      if (isScrollingRef.current) return;

      // Clear existing timeout
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }

      // Set timeout to detect scroll end
      scrollTimeoutRef.current = setTimeout(() => {
        const scrollTop = container.scrollTop;
        const itemHeight = window.innerHeight;
        const index = Math.round(scrollTop / itemHeight);

        if (index !== currentIndex) {
          setCurrentIndex(index);
          console.log(`Active video: ${index}`);
        }

        isScrollingRef.current = false;
      }, 150);

      isScrollingRef.current = true;
    };

    container.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      container.removeEventListener("scroll", handleScroll);
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, [currentIndex]);

  // Preload first video immediately
  useEffect(() => {
    console.log("Feed loaded, preloading first video");
  }, []);

  const handleRecreate = (videoId: string) => {
    alert(`Recreating video: ${videoId}`);
  };

  return (
    <div
      ref={scrollContainerRef}
      className="h-screen overflow-y-scroll snap-y snap-mandatory hide-scrollbar will-change-scroll"
      style={{
        WebkitOverflowScrolling: "touch",
        scrollBehavior: "smooth",
      }}
    >
      {mockVideos.length === 0 ? (
        <div className="h-screen flex items-center justify-center snap-start snap-item">
          <div className="text-center p-8 bg-white dark:bg-gray-800 border-4 border-black dark:border-purple-500 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] dark:shadow-[8px_8px_0px_0px_rgba(168,85,247,1)] rounded-2xl max-w-md mx-4">
            <div className="text-7xl mb-6 animate-retro-pulse">📹</div>
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-3">
              No videos yet
            </h2>
            <p className="text-gray-600 dark:text-gray-300 mb-8 text-lg">
              Be the first to create an AI-generated video!
            </p>
            <Link
              href="/create"
              className="inline-block bg-linear-to-r from-pink-500 to-purple-600 text-white px-8 py-4 rounded-full font-bold text-lg border-4 border-black dark:border-purple-400 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_0px_rgba(168,85,247,1)] hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:hover:shadow-[2px_2px_0px_0px_rgba(168,85,247,1)] transition-all duration-200"
            >
              Create Video
            </Link>
          </div>
        </div>
      ) : (
        <>
          {mockVideos.map((video, index) => {
            const isActive = index === currentIndex;
            const isPrevious = index === currentIndex - 1;
            const isNext = index === currentIndex + 1;

            return (
              <div key={video.id} className="h-screen snap-start snap-item">
                <FeedVideoCard
                  video={video as any}
                  index={index}
                  onRecreate={handleRecreate}
                  isActive={isActive}
                  isPrevious={isPrevious}
                  isNext={isNext}
                />
              </div>
            );
          })}

          {/* End Banner */}
          <div className="h-screen snap-start snap-item flex items-center justify-center">
            <div className="text-center p-8">
              <div className="text-8xl mb-8 animate-retro-pulse">🎉</div>
              <h2 className="text-4xl font-bold text-gray-900 dark:text-white mb-4 drop-shadow-lg">
                You've Reached the End!
              </h2>
              <p className="text-xl text-gray-600 dark:text-gray-300 mb-8">
                That's all {mockVideos.length} videos for now
              </p>
              <button
                onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
                className="bg-linear-to-r from-pink-500 to-purple-600 text-white px-10 py-5 rounded-full font-bold text-xl border-4 border-black dark:border-purple-400 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] dark:shadow-[8px_8px_0px_0px_rgba(168,85,247,1)] hover:translate-x-1 hover:translate-y-1 hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:hover:shadow-[4px_4px_0px_0px_rgba(168,85,247,1)] transition-all duration-200"
              >
                ↑ Back to Top
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
