"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import { videoAPI, Video, FeedResponse } from "@/utils/api";

interface UseFeedOptions {
  adsInterval?: number; // Insert ad every N videos (default: 2)
  enableAds?: boolean; // Enable/disable ads (default: true)
}

export function useFeed(options: UseFeedOptions = {}) {
  const { adsInterval = 2, enableAds = true } = options;

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
    queryKey: ["feed"],
    queryFn: ({ pageParam }: { pageParam?: string }) =>
      videoAPI.getFeed(pageParam, 10),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage: FeedResponse) => {
      return lastPage.hasMore ? lastPage.nextCursor : undefined;
    },
  });

  // Flatten videos from all pages
  const videos = data?.pages.flatMap((page) => page.videos) ?? [];

  // Insert ads based on configuration
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
  interval: number = 2
): (Video | { type: "ad"; id: string; position: number })[] {
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
