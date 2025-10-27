"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { videoAPI } from "@/utils/api";
import { toast } from "./useToast";

export function useVideoActions() {
  const queryClient = useQueryClient();

  const likeVideo = useMutation({
    mutationFn: (videoId: string) => videoAPI.likeVideo(videoId),
    onSuccess: () => {
      // Invalidate feed to refetch with updated data
      queryClient.invalidateQueries({ queryKey: ["feed"] });
      toast.success("Video liked!");
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || "Failed to like video");
    },
  });

  const dislikeVideo = useMutation({
    mutationFn: (videoId: string) => videoAPI.dislikeVideo(videoId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["feed"] });
      toast.success("Video disliked");
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || "Failed to dislike video");
    },
  });

  const trackView = useMutation({
    mutationFn: (videoId: string) => videoAPI.trackView(videoId),
    // Silent - no toast notification for views
  });

  const recreateVideo = useMutation({
    mutationFn: (videoId: string) => videoAPI.recreateVideo(videoId),
    onSuccess: () => {
      toast.success("Video recreation started!");
      queryClient.invalidateQueries({ queryKey: ["feed"] });
      queryClient.invalidateQueries({ queryKey: ["userVideos"] });
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || "Failed to recreate video");
    },
  });

  const createVideo = useMutation({
    mutationFn: (prompt: string) => videoAPI.createVideo({ prompt }),
    onSuccess: () => {
      toast.success("Video generation started!");
      queryClient.invalidateQueries({ queryKey: ["feed"] });
      queryClient.invalidateQueries({ queryKey: ["userVideos"] });
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || "Failed to create video");
    },
  });

  return {
    likeVideo,
    dislikeVideo,
    trackView,
    recreateVideo,
    createVideo,
  };
}
