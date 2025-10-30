"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { videoAPI } from "@/utils/api";
import { useAuth } from "./useAuth";

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
      console.log("Video liked!");
    },
    onError: (error: any) => {
      console.error(error?.message || "Failed to like video");
    },
  });

  const dislikeVideo = useMutation({
    mutationFn: (videoId: string) => {
      if (!user) throw new Error("You must be logged in to dislike videos");
      return videoAPI.dislikeVideo(videoId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["feed"] });
      console.log("Video disliked");
    },
    onError: (error: any) => {
      console.error(error?.message || "Failed to dislike video");
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
      console.log("Video recreation started!");
      queryClient.invalidateQueries({ queryKey: ["feed"] });
      queryClient.invalidateQueries({ queryKey: ["userVideos"] });
    },
    onError: (error: any) => {
      console.error(error?.message || "Failed to recreate video");
    },
  });

  const createVideo = useMutation({
    mutationFn: (prompt: string) => {
      if (!user) throw new Error("You must be logged in to create videos");
      return videoAPI.createVideo({ prompt });
    },
    onSuccess: () => {
      console.log("Video generation started!");
      queryClient.invalidateQueries({ queryKey: ["feed"] });
      queryClient.invalidateQueries({ queryKey: ["userVideos"] });
    },
    onError: (error: any) => {
      console.error(error?.message || "Failed to create video");
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
      console.log("Video shared successfully!");
    },
    onError: (error: any) => {
      if (error?.message?.includes("clipboard")) {
        console.log(error.message);
      } else {
        console.error("Failed to share video");
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
