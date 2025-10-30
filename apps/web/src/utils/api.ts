import axios from "axios";
import { supabase, hasSupabaseCredentials } from "@/lib/supabase";

const DEFAULT_API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const PROXY_BASE_PATH = process.env.NEXT_PUBLIC_API_PROXY_PATH || "/api/backend";
const isBrowser = typeof window !== "undefined";
const API_BASE_URL = isBrowser ? PROXY_BASE_PATH : DEFAULT_API_BASE_URL;

const ABSOLUTE_URL_REGEX = /^https?:\/\//i;
const BLOB_URL_REGEX = /^(blob:|data:)/i;

const SUPABASE_STORAGE_KEY = "supabase.auth.token";
let cachedAccessToken: string | undefined;

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

function extractTokenFromStorage(raw: string | null): string | undefined {
  if (!raw) {
    return undefined;
  }

  if (raw.startsWith("eyJ")) {
    return raw;
  }

  try {
    const parsed = JSON.parse(raw);
    return (
      parsed?.currentSession?.access_token ||
      parsed?.session?.access_token ||
      parsed?.access_token ||
      parsed?.data?.session?.access_token ||
      parsed?.data?.access_token ||
      parsed?.currentSession?.accessToken
    );
  } catch (error) {
    // Ignore JSON parse errors – we'll try other strategies next.
    return undefined;
  }
}

async function resolveAccessToken(): Promise<string | undefined> {
  if (typeof window === "undefined") {
    return undefined;
  }

  const storedToken = window.localStorage.getItem(SUPABASE_STORAGE_KEY);
  const fromStorage = extractTokenFromStorage(storedToken);
  if (fromStorage) {
    return fromStorage;
  }

  if (!hasSupabaseCredentials) {
    return undefined;
  }

  try {
    const { data, error } = await supabase.auth.getSession();
    if (error) {
      console.warn("Failed to retrieve Supabase session", error);
      return undefined;
    }
    return data.session?.access_token ?? undefined;
  } catch (error) {
    console.warn("Error retrieving Supabase session", error);
    return undefined;
  }
}

export function setApiAccessToken(token: string | undefined) {
  cachedAccessToken = token;
  if (token) {
    api.defaults.headers.common.Authorization = `Bearer ${token}`;
  } else {
    delete api.defaults.headers.common.Authorization;
  }
}

function normalizePath(path: string): string {
  if (!path) {
    return "";
  }
  return path.startsWith("/") ? path : `/${path}`;
}

export function buildApiUrl(path: string): string {
  const targetBase = isBrowser ? PROXY_BASE_PATH : DEFAULT_API_BASE_URL;
  const base = targetBase.endsWith("/") && targetBase !== "/"
    ? targetBase.slice(0, -1)
    : targetBase;
  const normalizedPath = normalizePath(path);
  return `${base}${normalizedPath}`;
}

export function resolveMediaUrl(url?: string | null): string | undefined {
  if (!url) {
    return undefined;
  }

  if (ABSOLUTE_URL_REGEX.test(url) || BLOB_URL_REGEX.test(url)) {
    return url;
  }

  return buildApiUrl(url);
}

export function getPreferredVideoUrl(video: Video): string | undefined {
  const videoAsset = video.assets?.find((asset) => asset.assetType === "video");
  const candidates = [
    video.videoUrl,
    videoAsset?.publicUrl,
    videoAsset?.filePath,
    videoAsset?.sourceUrl,
  ];

  for (const candidate of candidates) {
    const resolved = resolveMediaUrl(candidate);
    if (resolved) {
      return resolved;
    }
  }

  return undefined;
}

export function getPreferredThumbnailUrl(video: Video): string | undefined {
  const thumbnailAsset = video.assets?.find((asset) => asset.assetType === "thumbnail");
  const candidates = [
    video.thumbnailUrl,
    thumbnailAsset?.publicUrl,
    thumbnailAsset?.filePath,
    thumbnailAsset?.sourceUrl,
  ];

  for (const candidate of candidates) {
    const resolved = resolveMediaUrl(candidate);
    if (resolved) {
      return resolved;
    }
  }

  return undefined;
}

// Add auth token to requests if available
api.interceptors.request.use(async (config) => {
  if (typeof window === "undefined") {
    return config;
  }

  let accessToken = cachedAccessToken;

  if (!accessToken) {
    accessToken = await resolveAccessToken();
    if (accessToken) {
      setApiAccessToken(accessToken);
    }
  }

  if (accessToken) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${accessToken}`;
  }

  return config;
});

// Types
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
  durationSeconds?: number;
  assets?: VideoAsset[];
}

export interface CreateVideoRequest {
  prompt: string;
}

export interface VideoActionRequest {
  videoId: string;
  action: "like" | "dislike" | "view";
}

export interface FeedResponse {
  videos: Video[];
  nextCursor?: string;
  hasMore: boolean;
}

export interface UserProfile {
  id: string;
  username: string;
  email: string;
  videosCreated: number;
  totalLikes: number;
  totalDislikes?: number;
  lastActiveAt?: string;
  createdAt: string;
}

export interface CreatorStats {
  totalVideos: number;
  totalLikes: number;
  totalDislikes: number;
  lastActiveHours: number;
  creatorScore?: number;
}

// API Functions
export const videoAPI = {
  // Get video feed with infinite scroll
  getFeed: async (
    cursor?: string,
    limit: number = 10
  ): Promise<FeedResponse> => {
    const params = new URLSearchParams();
    if (cursor) params.append("cursor", cursor);
    params.append("limit", limit.toString());

    const response = await api.get(`/videos/feed?${params.toString()}`);
    return response.data;
  },

  // Get single video
  getVideo: async (videoId: string): Promise<Video> => {
    const response = await api.get(`/videos/${videoId}`);
    return response.data;
  },

  // Create new video
  createVideo: async (data: CreateVideoRequest): Promise<Video> => {
    const response = await api.post("/videos/create", data);
    return response.data;
  },

  // Like/Dislike video
  likeVideo: async (videoId: string): Promise<void> => {
    await api.post(`/videos/${videoId}/like`);
  },

  dislikeVideo: async (videoId: string): Promise<void> => {
    await api.post(`/videos/${videoId}/dislike`);
  },

  // Track video view
  trackView: async (videoId: string): Promise<void> => {
    await api.post(`/videos/${videoId}/view`);
  },

  // Recreate video with same prompt
  recreateVideo: async (videoId: string): Promise<Video> => {
    const response = await api.post(`/videos/${videoId}/recreate`);
    return response.data;
  },

  // Sync latest status from Flow/queue
  syncVideoStatus: async (videoId: string): Promise<Video> => {
    const response = await api.post(`/videos/${videoId}/sync-status`);
    return response.data;
  },

  // Get user's videos
  getUserVideos: async (userId: string): Promise<Video[]> => {
    const response = await api.get(`/users/${userId}/videos`);
    return response.data;
  },

  // Get user's liked videos
  getLikedVideos: async (userId: string): Promise<Video[]> => {
    const response = await api.get(`/users/${userId}/liked`);
    return response.data;
  },
};

export const userAPI = {
  // Get user profile
  getProfile: async (userId: string): Promise<UserProfile> => {
    const response = await api.get(`/users/${userId}`);
    return response.data;
  },

  // Update user profile
  updateProfile: async (
    userId: string,
    data: Partial<UserProfile>
  ): Promise<UserProfile> => {
    const response = await api.patch(`/users/${userId}`, data);
    return response.data;
  },
};

export default api;
