"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { videoAPI, userAPI, Video, UserProfile } from "@/utils/api";
import VideoCard from "@/components/VideoCard";
import { useVideoActions } from "@/hooks/useVideoActions";
import { auth } from "@/lib/supabase";

export default function ProfilePage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"videos" | "liked">("videos");
  const { recreateVideo } = useVideoActions();

  // Redirect to home if not authenticated
  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/");
    }
  }, [user, authLoading, router]);

  // Fetch user profile
  const { data: profile, isLoading: profileLoading } = useQuery<UserProfile>({
    queryKey: ["profile", user?.id],
    queryFn: () => userAPI.getProfile(user!.id),
    enabled: !!user,
  });

  // Fetch user videos
  const { data: userVideos = [], isLoading: videosLoading } = useQuery<Video[]>(
    {
      queryKey: ["userVideos", user?.id],
      queryFn: () => videoAPI.getUserVideos(user!.id),
      enabled: !!user && activeTab === "videos",
    }
  );

  // Fetch liked videos
  const { data: likedVideos = [], isLoading: likedLoading } = useQuery<Video[]>(
    {
      queryKey: ["likedVideos", user?.id],
      queryFn: () => videoAPI.getLikedVideos(user!.id),
      enabled: !!user && activeTab === "liked",
    }
  );

  const handleRecreate = (videoId: string) => {
    recreateVideo.mutate(videoId);
  };

  const handleSignOut = async () => {
    await auth.signOut();
    router.push("/");
  };

  if (authLoading || profileLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  const videos = activeTab === "videos" ? userVideos : likedVideos;
  const isLoading = activeTab === "videos" ? videosLoading : likedLoading;

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-5xl mx-auto px-4 py-4">
          <h1 className="text-2xl font-bold text-gray-900">Profile</h1>
        </div>
      </header>

      {/* Profile Info */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-5xl mx-auto px-4 py-6">
          <div className="flex items-center gap-4 mb-6">
            {/* Avatar */}
            <div className="w-20 h-20 bg-gradient-to-br from-blue-500 via-blue-600 to-purple-600 rounded-full flex items-center justify-center text-white text-2xl font-bold">
              {user.email?.[0].toUpperCase()}
            </div>

            {/* User Info */}
            <div className="flex-1">
              <h2 className="text-xl font-bold text-gray-900 mb-1">
                {profile?.username || user.email?.split("@")[0]}
              </h2>
              <p className="text-gray-600 text-sm">{user.email}</p>
            </div>

            {/* Sign Out Button */}
            <button
              onClick={handleSignOut}
              className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Sign Out
            </button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900">
                {profile?.videosCreated || userVideos.length}
              </div>
              <div className="text-sm text-gray-600">Videos</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900">
                {profile?.totalLikes || 0}
              </div>
              <div className="text-sm text-gray-600">Total Likes</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900">
                {likedVideos.length}
              </div>
              <div className="text-sm text-gray-600">Liked</div>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-gray-200">
            <button
              onClick={() => setActiveTab("videos")}
              className={`flex-1 py-3 text-sm font-medium transition-colors ${
                activeTab === "videos"
                  ? "text-blue-600 border-b-2 border-blue-600"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              My Videos
            </button>
            <button
              onClick={() => setActiveTab("liked")}
              className={`flex-1 py-3 text-sm font-medium transition-colors ${
                activeTab === "liked"
                  ? "text-blue-600 border-b-2 border-blue-600"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              Liked Videos
            </button>
          </div>
        </div>
      </div>

      {/* Videos Grid */}
      <div className="max-w-5xl mx-auto px-4 py-6">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
            <p className="text-gray-600">Loading videos...</p>
          </div>
        ) : videos.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">
              {activeTab === "videos" ? "📹" : "❤️"}
            </div>
            <h2 className="text-2xl font-semibold text-gray-900 mb-2">
              {activeTab === "videos" ? "No videos yet" : "No liked videos"}
            </h2>
            <p className="text-gray-600 mb-6">
              {activeTab === "videos"
                ? "Create your first AI-generated video"
                : "Start liking videos to see them here"}
            </p>
            {activeTab === "videos" && (
              <button
                onClick={() => router.push("/create")}
                className="bg-blue-600 text-white px-6 py-3 rounded-full font-medium hover:bg-blue-700 transition-colors"
              >
                Create Video
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-6">
            {videos.map((video) => (
              <VideoCard
                key={video.id}
                video={video}
                onRecreate={handleRecreate}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
