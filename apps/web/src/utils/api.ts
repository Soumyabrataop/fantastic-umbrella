import axios from "axios";
import { supabase, hasSupabaseCredentials } from "@/lib/supabase";

const DEFAULT_API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const PROXY_BASE_PATH =
  process.env.NEXT_PUBLIC_API_PROXY_PATH || "/api/backend";
const isBrowser = typeof window !== "undefined";
const API_BASE_URL = isBrowser ? PROXY_BASE_PATH : DEFAULT_API_BASE_URL;

const ABSOLUTE_URL_REGEX = /^https?:\/\//i;
const BLOB_URL_REGEX = /^(blob:|data:)/i;

const SUPABASE_STORAGE_KEY = "supabase.auth.token";
let cachedAccessToken: string | undefined;

// Request signing configuration
const REQUEST_SIGNATURE_SECRET =
  process.env.NEXT_PUBLIC_REQUEST_SIGNATURE_SECRET;
const REQUEST_SIGNATURE_HEADER =
  process.env.NEXT_PUBLIC_REQUEST_SIGNATURE_HEADER || "x-instaveo-signature";
const REQUEST_TIMESTAMP_HEADER =
  process.env.NEXT_PUBLIC_REQUEST_TIMESTAMP_HEADER || "x-instaveo-timestamp";

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

/**
 * Sign a request using HMAC-SHA256 to prevent tampering and replay attacks.
 * @param method HTTP method (GET, POST, PATCH, DELETE, etc.)
 * @param path Request path (e.g., "/videos/create")
 * @param body Request body as string (or null for GET requests)
 * @param timestamp ISO timestamp string
 * @param secret Signing secret key
 * @returns Hex-encoded HMAC signature
 */
