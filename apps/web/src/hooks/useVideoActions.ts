"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { videoAPI, Video } from "@/utils/api";
import { useAuth } from "./useAuth";
import { toast } from "@/utils/toast";

export function useVideoActions() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const likeVideo = useMutation({
    mutationFn: (videoId: string) => {
      if (!user) throw new Error("You must be logged in to like videos");
      return videoAPI.likeVideo(videoId);
    },
    onSuccess: () => {
      // Invalidate feed to refetch with updated data
      queryClient.invalidateQueries({ queryKey: ["feed"] });
    },
    onError: (error: any) => {
      console.error("Failed to like video:", error);
      if (error?.type === "auth") {
        // Auth errors are handled by interceptor (redirect to login)
        return;
      }
      if (error?.type === "rate_limit") {
        toast.error(
          `Rate limit exceeded. Please wait ${error.retryAfter || 60} seconds.`
        );
        return;
      }
      toast.error(error?.message || "Failed to like video. Please try again.");
    },
  });

  const dislikeVideo = useMutation({
    mutationFn: (videoId: string) => {
      if (!user) throw new Error("You must be logged in to dislike videos");
      return videoAPI.dislikeVideo(videoId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["feed"] });
    },
    onError: (error: any) => {
      console.error("Failed to dislike video:", error);
      if (error?.type === "auth") {
        return;
      }
      if (error?.type === "rate_limit") {
        toast.error(
          `Rate limit exceeded. Please wait ${error.retryAfter || 60} seconds.`
        );
        return;
      }
      toast.error(
        error?.message || "Failed to dislike video. Please try again."
      );
    },
  });

  const trackView = useMutation({
    mutationFn: (videoId: string) => videoAPI.trackView(videoId),
    // Silent - no toast notification for views
    onError: (error: any) => {
      console.error("Failed to track view:", error);
    },
  });

  const recreateVideo = useMutation({
    mutationFn: (videoId: string) => {
      if (!user) throw new Error("You must be logged in to recreate videos");
      return videoAPI.recreateVideo(videoId);
    },
    onSuccess: () => {
      toast.success("Video recreation started!");
      queryClient.invalidateQueries({ queryKey: ["feed"] });
      queryClient.invalidateQueries({ queryKey: ["userVideos"] });
    },
    onError: (error: any) => {
      console.error("Failed to recreate video:", error);
      if (error?.type === "auth") {
        return;
      }
      if (error?.type === "rate_limit") {
        toast.error(
          `Rate limit exceeded. Please wait ${error.retryAfter || 60} seconds.`
        );
        return;
      }
      toast.error(
        error?.message || "Failed to recreate video. Please try again."
      );
    },
  });

  const createVideo = useMutation({
    mutationFn: (prompt: string) => {
      if (!user) throw new Error("You must be logged in to create videos");
      return videoAPI.createVideo({ prompt });
    },
    onSuccess: (video: Video) => {
      toast.success("Video generation started!");
      queryClient.invalidateQueries({ queryKey: ["feed"] });
      queryClient.invalidateQueries({ queryKey: ["userVideos"] });
      return video;
    },
    onError: (error: any) => {
      console.error("Failed to create video:", error);
      if (error?.type === "auth") {
        return;
      }
      if (error?.type === "rate_limit") {
        toast.error(
          `Rate limit exceeded. Please wait ${error.retryAfter || 60} seconds.`
        );
        return;
      }
      if (error?.type === "network") {
        toast.error(
          "Network error. Please check your connection and try again."
        );
        return;
      }
      toast.error(
        error?.message || "Failed to create video. Please try again."
      );
    },
  });

  const shareVideo = useMutation({
    mutationFn: async (videoId: string) => {
      if (!user) throw new Error("You must be logged in to share videos");

      // Share using Web Share API if available
      if (navigator.share) {
        await navigator.share({
          title: "Check out this video on ZAPP!",
          text: "Amazing AI-generated video",
          url: `${window.location.origin}/video/${videoId}`,
        });
      } else {
        // Fallback: copy to clipboard
        await navigator.clipboard.writeText(
          `${window.location.origin}/video/${videoId}`
        );
        throw new Error("Link copied to clipboard!");
      }
    },
    onSuccess: () => {
      toast.success("Video shared successfully!");
    },
    onError: (error: any) => {
      if (error?.message?.includes("clipboard")) {
        toast.info(error.message);
      } else {
        toast.error("Failed to share video");
      }
    },
  });

  return {
    likeVideo,
    dislikeVideo,
    trackView,
    recreateVideo,
    createVideo,
    shareVideo,
  };
}
