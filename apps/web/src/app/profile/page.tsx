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

  const handleSignOut = () => {
    signOut();
  };

  if (authLoading || profileLoading) {
    return <Loader message="LOADING PROFILE..." />;
  }

  if (!user) {
    return null;
  }

  const videos = activeTab === "videos" ? userVideos : likedVideos;
  const isLoading = activeTab === "videos" ? videosLoading : likedLoading;

  return (
    <div className="min-h-screen bg-[#1A1423] pb-24 retro-scanlines">
      {/* Retro Grid Background */}
      <div className="fixed inset-0 opacity-10">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `
            linear-gradient(#9D4EDD 1px, transparent 1px),
            linear-gradient(90deg, #9D4EDD 1px, transparent 1px)
          `,
            backgroundSize: "50px 50px",
          }}
        ></div>
      </div>

      {/* Header */}
      <header
        className="bg-[#240046] border-b-4 border-[#06FFA5] sticky top-0 z-40"
        style={{
          boxShadow: "0 0 20px rgba(6, 255, 165, 0.5)",
        }}
      >
        <div className="max-w-5xl mx-auto px-4 py-4">
          <h1
            className="text-2xl font-['Press_Start_2P'] text-[#06FFA5] retro-glow"
            style={{ fontSize: "16px" }}
          >
            ● PROFILE ●
          </h1>
        </div>
      </header>

      {/* Profile Info */}
      <div className="bg-[#240046] border-b-4 border-[#9D4EDD] relative">
        <div className="max-w-5xl mx-auto px-4 py-6">
          <div className="flex items-center gap-4 mb-6">
            {/* Avatar */}
            <div
              className="w-20 h-20 pixel-corners retro-card flex items-center justify-center text-[#FFBE0B] text-3xl font-['Press_Start_2P']"
              style={{
                background: "linear-gradient(135deg, #FF006E 0%, #9D4EDD 100%)",
                boxShadow: "0 0 20px rgba(0, 245, 255, 0.5)",
              }}
            >
              {user.email?.[0].toUpperCase()}
            </div>

            {/* User Info */}
            <div className="flex-1">
              <h2
                className="text-xl font-['Press_Start_2P'] text-[#00F5FF] mb-2 retro-glow"
                style={{ fontSize: "14px" }}
              >
                {profile?.username || user.email?.split("@")[0]}
              </h2>
              <p className="text-[#9D4EDD] text-sm font-['VT323']">
                {user.email}
              </p>
            </div>

            {/* Sign Out Button */}
            <button
              onClick={handleSignOut}
              className="px-4 py-2 bg-[#0D0221] border-2 border-[#FF006E] font-['Press_Start_2P'] text-[#FF006E] hover:scale-105 transition-transform"
              style={{
                fontSize: "10px",
                boxShadow: "0 0 10px rgba(255, 0, 110, 0.3)",
              }}
            >
              LOGOUT
            </button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="retro-card p-4 text-center bg-[#0D0221]">
              <div
                className="text-3xl font-['Press_Start_2P'] text-[#FFBE0B] retro-glow"
                style={{ fontSize: "20px" }}
              >
                {profile?.videosCreated || userVideos.length}
              </div>
              <div className="text-sm font-['VT323'] text-[#9D4EDD] mt-1">
                VIDEOS
              </div>
            </div>
            <div className="retro-card p-4 text-center bg-[#0D0221]">
              <div
                className="text-3xl font-['Press_Start_2P'] text-[#06FFA5] retro-glow"
                style={{ fontSize: "20px" }}
              >
                {profile?.totalLikes || 0}
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
                {likedVideos.length}
              </div>
              <div className="text-sm font-['VT323'] text-[#9D4EDD] mt-1">
                LOVED
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
        </div>
      </div>

      {/* Videos Grid */}
      <div className="max-w-5xl mx-auto px-4 py-6 relative">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-12">
            <div className="text-[#00F5FF] text-6xl mb-4 retro-glow font-['Press_Start_2P']">
              ▓▓▓
            </div>
            <p className="text-[#FFBE0B] text-2xl font-['VT323']">
              LOADING VIDEOS...
            </p>
          </div>
        ) : videos.length === 0 ? (
          <div className="text-center py-12">
            <div className="retro-card p-8 max-w-md mx-auto">
              <div
                className="text-8xl mb-6 retro-glow"
                style={{
                  color: activeTab === "videos" ? "#00F5FF" : "#FF006E",
                }}
              >
                {activeTab === "videos" ? "◈" : "♥"}
              </div>
              <h2
                className="text-2xl font-['Press_Start_2P'] text-[#FFBE0B] mb-4"
                style={{ fontSize: "14px" }}
              >
                {activeTab === "videos" ? "NO VIDEOS YET" : "NO LIKED VIDEOS"}
              </h2>
              <p className="text-[#00F5FF] text-xl font-['VT323'] mb-6">
                {activeTab === "videos"
                  ? "CREATE YOUR FIRST AI VIDEO"
                  : "START LIKING VIDEOS"}
              </p>
              {activeTab === "videos" && (
                <button
                  onClick={() => router.push("/create")}
                  className="retro-btn"
                >
                  ✦ CREATE NOW ✦
                </button>
              )}
            </div>
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