async function signRequest(
  method: string,
  path: string,
  body: string | null,
  timestamp: string,
  secret: string
): Promise<string> {
  // Create payload: METHOD|PATH|BODY|TIMESTAMP
  const payload = `${method}|${path}|${body || ""}|${timestamp}`;

  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const messageData = encoder.encode(payload);

  // Import the secret key for HMAC
  const key = await crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  // Generate HMAC signature
  const signature = await crypto.subtle.sign("HMAC", key, messageData);

  // Convert to hex string
  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
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
  const base =
    targetBase.endsWith("/") && targetBase !== "/"
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
  // Match backend logic exactly:
  // 1. For unpublished videos (drafts), use stream endpoint from Google Drive
  // 2. For published videos, use R2 URL if available, otherwise video_url

  if (!video.isPublished && video.googleDriveFileId) {
    return `/api/backend/videos/${video.id}/stream`;
  }

  if (video.r2VideoUrl) {
    return video.r2VideoUrl;
  }

  if (video.videoUrl) {
    return resolveMediaUrl(video.videoUrl);
  }

  // Fallback to assets
  const videoAsset = video.assets?.find((asset) => asset.assetType === "video");
  const candidates = [
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
  const thumbnailAsset = video.assets?.find(
    (asset) => asset.assetType === "thumbnail"
  );
  const candidates = [
    video.thumbnailUrl,
    thumbnailAsset?.publicUrl,
    thumbnailAsset?.filePath,
    thumbnailAsset?.sourceUrl,
  ];

  for (const candidate of candidates) {
    const resolved = resolveMediaUrl(candidate);
    if (resolved) {
      // Convert Google Drive URLs to download format for image display
      if (resolved.includes("drive.google.com")) {
        // Handle embed URLs
        if (resolved.includes("/file/d/") && resolved.includes("/preview")) {
          const match = resolved.match(
            /drive\.google\.com\/file\/d\/([^\/]+)\/preview/
          );
          if (match) {
            return `https://drive.google.com/uc?export=download&id=${match[1]}`;
          }
        }
        // Handle direct access URLs
        if (resolved.includes("uc?id=")) {
          const match = resolved.match(/uc\?id=([^&]+)/);
          if (match) {
            return `https://drive.google.com/uc?export=download&id=${match[1]}`;
          }
        }
        // Already in correct format
        if (resolved.includes("uc?export=download&id=")) {
          return resolved;
        }
      }
      return resolved;
    }
  }

  return undefined;
}

// Add auth token to requests if available
api.interceptors.request.use(
  async (config) => {
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
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Add request signing for mutation requests (POST, PATCH, DELETE)
api.interceptors.request.use(
  async (config) => {
    // Only sign mutation requests in browser environment
    if (typeof window === "undefined") {
      return config;
    }

    // Only sign mutation requests (POST, PATCH, DELETE)
    const method = config.method?.toUpperCase();
    if (!method || !["POST", "PATCH", "DELETE"].includes(method)) {
      return config;
    }

    // Skip signing if no secret is configured
    if (!REQUEST_SIGNATURE_SECRET) {
      console.warn(
        "Request signature secret not configured. Skipping request signing."
      );
      return config;
    }

    try {
      // Generate timestamp
      const timestamp = new Date().toISOString();

      // Get request path (remove base URL if present)
      let path = config.url || "";
      if (path.startsWith(API_BASE_URL)) {
        path = path.substring(API_BASE_URL.length);
      }
      // Ensure path starts with /
      if (!path.startsWith("/")) {
        path = `/${path}`;
      }

      // Serialize request body
      const body = config.data ? JSON.stringify(config.data) : null;

      // Generate signature
      const signature = await signRequest(
        method,
        path,
        body,
        timestamp,
        REQUEST_SIGNATURE_SECRET
      );

      // Add signature and timestamp headers
      config.headers = config.headers || {};
      config.headers[REQUEST_SIGNATURE_HEADER] = signature;
      config.headers[REQUEST_TIMESTAMP_HEADER] = timestamp;
    } catch (error) {
      console.error("Failed to sign request:", error);
      // Continue without signature rather than blocking the request
    }

    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Add response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (typeof window === "undefined") {
      return Promise.reject(error);
    }

    // Handle network errors
    if (!error.response) {
      console.error("Network error:", error.message);
      return Promise.reject({
        type: "network",
        message: "Network error. Please check your connection and try again.",
        originalError: error,
      });
    }

    const status = error.response.status;
    const data = error.response.data;

    // Handle 401 Unauthorized - redirect to login
    if (status === 401) {
      console.warn("Unauthorized request, redirecting to login");
      // Clear cached token
      setApiAccessToken(undefined);
      if (typeof window !== "undefined") {
        window.localStorage.removeItem(SUPABASE_STORAGE_KEY);
        // Redirect to auth page
        window.location.href = "/auth";
      }
      return Promise.reject({
        type: "auth",
        status: 401,
        message: "Your session has expired. Please log in again.",
        originalError: error,
      });
    }

    // Handle 429 Rate Limit
    if (status === 429) {
      const retryAfter = error.response.headers["retry-after"];
      const waitSeconds = retryAfter ? parseInt(retryAfter, 10) : 60;
      return Promise.reject({
        type: "rate_limit",
        status: 429,
        message:
          data?.detail ||
          `Rate limit exceeded. Please wait ${waitSeconds} seconds.`,
        retryAfter: waitSeconds,
        originalError: error,
      });
    }

    // Handle 403 Forbidden
    if (status === 403) {
      return Promise.reject({
        type: "forbidden",
        status: 403,
        message:
          data?.detail || "You don't have permission to perform this action.",
        originalError: error,
      });
    }

    // Handle 404 Not Found
    if (status === 404) {
      return Promise.reject({
        type: "not_found",
        status: 404,
        message: data?.detail || "The requested resource was not found.",
        originalError: error,
      });
    }

    // Handle 500+ Server Errors
    if (status >= 500) {
      return Promise.reject({
        type: "server",
        status,
        message: data?.detail || "Server error. Please try again later.",
        originalError: error,
      });
    }

    // Handle other client errors (400-499)
    if (status >= 400 && status < 500) {
      return Promise.reject({
        type: "client",
        status,
        message:
          data?.detail ||
          data?.message ||
          "An error occurred. Please try again.",
        originalError: error,
      });
    }

    // Default error
    return Promise.reject({
      type: "unknown",
      status,
      message: "An unexpected error occurred.",
      originalError: error,
    });
  }
);

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
  isPublished: boolean; // Whether video is published to R2
  assets?: VideoAsset[];
  googleDriveFileId?: string; // Google Drive file ID for videos stored in Drive
  r2VideoUrl?: string; // Cloudflare R2 URL for published videos
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
  username: string | null;
  email: string | null;
  videosCreated: number;
  totalLikes: number;
  totalDislikes?: number;
  enterprise: boolean; // Only enterprise users can create videos
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

  // Publish video (make it visible in feed)
  publishVideo: async (videoId: string): Promise<Video> => {
    const response = await api.post(`/videos/${videoId}/publish`);
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
