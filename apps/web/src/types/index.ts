// Global type definitions for the app

export interface Video {
  id: string;
  prompt: string;
  videoUrl: string;
  thumbnailUrl?: string;
  userId: string;
  username?: string;
  likes: number;
  dislikes: number;
  views: number;
  createdAt: string;
  status: "pending" | "processing" | "completed" | "failed";
  rankingScore?: number;
  ranking_score?: number; // legacy fallback until all clients migrate
  durationSeconds?: number;
  assets?: VideoAsset[];
}

export interface VideoAsset {
  id: string;
  assetType: "video" | "thumbnail";
  storageBackend: string;
  storageKey?: string | null;
  filePath?: string | null;
  publicUrl?: string | null;
  sourceUrl?: string | null;
  durationSeconds?: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface UserProfile {
  id: string;
  username: string;
  email: string;
  videosCreated: number;
  totalLikes: number;
  createdAt: string;
}

export interface FeedResponse {
  videos: Video[];
  nextCursor?: string;
  hasMore: boolean;
}

export interface CreateVideoRequest {
  prompt: string;
}

export interface VideoActionRequest {
  videoId: string;
  action: "like" | "dislike" | "view";
}

export interface APIError {
  message: string;
  statusCode?: number;
  error?: string;
}

// Feed item can be either a video or an ad
export type FeedItem = Video | AdItem;

export interface AdItem {
  type: "ad";
  id: string;
  position: number;
}

// Type guards
export function isVideo(item: FeedItem): item is Video {
  return !("type" in item) || item.type !== "ad";
}

export function isAd(item: FeedItem): item is AdItem {
  return "type" in item && item.type === "ad";
}
