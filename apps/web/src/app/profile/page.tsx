"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { videoAPI, userAPI, Video, UserProfile } from "@/utils/api";
import VideoCard from "@/components/VideoCard";
import { useVideoActions } from "@/hooks/useVideoActions";
import Loader from "@/components/Loader";

export default function ProfilePage() {
  const { user, loading: authLoading, signOut } = useAuth();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"videos" | "liked">("videos");
  const { recreateVideo } = useVideoActions();

  // Redirect to auth if not authenticated
  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/auth");
    }
  }, [user, authLoading, router]);

  // Fetch user profile from /users/:id endpoint
  const {
    data: profile,
    isLoading: profileLoading,
    error: profileError,
    refetch: refetchProfile,
  } = useQuery<UserProfile>({
    queryKey: ["profile", user?.id],
    queryFn: () => userAPI.getProfile(user!.id),
    enabled: !!user,
    retry: 2,
  });

  // Fetch user videos from /users/:id/videos endpoint
  const {
    data: userVideos = [],
    isLoading: videosLoading,
    error: videosError,
    refetch: refetchVideos,
  } = useQuery<Video[]>({
    queryKey: ["userVideos", user?.id],
    queryFn: () => videoAPI.getUserVideos(user!.id),
    enabled: !!user && activeTab === "videos",
    retry: 2,
  });

  // Fetch liked videos from /users/:id/liked endpoint
  const {
    data: likedVideos = [],
    isLoading: likedLoading,
    error: likedError,
    refetch: refetchLiked,
  } = useQuery<Video[]>({
    queryKey: ["likedVideos", user?.id],
    queryFn: () => videoAPI.getLikedVideos(user!.id),
    enabled: !!user && activeTab === "liked",
    retry: 2,
  });

  const handleRecreate = (videoId: string) => {
    recreateVideo.mutate(videoId);
  };

  const handleSignOut = () => {
    signOut();
  };

  // Handle loading states
  if (authLoading || profileLoading) {
    return <Loader message="LOADING PROFILE..." />;
  }

  if (!user) {
    return null;
  }

  // Handle error states
  const currentError = activeTab === "videos" ? videosError : likedError;
  const currentRefetch = activeTab === "videos" ? refetchVideos : refetchLiked;

  const videos = activeTab === "videos" ? userVideos : likedVideos;
  const isLoading = activeTab === "videos" ? videosLoading : likedLoading;

  return (
    <div className="min-h-screen bg-black pb-24">
      {/* Header */}
      <header className="bg-gradient-to-r from-gray-900 to-black border-b border-gray-800 sticky top-0 z-40 backdrop-blur-xl">
        <div className="max-w-5xl mx-auto px-6 py-6">
          <h1 className="text-3xl font-bold text-white">Profile</h1>
        </div>
      </header>

      {/* Profile Info */}
      <div className="bg-gradient-to-b from-gray-900 to-black border-b border-gray-800 relative">
        <div className="max-w-5xl mx-auto px-4 py-6">
          {/* Profile Error State */}
          {profileError ? (
            <div className="text-center py-12">
              <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 max-w-md mx-auto">
                <div className="text-6xl mb-4">⚠️</div>
                <h2 className="text-xl font-bold text-red-500 mb-3">
                  Error Loading Profile
                </h2>
                <p className="text-gray-400 text-sm mb-6">
                  {profileError instanceof Error
                    ? profileError.message
                    : "Failed to load profile"}
                </p>
                <button
                  onClick={() => refetchProfile()}
                  className="px-6 py-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg font-medium hover:shadow-lg hover:shadow-purple-500/50 transition-all"
                >
                  Retry
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="flex flex-col md:flex-row items-center gap-6 mb-8">
                {/* Avatar */}
                <div className="w-24 h-24 bg-gradient-to-br from-purple-500 to-pink-500 rounded-2xl flex items-center justify-center text-white text-3xl font-bold shadow-lg shadow-purple-500/50">
                  {user.email?.[0].toUpperCase()}
                </div>

                {/* User Info */}
                <div className="flex-1 text-center md:text-left">
                  <h2 className="text-2xl font-bold text-white mb-2">
                    {profile?.username || user.email?.split("@")[0]}
                  </h2>
                  <p className="text-gray-400 text-sm">
                    {profile?.email || user.email}
                  </p>
                </div>

                {/* Sign Out Button */}
                <button
                  onClick={handleSignOut}
                  className="px-6 py-2 bg-gray-800 border border-gray-700 text-white rounded-lg font-medium hover:bg-gray-700 transition-colors"
                >
                  Sign Out
                </button>
              </div>

              <div className="flex gap-4 mb-6">
                <div className="retro-card p-4 text-center bg-[#0D0221]">
                  <div
                    className="text-3xl font-['Press_Start_2P'] text-[#FF006E] retro-glow"
                    style={{ fontSize: "20px" }}
                  >
                    {profile?.totalLikes ?? 0}
                  </div>
                  <div className="text-sm font-['VT323'] text-[#9D4EDD] mt-1">
                    LIKES
                  </div>
                </div>
                <div className="retro-card p-4 text-center bg-[#0D0221]">
                  <div
                    className="text-3xl font-['Press_Start_2P'] text-[#FF006E] retro-glow"
                    style={{ fontSize: "20px" }}
                  >
                    {profile?.totalDislikes ?? 0}
                  </div>
                  <div className="text-sm font-['VT323'] text-[#9D4EDD] mt-1">
                    DISLIKES
                  </div>
                </div>
              </div>

              {/* Tabs */}
              <div className="flex border-b-4 border-[#9D4EDD]">
                <button
                  onClick={() => setActiveTab("videos")}
                  className={`flex-1 py-3 font-['Press_Start_2P'] transition-all ${
                    activeTab === "videos"
                      ? "text-[#00F5FF] border-b-4 border-[#00F5FF] retro-glow"
                      : "text-[#9D4EDD] hover:text-[#00F5FF]"
                  }`}
                  style={{ fontSize: "10px", marginBottom: "-4px" }}
                >
                  MY VIDEOS
                </button>
                <button
                  onClick={() => setActiveTab("liked")}
                  className={`flex-1 py-3 font-['Press_Start_2P'] transition-all ${
                    activeTab === "liked"
                      ? "text-[#FF006E] border-b-4 border-[#FF006E] retro-glow"
                      : "text-[#9D4EDD] hover:text-[#FF006E]"
                  }`}
                  style={{ fontSize: "10px", marginBottom: "-4px" }}
                >
                  LIKED
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Videos Grid - Only show if profile loaded successfully */}
      {!profileError && (
        <div className="max-w-5xl mx-auto px-6 py-8 relative">
          {/* Error State */}
          {currentError ? (
            <div className="text-center py-12">
              <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 max-w-md mx-auto">
                <div className="text-6xl mb-6">⚠️</div>
                <h2 className="text-xl font-bold text-red-500 mb-4">
                  Error Loading Videos
                </h2>
                <p className="text-gray-400 text-sm mb-6">
                  {currentError instanceof Error
                    ? currentError.message
                    : "Failed to load videos"}
                </p>
                <button
                  onClick={() => currentRefetch()}
                  className="px-6 py-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg font-medium hover:shadow-lg hover:shadow-purple-500/50 transition-all"
                >
                  Retry
                </button>
              </div>
            </div>
          ) : isLoading ? (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="w-12 h-12 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mb-4"></div>
              <p className="text-gray-400 text-lg">Loading videos...</p>
            </div>
          ) : videos.length === 0 ? (
            <div className="text-center py-12">
              <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 max-w-md mx-auto">
                <div className="text-6xl mb-6">
                  {activeTab === "videos" ? "🎬" : "❤️"}
                </div>
                <h2 className="text-xl font-bold text-white mb-4">
                  {activeTab === "videos" ? "No Videos Yet" : "No Liked Videos"}
                </h2>
                <p className="text-gray-400 text-sm mb-6">
                  {activeTab === "videos"
                    ? "Create your first AI video"
                    : "Start liking videos"}
                </p>
                {activeTab === "videos" && (
                  <button
                    onClick={() => router.push("/create")}
                    className="px-6 py-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg font-medium hover:shadow-lg hover:shadow-purple-500/50 transition-all"
                  >
                    Create Now
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {videos.map((video) => (
                <VideoCard
                  key={video.id}
                  video={video}
                  horizontal={true}
                  showActions={false}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
