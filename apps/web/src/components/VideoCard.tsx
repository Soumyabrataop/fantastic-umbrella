"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import {
  Video,
  getPreferredVideoUrl,
  getPreferredThumbnailUrl,
} from "@/utils/api";
import { formatViews, formatTimeAgo } from "@/utils/ranking";
import { useVideoActions } from "@/hooks/useVideoActions";

interface VideoCardProps {
  video: Video;
  onRecreate?: (videoId: string) => void;
  horizontal?: boolean;
  showActions?: boolean;
}

export default function VideoCard({
  video,
  onRecreate,
  horizontal = false,
  showActions = true,
}: VideoCardProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const { likeVideo, dislikeVideo, trackView } = useVideoActions();
  const videoSrc = getPreferredVideoUrl(video) ?? video.videoUrl;
  const thumbnailSrc = getPreferredThumbnailUrl(video) ?? video.thumbnailUrl;
  const hasTrackedViewRef = useRef(false);

  // Check if this is a Google Drive embed URL
  const isGoogleDriveEmbed =
    videoSrc?.includes("drive.google.com/file/d/") &&
    videoSrc?.includes("/preview");

  const playVideo = useCallback(() => {
    if (!iframeRef.current || !isGoogleDriveEmbed) {
      return;
    }

    // For Google Drive embeds, we need to reload the iframe with autoplay parameter
    const embedUrl = new URL(videoSrc!);
    embedUrl.searchParams.set("autoplay", "1");
    iframeRef.current.src = embedUrl.toString();
    setIsPlaying(true);
  }, [videoSrc, isGoogleDriveEmbed]);

  const pauseVideo = useCallback(() => {
    if (!iframeRef.current || !isGoogleDriveEmbed) {
      return;
    }

    // For Google Drive embeds, we can't directly pause, so we'll reload without autoplay
    const embedUrl = new URL(videoSrc!);
    embedUrl.searchParams.delete("autoplay");
    iframeRef.current.src = embedUrl.toString();
    setIsPlaying(false);
  }, [videoSrc, isGoogleDriveEmbed]);

  const handleVideoClick = () => {
    if (isPlaying) {
      pauseVideo();
    } else {
      playVideo();
    }
  };

  useEffect(() => {
    hasTrackedViewRef.current = false;
    setIsPlaying(false);

    // Reset iframe src when video changes
    if (iframeRef.current && isGoogleDriveEmbed) {
      const embedUrl = new URL(videoSrc!);
      embedUrl.searchParams.delete("autoplay");
      iframeRef.current.src = embedUrl.toString();
    }
  }, [video.id, videoSrc, isGoogleDriveEmbed]);

  // Track view and auto-play when video is in viewport
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          if (
            !hasTrackedViewRef.current &&
            video.status === "completed" &&
            videoSrc
          ) {
            hasTrackedViewRef.current = true;
            trackView.mutate(video.id, {
              onError: () => {
                hasTrackedViewRef.current = false;
              },
            });
          }

          // Auto-play when video comes into view
          if (video.status === "completed" && videoSrc && !isPlaying) {
            playVideo();
          }
        } else {
          // Pause when video goes out of view
          if (isPlaying) {
            pauseVideo();
          }
        }
      },
      { threshold: 0.5 }
    );

    const element = iframeRef.current;
    if (element) {
      observer.observe(element);
    }

    return () => observer.disconnect();
  }, [
    video.id,
    trackView,
    video.status,
    videoSrc,
    pauseVideo,
    playVideo,
    isPlaying,
  ]);

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
    <div
      className={`bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden mb-6 relative shadow-lg ${
        horizontal ? "flex flex-row max-w-full" : "max-w-md mx-auto"
      }`}
    >
      {/* Video Player */}
      <div
        className={`relative bg-black ${
          horizontal ? "w-64 aspect-9/16 shrink-0" : "aspect-9/16"
        }`}
      >
        {video.status === "completed" && videoSrc ? (
          isGoogleDriveEmbed ? (
            <iframe
              ref={iframeRef}
              src={videoSrc}
              width="100%"
              height="100%"
              frameBorder="0"
              allow="autoplay; encrypted-media"
              allowFullScreen
              className="w-full h-full"
              onClick={handleVideoClick}
              onLoad={() => {
                // Track when iframe loads
                console.log("Google Drive video loaded:", videoSrc);
              }}
            />
          ) : (
            // Fallback for non-Google Drive videos (though we shouldn't have any)
            <video
              src={videoSrc}
              poster={thumbnailSrc}
              loop
              playsInline
              muted
              preload="metadata"
              className="w-full h-full object-contain"
              style={{ imageRendering: "pixelated" }}
              onError={(e) => {
                console.error("Video failed to load:", videoSrc, e);
              }}
              onClick={handleVideoClick}
            />
          )
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
        {video.status === "completed" && !isPlaying && isGoogleDriveEmbed && (
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
      <div
        className={`p-4 bg-linear-to-b from-gray-900 to-black ${
          horizontal ? "flex-1 flex flex-col justify-center" : ""
        }`}
      >
        <div className={showActions ? "mb-3" : ""}>
          <p className="text-white text-base mb-3 line-clamp-2">
            {video.prompt}
          </p>
          <div
            className={`flex items-center ${
              horizontal ? "flex-col items-start gap-2" : "justify-between"
            } text-sm`}
          >
            <span className="text-gray-400 font-medium">
              @{video.username || "anonymous"}
            </span>
            <span className="text-gray-500 text-xs">
              {formatViews(video.views)} views •{" "}
              {formatTimeAgo(video.createdAt)}
            </span>
          </div>
        </div>

        {/* Action Buttons - Only show if showActions is true */}
        {showActions && (
          <div
            className={`flex gap-2 pt-3 border-t border-gray-800 ${
              horizontal ? "flex-wrap" : ""
            }`}
          >
            {/* Like Button */}
            <button
              onClick={handleLike}
              disabled={likeVideo.isPending}
              className="flex items-center justify-center gap-1.5 px-3 py-2 bg-gray-800 hover:bg-gray-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
            >
              <span className="text-base">👍</span>
              <span>{video.likes}</span>
            </button>

            {/* Dislike Button */}
            <button
              onClick={handleDislike}
              disabled={dislikeVideo.isPending}
              className="flex items-center justify-center gap-1.5 px-3 py-2 bg-gray-800 hover:bg-gray-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
            >
              <span className="text-base">👎</span>
              <span>{video.dislikes}</span>
            </button>

            {/* Recreate Button */}
            <button
              onClick={handleRecreate}
              className="flex items-center justify-center gap-1.5 px-3 py-2 bg-gray-800 hover:bg-gray-700 text-white text-sm font-medium rounded-lg transition-colors"
            >
              <span className="text-base">🔄</span>
              <span>Recreate</span>
            </button>

            {/* Share Button */}
            <button
              onClick={() => {
                navigator.clipboard.writeText(
                  `${window.location.origin}/video/${video.id}`
                );
              }}
              className="flex items-center justify-center gap-1.5 px-3 py-2 bg-gray-800 hover:bg-gray-700 text-white text-sm font-medium rounded-lg transition-colors"
            >
              <span className="text-base">📤</span>
              <span>Share</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
