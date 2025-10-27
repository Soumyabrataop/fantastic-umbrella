import axios from "axios";

// Backend API base URL - replace with your Cloud Run URL
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

// Add auth token to requests if available
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("supabase.auth.token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Types
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
  ranking_score?: number;
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
