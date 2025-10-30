"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import { Video, getPreferredVideoUrl, getPreferredThumbnailUrl } from "@/utils/api";
import { formatViews, formatTimeAgo } from "@/utils/ranking";
import { useVideoActions } from "@/hooks/useVideoActions";

interface VideoCardProps {
  video: Video;
  onRecreate?: (videoId: string) => void;
}

export default function VideoCard({ video, onRecreate }: VideoCardProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const { likeVideo, dislikeVideo, trackView } = useVideoActions();
  const videoSrc = getPreferredVideoUrl(video) ?? video.videoUrl;
  const thumbnailSrc = getPreferredThumbnailUrl(video) ?? video.thumbnailUrl;
  const hasTrackedViewRef = useRef(false);

  const playVideo = useCallback(() => {
    if (!videoRef.current) {
      return;
    }

    const element = videoRef.current;
    const playPromise = element.play();

    if (playPromise !== undefined) {
      playPromise
        .then(() => {
          setIsPlaying(true);
        })
        .catch((error) => {
          console.log("Auto-play prevented:", error);
          setIsPlaying(false);
        });
    }
  }, []);

  const pauseVideo = useCallback(() => {
    if (!videoRef.current) {
      return;
    }

    videoRef.current.pause();
    setIsPlaying(false);
  }, []);

  const handleVideoClick = () => {
    if (!videoRef.current) {
      return;
    }

    if (isPlaying) {
      pauseVideo();
    } else {
      videoRef.current.muted = false;
      setIsMuted(false);
      playVideo();
    }
  };

  useEffect(() => {
    hasTrackedViewRef.current = false;
    setIsMuted(true);
    setIsPlaying(false);

    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.currentTime = 0;
      videoRef.current.muted = true;
    }
  }, [video.id]);

  // Track view when video is in viewport
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          if (!hasTrackedViewRef.current && video.status === "completed" && videoSrc) {
            hasTrackedViewRef.current = true;
            trackView.mutate(video.id, {
              onError: () => {
                hasTrackedViewRef.current = false;
              },
            });
          }

          if (videoRef.current) {
            videoRef.current.muted = isMuted;
          }

          if (video.status === "completed" && videoSrc) {
            playVideo();
          }
        } else {
          if (videoRef.current && !videoRef.current.paused) {
            pauseVideo();
          }
        }
      },
      { threshold: 0.5 }
    );

    if (videoRef.current) {
      observer.observe(videoRef.current);
    }

    return () => observer.disconnect();
  }, [video.id, trackView, video.status, videoSrc, pauseVideo, playVideo, isMuted]);

  useEffect(() => {
    return () => {
      pauseVideo();
    };
  }, [pauseVideo]);

  const handleLike = () => {
    likeVideo.mutate(video.id);
  };

  const handleDislike = () => {
    dislikeVideo.mutate(video.id);
  };

  const handleRecreate = () => {
    if (onRecreate) {
      onRecreate(video.id);
    }
  };

  return (
    <div className="retro-card overflow-hidden mb-6 max-w-md mx-auto relative">
      {/* Scanlines overlay */}
      <div
        className="absolute inset-0 pointer-events-none z-10"
        style={{
          background:
            "repeating-linear-gradient(0deg, rgba(0, 0, 0, 0.15), rgba(0, 0, 0, 0.15) 1px, transparent 1px, transparent 2px)",
        }}
      ></div>

      {/* Video Player */}
      <div className="relative aspect-9/16 bg-[#0D0221] border-4 border-[#9D4EDD]">
        {video.status === "completed" && videoSrc ? (
          <video
            ref={videoRef}
            src={videoSrc}
            poster={thumbnailSrc}
            loop
            playsInline
            muted={isMuted}
            preload="metadata"
            className="w-full h-full object-contain"
            style={{ imageRendering: "pixelated" }}
            onError={(e) => {
              console.error("Video failed to load:", videoSrc, e);
            }}
            onClick={handleVideoClick}
            onLoadedData={() => {
              if (video.status === "completed" && videoSrc && isPlaying) {
                playVideo();
              }
            }}
          />
        ) : (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div className="text-[#00F5FF] text-6xl mb-4 retro-glow font-['Press_Start_2P']">
                ▓▓▓
              </div>
              <p className="text-[#FFBE0B] text-xl font-['VT323']">
                {video.status === "pending" && "QUEUE..."}
                {video.status === "processing" && "GENERATING..."}
                {video.status === "failed" && "ERROR!"}
              </p>
            </div>
          </div>
        )}

        {/* Play/Pause Overlay */}
        {video.status === "completed" && !isPlaying && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div
              className="bg-[#240046] border-4 border-[#00F5FF] p-4 pixel-corners"
              style={{
                boxShadow: "0 0 20px rgba(0, 245, 255, 0.5)",
              }}
            >
              <div className="text-[#00F5FF] text-5xl retro-glow">▶</div>
            </div>
          </div>
        )}
      </div>

      {/* Video Info */}
      <div className="p-4 bg-linear-to-b from-[#240046] to-[#3C096C]">
        <div className="mb-3">
          <div className="retro-input p-3 mb-2">
            <p className="text-[#00F5FF] text-lg font-['VT323'] line-clamp-3">
              &gt; {video.prompt}
            </p>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-[#FFBE0B] font-['VT323'] text-base">
              ◉ {video.username || "ANON"}
            </span>
            <span className="text-[#9D4EDD] font-['VT323'] text-base">
              👁 {formatViews(video.views)} • {formatTimeAgo(video.createdAt)}
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2 pt-3 border-t-2 border-[#9D4EDD]">
          {/* Like Button */}
          <button
            onClick={handleLike}
            disabled={likeVideo.isPending}
            className="flex items-center gap-2 hover:bg-[rgba(255,255,255,0.1)] transition-all disabled:opacity-50"
            style={{
              fontFamily: "Google Sans Text",
              fontSize: "0.75rem",
              fontStyle: "normal",
              fontWeight: 500,
              lineHeight: "1rem",
              backdropFilter: "blur(0px) opacity(10%)",
              color: "rgb(255, 255, 255)",
              whiteSpace: "nowrap",
              height: "2rem",
              padding: "0rem 0.875rem 0rem 0.875rem",
              background: "rgba(255, 255, 255, 0.05)",
              borderRadius: "4px",
            }}
          >
            <span className="text-lg">👍</span>
            <span>{video.likes}</span>
          </button>

          {/* Dislike Button */}
          <button
            onClick={handleDislike}
            disabled={dislikeVideo.isPending}
            className="flex items-center gap-2 hover:bg-[rgba(255,255,255,0.1)] transition-all disabled:opacity-50"
            style={{
              fontFamily: "Google Sans Text",
              fontSize: "0.75rem",
              fontStyle: "normal",
              fontWeight: 500,
              lineHeight: "1rem",
              backdropFilter: "blur(0px) opacity(10%)",
              color: "rgb(255, 255, 255)",
              whiteSpace: "nowrap",
              height: "2rem",
              padding: "0rem 0.875rem 0rem 0.875rem",
              background: "rgba(255, 255, 255, 0.05)",
              borderRadius: "4px",
            }}
          >
            <span className="text-lg">👎</span>
            <span>{video.dislikes}</span>
          </button>

          {/* Recreate Button */}
          <button
            onClick={handleRecreate}
            className="flex items-center gap-2 hover:bg-[rgba(255,255,255,0.1)] transition-all"
            style={{
              fontFamily: "Google Sans Text",
              fontSize: "0.75rem",
              fontStyle: "normal",
              fontWeight: 500,
              lineHeight: "1rem",
              backdropFilter: "blur(0px) opacity(10%)",
              color: "rgb(255, 255, 255)",
              whiteSpace: "nowrap",
              height: "2rem",
              padding: "0rem 0.875rem 0rem 0.875rem",
              background: "rgba(255, 255, 255, 0.05)",
              borderRadius: "4px",
            }}
          >
            <span className="text-lg">🔄</span>
            <span>Recreate</span>
          </button>

          {/* Share Button */}
          <button
            onClick={() => {
              navigator.clipboard.writeText(
                `${window.location.origin}/video/${video.id}`
              );
            }}
            className="flex items-center gap-2 hover:bg-[rgba(255,255,255,0.1)] transition-all"
            style={{
              fontFamily: "Google Sans Text",
              fontSize: "0.75rem",
              fontStyle: "normal",
              fontWeight: 500,
              lineHeight: "1rem",
              backdropFilter: "blur(0px) opacity(10%)",
              color: "rgb(255, 255, 255)",
              whiteSpace: "nowrap",
              height: "2rem",
              padding: "0rem 0.875rem 0rem 0.875rem",
              background: "rgba(255, 255, 255, 0.05)",
              borderRadius: "4px",
            }}
          >
            <span className="text-lg">📤</span>
            <span>Share</span>
          </button>
        </div>
      </div>
    </div>
  );
}
