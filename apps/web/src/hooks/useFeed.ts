"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import { videoAPI, Video, FeedResponse } from "@/utils/api";
import { useAuth } from "./useAuth";

interface UseFeedOptions {
  adsInterval?: number; // Insert ad every N videos (default: disabled)
  enableAds?: boolean; // Enable/disable ads (default: false)
  limit?: number; // Videos per page (default: 10)
}

export function useFeed(options: UseFeedOptions = {}) {
  const { adsInterval = 5, enableAds = false, limit = 10 } = options;
  const { user } = useAuth();

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    error,
    refetch,
  } = useInfiniteQuery<
    FeedResponse,
    Error,
    { pages: FeedResponse[]; pageParams: (string | undefined)[] },
    string[],
    string | undefined
  >({
    queryKey: user?.id ? ["feed", user.id] : ["feed"],
    queryFn: async ({ pageParam }: { pageParam?: string }) => {
      try {
        return await videoAPI.getFeed(pageParam, limit);
      } catch (err: any) {
        // Handle auth errors by redirecting (handled by interceptor)
        if (err?.type === "auth") {
          throw err;
        }
        // Re-throw other errors for React Query to handle
        throw err;
      }
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage: FeedResponse) => {
      return lastPage.hasMore ? lastPage.nextCursor : undefined;
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
    retry: (failureCount, error: any) => {
      // Don't retry on auth errors
      if (error?.type === "auth" || error?.status === 401) {
        return false;
      }
      // Retry network errors up to 2 times
      if (error?.type === "network") {
        return failureCount < 2;
      }
      // Don't retry client errors (400-499)
      if (error?.status >= 400 && error?.status < 500) {
        return false;
      }
      // Retry server errors up to 3 times
      return failureCount < 3;
    },
  });

  // Flatten videos from all pages
  const videos = data?.pages.flatMap((page) => page.videos) ?? [];

  // Insert ads based on configuration (disabled by default)
  const feedWithAds = enableAds ? insertAds(videos, adsInterval) : videos;

  return {
    videos: feedWithAds,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    error,
    refetch,
  };
}

// Helper function to insert ads into video feed
function insertAds(
  videos: Video[],
  interval: number = 5
): (Video | { type: "ad"; id: string; position: number })[] {
  if (!interval || interval <= 0) return videos;

  const feed: (Video | { type: "ad"; id: string; position: number })[] = [];

  videos.forEach((video, index) => {
    feed.push(video);

    // Insert ad every N videos
    if ((index + 1) % interval === 0 && index < videos.length - 1) {
      feed.push({
        type: "ad",
        id: `ad-${index}`,
        position: Math.floor(index / interval),
      });
    }
  });

  return feed;
}

// Type guard to check if item is a video
export function isVideo(item: any): item is Video {
  return item && !item.type;
}

// Type guard to check if item is an ad
export function isAd(
  item: any
): item is { type: "ad"; id: string; position: number } {
  return item && item.type === "ad";
}
