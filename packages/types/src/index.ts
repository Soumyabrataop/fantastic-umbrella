/**
 * Auto-generated TypeScript types from Python Pydantic models
 * DO NOT EDIT MANUALLY - Run `pnpm generate` in packages/types to regenerate
 */

// Enums
export type VideoStatus = 'pending' | 'generating' | 'completed' | 'failed';
export type AssetType = 'video' | 'thumbnail';
export type ReactionType = 'like' | 'dislike';

export interface VideoRead {
  id: string;
  userId: string;
  username?: any | null;
  prompt: string;
  videoUrl?: string | null;
  thumbnailUrl?: any | null;
  likes?: number | null;
  dislikes?: number | null;
  views?: number | null;
  createdAt: string;
  status: VideoStatus;
  rankingScore?: any | null;
  assets?: Array<VideoAssetRead> | null;
  googleDriveFileId?: any | null;
  r2VideoUrl?: any | null;
}

export interface VideoCreateRequest {
  prompt: string;
  aspectRatio?: any | null;
  videoModelKey?: any | null;
  seed?: any | null;
  sceneId?: any | null;
  sourceVideoId?: any | null;
}

export interface ProfileRead {
  id: string;
  username?: any | null;
  email?: any | null;
  avatarUrl?: any | null;
  bio?: any | null;
  videosCreated?: number | null;
  totalLikes?: number | null;
  totalDislikes?: number | null;
  lastActiveAt?: any | null;
  createdAt: string;
}

export interface ProfileUpdateRequest {
  username?: any | null;
  avatarUrl?: any | null;
  bio?: any | null;
}

export interface VideoAssetRead {
  id: string;
  assetType: AssetType;
  storageBackend: string;
  storageKey?: any | null;
  filePath?: any | null;
  publicUrl?: any | null;
  sourceUrl?: any | null;
  durationSeconds?: any | null;
  createdAt: string;
  updatedAt: string;
}

export interface FeedResponse {
  videos: Array<VideoRead>;
  nextCursor?: any | null;
  hasMore: boolean;
}

export interface ReactionResponse {
  videoId: string;
  reaction: ReactionType;
  likes: number;
  dislikes: number;
}

export interface TrackViewResponse {
  videoId: string;
  views: number;
}

export interface GenerateVideoRequest {
  prompt: string;
  aspectRatio?: any | null;
  seed?: any | null;
  videoModelKey?: any | null;
  sceneId?: any | null;
}

export interface GenerateVideoResponse {
  operationName: string;
  rawResponse: Record<string, any>;
}

export interface CheckVideoStatusRequest {
  operationName: string;
  sceneId: string;
  status?: any | null;
}

export interface CheckVideoStatusResponse {
  rawResponse: Record<string, any>;
}
