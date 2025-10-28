"use client";

import { useEffect, useRef, useState } from "react";
import { generateMockVideos } from "@/utils/mockData";
import type { Video } from "@/types";
import Loader from "@/components/Loader";
import VideoLoader from "@/components/VideoLoader";

/** --- Feed Video Card --- */
function FeedVideoCard({
  video,
  index,
  onRecreate,
  isInView,
  shouldPreload,
}: {
  video: Video;
  index: number;
  onRecreate: (videoId: string) => void;
  isInView: boolean;
  shouldPreload: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const playPromiseRef = useRef<Promise<void> | null>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [likes, setLikes] = useState(video.likes);
  const [dislikes, setDislikes] = useState(video.dislikes);
  const [liked, setLiked] = useState(false);
  const [disliked, setDisliked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [scrollY, setScrollY] = useState(0);
  const [retryCount, setRetryCount] = useState(0);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [isLoadingStarted, setIsLoadingStarted] = useState(false);

  /** Retry loading video on error */
  useEffect(() => {
    if (hasError && retryCount < 3) {
      const timer = setTimeout(() => {
        setHasError(false);
        setLoading(true);
        setRetryCount(retryCount + 1);
        if (videoRef.current) {
          videoRef.current.load();
        }
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [hasError, retryCount]);

  /** Smart Preloading - Prioritize current video, then preload nearby videos */
  useEffect(() => {
    if (!videoRef.current) return;

    // If this is the current video (in view), load it immediately with highest priority
    if (isInView && !hasLoaded) {
      setLoading(true);
      setIsLoadingStarted(true);
      videoRef.current.preload = "auto";

      // Force reload if needed
      if (videoRef.current.readyState === 0) {
        videoRef.current.load();
      }
      setHasLoaded(true);
    }
    // If this video should be preloaded (next 2-3 videos), load with metadata first
    else if (shouldPreload && !hasLoaded && !isInView && !isLoadingStarted) {
      // Delay preloading to prevent simultaneous loads
      const preloadDelay = setTimeout(() => {
        if (!videoRef.current) return;

        setIsLoadingStarted(true);
        videoRef.current.preload = "metadata";

        // Only start loading if not already loaded
        if (videoRef.current.readyState === 0) {
          videoRef.current.load();
        }

        // After metadata loads, upgrade to auto for smooth playback
        const upgradePreload = () => {
          if (videoRef.current && shouldPreload) {
            videoRef.current.preload = "auto";
          }
        };

        videoRef.current.addEventListener("loadedmetadata", upgradePreload, {
          once: true,
        });

        setHasLoaded(true);
      }, index * 300); // Stagger preloading by 300ms per video

      return () => {
        clearTimeout(preloadDelay);
      };
    }
    // If video is not in view and not in preload range, use none
    else if (!isInView && !shouldPreload && videoRef.current) {
      videoRef.current.preload = "none";
      // Pause and reset if video was loading
      if (!videoRef.current.paused) {
        videoRef.current.pause();
      }
    }
  }, [isInView, shouldPreload, hasLoaded, isLoadingStarted, index]);

  /** Re-prioritize loading when video comes into view */
  useEffect(() => {
    if (isInView && videoRef.current) {
      setLoading(true);
      if (!hasLoaded || videoRef.current.readyState < 3) {
        videoRef.current.preload = "auto";
        if (videoRef.current.readyState === 0) {
          videoRef.current.load();
        }
        setHasLoaded(true);
        setIsLoadingStarted(true);
      }
    }
  }, [isInView, hasLoaded]);

  /** Fallback loader timeout */
  useEffect(() => {
    if (!loading) return;

    const timeout = setTimeout(() => {
      if (loading && videoRef.current) {
        // Check if video is actually ready but loading state wasn't updated
        if (videoRef.current.readyState >= 3) {
          setLoading(false);
        } else {
          // Still loading after timeout, keep showing loader
          console.warn(`Video ${index} taking longer to load`);
        }
      }
    }, 8000); // Increased timeout for slower connections

    return () => clearTimeout(timeout);
  }, [loading, index]);

  /** Parallax scroll effect (desktop only) */
  useEffect(() => {
    const handleScroll = () => {
      if (containerRef.current && window.innerWidth >= 768) {
        const rect = containerRef.current.getBoundingClientRect();
        const progress = -rect.top / window.innerHeight;
        setScrollY(progress);
      }
    };
    window.addEventListener("scroll", handleScroll);
    handleScroll();
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  /** Auto play/pause when visible */
  useEffect(() => {
    const play = async () => {
      if (!videoRef.current) return;
      try {
        if (playPromiseRef.current)
          await playPromiseRef.current.catch(() => {});
        playPromiseRef.current = videoRef.current.play();
        await playPromiseRef.current;
        setIsPlaying(true);
      } catch {
        setIsPlaying(false);
      } finally {
        playPromiseRef.current = null;
      }
    };

    const pause = async () => {
      if (!videoRef.current) return;
      try {
        if (playPromiseRef.current)
          await playPromiseRef.current.catch(() => {});
        if (!videoRef.current.paused) videoRef.current.pause();
        setIsPlaying(false);
      } finally {
        playPromiseRef.current = null;
      }
    };

    // Only play/pause based on isInView prop
    if (isInView) {
      play();
    } else {
      pause();
    }
  }, [isInView]);

  /** Like / Dislike */
  const handleLike = () => {
    if (!liked) {
      setLikes(likes + 1);
      setLiked(true);
      if (disliked) {
        setDislikes(dislikes - 1);
        setDisliked(false);
      }
    }
  };

  const handleDislike = () => {
    if (!disliked) {
      setDislikes(dislikes + 1);
      setDisliked(true);
      if (liked) {
        setLikes(likes - 1);
        setLiked(false);
      }
    }
  };

  const handleShare = async () => {
    const shareData = {
      title: video.prompt,
      text: `Check out this video by ${video.username}`,
      url: `${window.location.origin}/video/${video.id}`,
    };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(shareData.url);
        alert("Link copied to clipboard!");
      }
    } catch (err) {
      console.log("Error sharing:", err);
    }
  };

  return (
    <>
      {/* -------- Mobile Layout -------- */}
      <div className="md:hidden relative h-screen w-full bg-black flex items-center justify-center p-4 pb-24">
        {loading && (
          <div className="absolute inset-0 bg-black flex items-center justify-center z-10">
            <div className="text-center">
              {/* Ghost Loader */}
              <div id="ghost" style={{ transform: "scale(0.8)" }}>
                <div id="red">
                  <div id="top0"></div>
                  <div id="top1"></div>
                  <div id="top2"></div>
                  <div id="top3"></div>
                  <div id="top4"></div>
                  <div id="st0"></div>
                  <div id="st1"></div>
                  <div id="st2"></div>
                  <div id="st3"></div>
                  <div id="st4"></div>
                  <div id="st5"></div>
                  <div id="an1"></div>
                  <div id="an2"></div>
                  <div id="an3"></div>
                  <div id="an4"></div>
                  <div id="an6"></div>
                  <div id="an7"></div>
                  <div id="an8"></div>
                  <div id="an9"></div>
                  <div id="an10"></div>
                  <div id="an11"></div>
                  <div id="an12"></div>
                  <div id="an13"></div>
                  <div id="an15"></div>
                  <div id="an16"></div>
                  <div id="an17"></div>
                  <div id="an18"></div>
                </div>
                <div id="eye"></div>
                <div id="eye1"></div>
                <div id="pupil"></div>
                <div id="pupil1"></div>
                <div id="shadow"></div>
              </div>
              <p className="text-[#9D4EDD] text-xl font-['VT323'] mt-8">
                {retryCount > 0
                  ? `RETRYING... (${retryCount}/3)`
                  : "LOADING VIDEO..."}
              </p>
            </div>
          </div>
        )}

        {hasError && retryCount >= 3 && (
          <div className="absolute inset-0 bg-black/80 flex items-center justify-center text-red-400 z-10">
            <div className="text-center">
              <p className="text-xl mb-4">⚠️ Failed to load video</p>
              <button
                onClick={() => {
                  setRetryCount(0);
                  setHasError(false);
                  setLoading(true);
                  if (videoRef.current) videoRef.current.load();
                }}
                className="px-6 py-3 text-white rounded-lg hover:bg-[rgba(255,255,255,0.15)] transition-all"
                style={{
                  background: "rgba(255, 255, 255, 0.1)",
                  border: "1px solid rgba(255, 255, 255, 0.2)",
                  backdropFilter: "blur(10px)",
                }}
              >
                Try Again
              </button>
            </div>
          </div>
        )}

        <div className="relative w-full max-w-md h-[calc(100vh-120px)] bg-black rounded-2xl overflow-hidden">
          {!hasError && (
            <video
              ref={videoRef}
              src={video.videoUrl}
              poster={video.thumbnailUrl}
              className="w-full h-full object-cover"
              loop
              playsInline
              muted
              preload="none"
              onLoadStart={() => {
                if (isInView) {
                  setLoading(true);
                }
              }}
              onLoadedData={() => {
                setLoading(false);
                setHasError(false);
              }}
              onCanPlay={() => {
                setLoading(false);
                setHasError(false);
              }}
              onCanPlayThrough={() => {
                setLoading(false);
              }}
              onError={(e) => {
                console.error(`Video ${index} error:`, e);
                setLoading(false);
                setHasError(true);
              }}
              onWaiting={() => {
                if (isInView) {
                  setLoading(true);
                }
              }}
              onPlaying={() => {
                setLoading(false);
              }}
            />
          )}

          {/* User Info */}
          <div className="absolute top-4 left-4 flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-purple-600 flex items-center justify-center text-white text-sm font-bold">
              {video.username?.[0]?.toUpperCase() || "U"}
            </div>
            <span className="text-white text-sm">{video.username}</span>
          </div>

          {/* Caption */}
          <div className="absolute bottom-28 left-4 right-4 text-white text-sm">
            <p>
              <span className="font-bold">{video.username}</span> {video.prompt}
            </p>
          </div>

          {/* Action Buttons - Bento Grid Style */}
          <div className="absolute right-4 top-1/2 -translate-y-1/2 flex flex-col gap-3">
            {/* Like Button */}
            <button
              onClick={handleLike}
              className="flex flex-col items-center justify-center hover:bg-[rgba(255,255,255,0.15)] transition-all"
              style={{
                fontFamily: "Google Sans Text",
                fontSize: "0.75rem",
                fontStyle: "normal",
                fontWeight: 500,
                lineHeight: "1rem",
                backdropFilter: "blur(10px)",
                color: "rgb(255, 255, 255)",
                whiteSpace: "nowrap",
                width: "3.5rem",
                height: "3.5rem",
                background: liked
                  ? "rgba(239, 68, 68, 0.2)"
                  : "rgba(255, 255, 255, 0.1)",
                borderRadius: "12px",
                border: "1px solid rgba(255, 255, 255, 0.1)",
              }}
            >
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
                fill={liked ? "#ef4444" : "none"}
                stroke="currentColor"
                strokeWidth="1.5"
              >
                <path
                  d="m7.234 3.004c-2.652 0-5.234 1.829-5.234 5.177 0 3.725 4.345 7.727 9.303 12.54.194.189.446.283.697.283s.503-.094.697-.283c4.977-4.831 9.303-8.814 9.303-12.54 0-3.353-2.58-5.168-5.229-5.168-1.836 0-3.646.866-4.771 2.554-1.13-1.696-2.935-2.563-4.766-2.563zm0 1.5c1.99.001 3.202 1.353 4.155 2.7.14.198.368.316.611.317.243 0 .471-.117.612-.314.955-1.339 2.19-2.694 4.159-2.694 1.796 0 3.729 1.148 3.729 3.668 0 2.671-2.881 5.673-8.5 11.127-5.454-5.285-8.5-8.389-8.5-11.127 0-1.125.389-2.069 1.124-2.727.673-.604 1.625-.95 2.61-.95z"
                  fillRule="nonzero"
                />
              </svg>
              <span className="text-xs mt-1">{likes}</span>
            </button>

            {/* Dislike Button */}
            <button
              onClick={handleDislike}
              className="flex flex-col items-center justify-center hover:bg-[rgba(255,255,255,0.15)] transition-all"
              style={{
                fontFamily: "Google Sans Text",
                fontSize: "0.75rem",
                fontStyle: "normal",
                fontWeight: 500,
                lineHeight: "1rem",
                backdropFilter: "blur(10px)",
                color: "rgb(255, 255, 255)",
                whiteSpace: "nowrap",
                width: "3.5rem",
                height: "3.5rem",
                background: disliked
                  ? "rgba(239, 68, 68, 0.2)"
                  : "rgba(255, 255, 255, 0.1)",
                borderRadius: "12px",
                border: "1px solid rgba(255, 255, 255, 0.1)",
              }}
            >
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
                fill={disliked ? "#ef4444" : "currentColor"}
              >
                <path d="M19.406 14.442c1.426-.06 2.594-.858 2.594-2.506 0-1-.986-6.373-1.486-8.25-.714-2.689-2.471-3.686-5.009-3.686-2.283 0-4.079.617-5.336 1.158-2.585 1.113-4.665 1.842-8.169 1.842v9.928c3.086.401 6.43.956 8.4 7.744.483 1.66.972 3.328 2.833 3.328 3.448 0 3.005-5.531 2.196-8.814 1.107-.466 2.767-.692 3.977-.744zm-.207-1.992c-2.749.154-5.06 1.013-6.12 1.556.431 1.747.921 3.462.921 5.533 0 2.505-.781 3.666-1.679.574-1.993-6.859-5.057-8.364-8.321-9.113v-6c2.521-.072 4.72-1.041 6.959-2.005 1.731-.745 4.849-1.495 6.416-.614 1.295.836 1.114 1.734.292 1.661l-.771-.032c-.815-.094-.92 1.068-.109 1.141 0 0 1.321.062 1.745.115.976.123 1.028 1.607-.04 1.551-.457-.024-1.143-.041-1.143-.041-.797-.031-.875 1.078-.141 1.172 0 0 .714.005 1.761.099s1.078 1.609-.004 1.563c-.868-.037-1.069-.027-1.069-.027-.75.005-.874 1.028-.141 1.115l1.394.167c1.075.13 1.105 1.526.05 1.585z" />
              </svg>
              <span className="text-xs mt-1">{dislikes}</span>
            </button>

            {/* Recreate Button */}
            <button
              onClick={() => onRecreate(video.id)}
              className="flex flex-col items-center justify-center hover:bg-[rgba(255,255,255,0.15)] transition-all"
              style={{
                fontFamily: "Google Sans Text",
                fontSize: "0.75rem",
                fontStyle: "normal",
                fontWeight: 500,
                lineHeight: "1rem",
                backdropFilter: "blur(10px)",
                color: "rgb(255, 255, 255)",
                whiteSpace: "nowrap",
                width: "3.5rem",
                height: "3.5rem",
                background: "rgba(255, 255, 255, 0.1)",
                borderRadius: "12px",
                border: "1px solid rgba(255, 255, 255, 0.1)",
              }}
            >
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
                fill="currentColor"
              >
                <path
                  d="m21.897 13.404.008-.057v.002c.024-.178.044-.357.058-.537.024-.302-.189-.811-.749-.811-.391 0-.715.3-.747.69-.018.221-.044.44-.078.656-.645 4.051-4.158 7.153-8.391 7.153-3.037 0-5.704-1.597-7.206-3.995l1.991-.005c.414 0 .75-.336.75-.75s-.336-.75-.75-.75h-4.033c-.414 0-.75.336-.75.75v4.049c0 .414.336.75.75.75s.75-.335.75-.75l.003-2.525c1.765 2.836 4.911 4.726 8.495 4.726 5.042 0 9.217-3.741 9.899-8.596zm-19.774-2.974-.009.056v-.002c-.035.233-.063.469-.082.708-.024.302.189.811.749.811.391 0 .715-.3.747-.69.022-.28.058-.556.107-.827.716-3.968 4.189-6.982 8.362-6.982 3.037 0 5.704 1.597 7.206 3.995l-1.991.005c-.414 0-.75.336-.75.75s.336.75.75.75h4.033c.414 0 .75-.336.75-.75v-4.049c0-.414-.336-.75-.75-.75s-.75.335-.75.75l-.003 2.525c-1.765-2.836-4.911-4.726-8.495-4.726-4.984 0-9.12 3.654-9.874 8.426z"
                  fillRule="nonzero"
                />
              </svg>
            </button>

            {/* Share Button */}
            <button
              onClick={handleShare}
              className="flex flex-col items-center justify-center hover:bg-[rgba(255,255,255,0.15)] transition-all"
              style={{
                fontFamily: "Google Sans Text",
                fontSize: "0.75rem",
                fontStyle: "normal",
                fontWeight: 500,
                lineHeight: "1rem",
                backdropFilter: "blur(10px)",
                color: "rgb(255, 255, 255)",
                whiteSpace: "nowrap",
                width: "3.5rem",
                height: "3.5rem",
                background: "rgba(255, 255, 255, 0.1)",
                borderRadius: "12px",
                border: "1px solid rgba(255, 255, 255, 0.1)",
              }}
            >
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
                fill="currentColor"
              >
                <path d="M5 9c1.654 0 3 1.346 3 3s-1.346 3-3 3-3-1.346-3-3 1.346-3 3-3zm0-2c-2.762 0-5 2.239-5 5s2.238 5 5 5 5-2.239 5-5-2.238-5-5-5zm15 9c-1.165 0-2.204.506-2.935 1.301l-5.488-2.927c-.23.636-.549 1.229-.944 1.764l5.488 2.927c-.072.301-.121.611-.121.935 0 2.209 1.791 4 4 4s4-1.791 4-4-1.791-4-4-4zm0 6c-1.103 0-2-.897-2-2s.897-2 2-2 2 .897 2 2-.897 2-2 2zm0-22c-2.209 0-4 1.791-4 4 0 .324.049.634.121.935l-5.488 2.927c.395.536.713 1.128.944 1.764l5.488-2.927c.731.795 1.77 1.301 2.935 1.301 2.209 0 4-1.791 4-4s-1.791-4-4-4zm0 6c-1.103 0-2-.897-2-2s.897-2 2-2 2 .897 2 2-.897 2-2 2z" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* -------- Desktop Layout -------- */}
      <div
        ref={containerRef}
        className="hidden md:flex w-full bg-[#1A1423] items-center justify-center py-8 px-4"
      >
        <div className="w-full max-w-6xl">
          {/* Card Container */}
          <div
            className="relative overflow-hidden rounded-3xl border-4 border-purple-500 shadow-[16px_16px_0px_0px_rgba(168,85,247,0.5)] bg-black"
            style={{
              transform: `translateY(${scrollY * 10}px)`,
              transition: "transform 0.1s ease-out",
            }}
          >
            {/* Video Section */}
            <div className="relative aspect-video w-full overflow-hidden">
              {loading && (
                <div className="absolute inset-0 bg-black flex items-center justify-center text-purple-400 font-mono z-10">
                  <div className="text-center">
                    {/* Ghost Loader */}
                    <div id="ghost" style={{ transform: "scale(0.7)" }}>
                      <div id="red">
                        <div id="top0"></div>
                        <div id="top1"></div>
                        <div id="top2"></div>
                        <div id="top3"></div>
                        <div id="top4"></div>
                        <div id="st0"></div>
                        <div id="st1"></div>
                        <div id="st2"></div>
                        <div id="st3"></div>
                        <div id="st4"></div>
                        <div id="st5"></div>
                        <div id="an1"></div>
                        <div id="an2"></div>
                        <div id="an3"></div>
                        <div id="an4"></div>
                        <div id="an6"></div>
                        <div id="an7"></div>
                        <div id="an8"></div>
                        <div id="an9"></div>
                        <div id="an10"></div>
                        <div id="an11"></div>
                        <div id="an12"></div>
                        <div id="an13"></div>
                        <div id="an15"></div>
                        <div id="an16"></div>
                        <div id="an17"></div>
                        <div id="an18"></div>
                      </div>
                      <div id="eye"></div>
                      <div id="eye1"></div>
                      <div id="pupil"></div>
                      <div id="pupil1"></div>
                      <div id="shadow"></div>
                    </div>
                    <p className="text-[#9D4EDD] text-xl font-['VT323'] mt-8">
                      {retryCount > 0
                        ? `RETRYING... (${retryCount}/3)`
                        : "LOADING VIDEO..."}
                    </p>
                  </div>
                </div>
              )}

              {hasError && retryCount >= 3 ? (
                <div className="absolute inset-0 flex items-center justify-center text-red-400 bg-black/80">
                  <div className="text-center">
                    <p className="text-xl mb-4">⚠️ Failed to load video</p>
                    <button
                      onClick={() => {
                        setRetryCount(0);
                        setHasError(false);
                        setLoading(true);
                        if (videoRef.current) videoRef.current.load();
                      }}
                      className="px-6 py-3 text-white rounded-lg hover:bg-purple-600 transition-all"
                    >
                      Try Again
                    </button>
                  </div>
                </div>
              ) : (
                <video
                  ref={videoRef}
                  src={video.videoUrl}
                  poster={video.thumbnailUrl}
                  className="w-full h-full object-cover"
                  loop
                  playsInline
                  muted
                  preload="none"
                  onLoadStart={() => {
                    if (isInView) {
                      setLoading(true);
                    }
                  }}
                  onLoadedData={() => {
                    setLoading(false);
                    setHasError(false);
                  }}
                  onCanPlay={() => {
                    setLoading(false);
                    setHasError(false);
                  }}
                  onCanPlayThrough={() => {
                    setLoading(false);
                  }}
                  onError={(e) => {
                    console.error(`Video ${index} error:`, e);
                    setLoading(false);
                    setHasError(true);
                  }}
                  onWaiting={() => {
                    if (isInView) {
                      setLoading(true);
                    }
                  }}
                  onPlaying={() => {
                    setLoading(false);
                  }}
                />
              )}

              {/* User Info Badge */}
              <div className="absolute top-4 left-4 flex items-center gap-2 bg-black/70 backdrop-blur-md px-4 py-2 rounded-full border border-purple-500/30">
                <div className="w-8 h-8 rounded-full bg-linear-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white text-sm font-bold">
                  {video.username?.[0]?.toUpperCase() || "U"}
                </div>
                <span className="text-white text-sm font-medium">
                  @{video.username}
                </span>
              </div>
            </div>

            {/* Content Section */}
            <div className="p-6 bg-linear-to-br from-[#1A1423] to-[#2A1F3D]">
              {/* Prompt */}
              <div className="mb-6">
                <h3 className="text-[#9D4EDD] text-sm font-['VT323'] mb-2 uppercase tracking-wider">
                  Prompt
                </h3>
                <p className="text-white text-lg leading-relaxed">
                  {video.prompt}
                </p>
              </div>

              {/* Action Buttons Grid */}
              <div className="grid grid-cols-4 gap-3">
                {/* Like Button */}
                <button
                  onClick={handleLike}
                  className="group relative flex flex-col items-center justify-center py-4 px-3 rounded-xl transition-all duration-300 hover:scale-105"
                  style={{
                    background: liked
                      ? "linear-gradient(135deg, rgba(239, 68, 68, 0.3), rgba(220, 38, 38, 0.2))"
                      : "rgba(255, 255, 255, 0.05)",
                    border: liked
                      ? "2px solid rgba(239, 68, 68, 0.5)"
                      : "2px solid rgba(255, 255, 255, 0.1)",
                    backdropFilter: "blur(10px)",
                  }}
                >
                  <svg
                    width="28"
                    height="28"
                    viewBox="0 0 24 24"
                    xmlns="http://www.w3.org/2000/svg"
                    fill={liked ? "#ef4444" : "none"}
                    stroke="currentColor"
                    strokeWidth="1.5"
                    className="mb-2 transition-transform group-hover:scale-110"
                  >
                    <path
                      d="m7.234 3.004c-2.652 0-5.234 1.829-5.234 5.177 0 3.725 4.345 7.727 9.303 12.54.194.189.446.283.697.283s.503-.094.697-.283c4.977-4.831 9.303-8.814 9.303-12.54 0-3.353-2.58-5.168-5.229-5.168-1.836 0-3.646.866-4.771 2.554-1.13-1.696-2.935-2.563-4.766-2.563zm0 1.5c1.99.001 3.202 1.353 4.155 2.7.14.198.368.316.611.317.243 0 .471-.117.612-.314.955-1.339 2.19-2.694 4.159-2.694 1.796 0 3.729 1.148 3.729 3.668 0 2.671-2.881 5.673-8.5 11.127-5.454-5.285-8.5-8.389-8.5-11.127 0-1.125.389-2.069 1.124-2.727.673-.604 1.625-.95 2.61-.95z"
                      fillRule="nonzero"
                    />
                  </svg>
                  <span className="text-white text-sm font-semibold">
                    {likes}
                  </span>
                  <span className="text-gray-400 text-xs mt-1">Likes</span>
                </button>

                {/* Dislike Button */}
                <button
                  onClick={handleDislike}
                  className="group relative flex flex-col items-center justify-center py-4 px-3 rounded-xl transition-all duration-300 hover:scale-105"
                  style={{
                    background: disliked
                      ? "linear-gradient(135deg, rgba(239, 68, 68, 0.3), rgba(220, 38, 38, 0.2))"
                      : "rgba(255, 255, 255, 0.05)",
                    border: disliked
                      ? "2px solid rgba(239, 68, 68, 0.5)"
                      : "2px solid rgba(255, 255, 255, 0.1)",
                    backdropFilter: "blur(10px)",
                  }}
                >
                  <svg
                    width="28"
                    height="28"
                    viewBox="0 0 24 24"
                    xmlns="http://www.w3.org/2000/svg"
                    fill={disliked ? "#ef4444" : "currentColor"}
                    className="mb-2 transition-transform group-hover:scale-110"
                  >
                    <path d="M19.406 14.442c1.426-.06 2.594-.858 2.594-2.506 0-1-.986-6.373-1.486-8.25-.714-2.689-2.471-3.686-5.009-3.686-2.283 0-4.079.617-5.336 1.158-2.585 1.113-4.665 1.842-8.169 1.842v9.928c3.086.401 6.43.956 8.4 7.744.483 1.66.972 3.328 2.833 3.328 3.448 0 3.005-5.531 2.196-8.814 1.107-.466 2.767-.692 3.977-.744zm-.207-1.992c-2.749.154-5.06 1.013-6.12 1.556.431 1.747.921 3.462.921 5.533 0 2.505-.781 3.666-1.679.574-1.993-6.859-5.057-8.364-8.321-9.113v-6c2.521-.072 4.72-1.041 6.959-2.005 1.731-.745 4.849-1.495 6.416-.614 1.295.836 1.114 1.734.292 1.661l-.771-.032c-.815-.094-.92 1.068-.109 1.141 0 0 1.321.062 1.745.115.976.123 1.028 1.607-.04 1.551-.457-.024-1.143-.041-1.143-.041-.797-.031-.875 1.078-.141 1.172 0 0 .714.005 1.761.099s1.078 1.609-.004 1.563c-.868-.037-1.069-.027-1.069-.027-.75.005-.874 1.028-.141 1.115l1.394.167c1.075.13 1.105 1.526.05 1.585z" />
                  </svg>
                  <span className="text-white text-sm font-semibold">
                    {dislikes}
                  </span>
                  <span className="text-gray-400 text-xs mt-1">Dislikes</span>
                </button>

                {/* Recreate Button */}
                <button
                  onClick={() => onRecreate(video.id)}
                  className="group relative flex flex-col items-center justify-center py-4 px-3 rounded-xl transition-all duration-300 hover:scale-105"
                  style={{
                    background: "rgba(168, 85, 247, 0.1)",
                    border: "2px solid rgba(168, 85, 247, 0.3)",
                    backdropFilter: "blur(10px)",
                  }}
                >
                  <svg
                    width="28"
                    height="28"
                    viewBox="0 0 24 24"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="currentColor"
                    className="mb-2 transition-transform group-hover:rotate-180 duration-500"
                  >
                    <path
                      d="m21.897 13.404.008-.057v.002c.024-.178.044-.357.058-.537.024-.302-.189-.811-.749-.811-.391 0-.715.3-.747.69-.018.221-.044.44-.078.656-.645 4.051-4.158 7.153-8.391 7.153-3.037 0-5.704-1.597-7.206-3.995l1.991-.005c.414 0 .75-.336.75-.75s-.336-.75-.75-.75h-4.033c-.414 0-.75.336-.75.75v4.049c0 .414.336.75.75.75s.75-.335.75-.75l.003-2.525c1.765 2.836 4.911 4.726 8.495 4.726 5.042 0 9.217-3.741 9.899-8.596zm-19.774-2.974-.009.056v-.002c-.035.233-.063.469-.082.708-.024.302.189.811.749.811.391 0 .715-.3.747-.69.022-.28.058-.556.107-.827.716-3.968 4.189-6.982 8.362-6.982 3.037 0 5.704 1.597 7.206 3.995l-1.991.005c-.414 0-.75.336-.75.75s.336.75.75.75h4.033c.414 0 .75-.336.75-.75v-4.049c0-.414-.336-.75-.75-.75s-.75.335-.75.75l-.003 2.525c-1.765-2.836-4.911-4.726-8.495-4.726-4.984 0-9.12 3.654-9.874 8.426z"
                      fillRule="nonzero"
                    />
                  </svg>
                  <span className="text-purple-400 text-xs mt-1 font-medium">
                    Recreate
                  </span>
                </button>

                {/* Share Button */}
                <button
                  onClick={handleShare}
                  className="group relative flex flex-col items-center justify-center py-4 px-3 rounded-xl transition-all duration-300 hover:scale-105"
                  style={{
                    background: "rgba(59, 130, 246, 0.1)",
                    border: "2px solid rgba(59, 130, 246, 0.3)",
                    backdropFilter: "blur(10px)",
                  }}
                >
                  <svg
                    width="28"
                    height="28"
                    viewBox="0 0 24 24"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="currentColor"
                    className="mb-2 transition-transform group-hover:scale-110"
                  >
                    <path d="M5 9c1.654 0 3 1.346 3 3s-1.346 3-3 3-3-1.346-3-3 1.346-3 3-3zm0-2c-2.762 0-5 2.239-5 5s2.238 5 5 5 5-2.239 5-5-2.238-5-5-5zm15 9c-1.165 0-2.204.506-2.935 1.301l-5.488-2.927c-.23.636-.549 1.229-.944 1.764l5.488 2.927c-.072.301-.121.611-.121.935 0 2.209 1.791 4 4 4s4-1.791 4-4-1.791-4-4-4zm0 6c-1.103 0-2-.897-2-2s.897-2 2-2 2 .897 2 2-.897 2-2 2zm0-22c-2.209 0-4 1.791-4 4 0 .324.049.634.121.935l-5.488 2.927c.395.536.713 1.128.944 1.764l5.488-2.927c.731.795 1.77 1.301 2.935 1.301 2.209 0 4-1.791 4-4s-1.791-4-4-4zm0 6c-1.103 0-2-.897-2-2s.897-2 2-2 2 .897 2 2-.897 2-2 2z" />
                  </svg>
                  <span className="text-blue-400 text-xs mt-1 font-medium">
                    Share
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

/** --- Feed Page --- */
export default function FeedPage() {
  const [videos] = useState(() => generateMockVideos(10));
  const [loading, setLoading] = useState(true);
  const [currentVideoIndex, setCurrentVideoIndex] = useState(0);
  const videoRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 1500);
    return () => clearTimeout(timer);
  }, []);

  /** Track which video is currently in view using Intersection Observer */
  useEffect(() => {
    const observers: IntersectionObserver[] = [];

    videoRefs.current.forEach((ref, index) => {
      if (!ref) return;

      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            // When a video is more than 50% visible, mark it as current
            if (entry.isIntersecting && entry.intersectionRatio > 0.5) {
              setCurrentVideoIndex(index);
            }
          });
        },
        { threshold: [0.5, 0.75] }
      );

      observer.observe(ref);
      observers.push(observer);
    });

    return () => {
      observers.forEach((observer) => observer.disconnect());
    };
  }, [videos]);

  const handleRecreate = (videoId: string) => {
    alert(`Recreating video: ${videoId}`);
  };

  if (loading) return <Loader message="Loading feed..." />;

  return (
    <div className="min-h-screen overflow-y-auto bg-[#1A1423] text-white pb-24 md:pb-0">
      {videos.map((video, index) => {
        // Current video is in view
        const isInView = currentVideoIndex === index;
        // Preload next 2 videos after current one
        const shouldPreload =
          index > currentVideoIndex && index <= currentVideoIndex + 2;

        return (
          <div
            key={video.id}
            ref={(el) => {
              videoRefs.current[index] = el;
            }}
          >
            <FeedVideoCard
              video={video}
              index={index}
              onRecreate={handleRecreate}
              isInView={isInView}
              shouldPreload={shouldPreload}
            />
          </div>
        );
      })}
      <div className="min-h-[60vh] flex flex-col items-center justify-center">
        <div className="text-5xl mb-4">🎉</div>
        <p>End of feed</p>
        <button
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          className="mt-4 px-4 py-2 bg-purple-600 rounded"
        >
          ↑ Back to Top
        </button>
      </div>
    </div>
  );
}
