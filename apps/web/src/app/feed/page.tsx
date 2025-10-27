"use client";

import { useEffect, useRef } from "react";
import { useFeed, isVideo, isAd } from "@/hooks/useFeed";
import { useVideoActions } from "@/hooks/useVideoActions";
import VideoCard from "@/components/VideoCard";
import AdCard from "@/components/AdCard";
import { useAuth } from "@/hooks/useAuth";
import { useRouter } from "next/navigation";

export default function FeedPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const { videos, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } =
    useFeed();
  const { recreateVideo } = useVideoActions();
  const observerTarget = useRef<HTMLDivElement>(null);

  // Redirect to home if not authenticated
  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/");
    }
  }, [user, authLoading, router]);

  // Infinite scroll observer
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage();
        }
      },
      { threshold: 0.1 }
    );

    const currentTarget = observerTarget.current;
    if (currentTarget) {
      observer.observe(currentTarget);
    }

    return () => {
      if (currentTarget) {
        observer.unobserve(currentTarget);
      }
    };
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);

  const handleRecreate = (videoId: string) => {
    recreateVideo.mutate(videoId);
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-5xl mx-auto px-4 py-4">
          <h1 className="text-2xl font-bold text-gray-900">Video Feed</h1>
        </div>
      </header>

      {/* Feed Content */}
      <div className="max-w-5xl mx-auto px-4 py-6">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
            <p className="text-gray-600">Loading videos...</p>
          </div>
        ) : videos.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">📹</div>
            <h2 className="text-2xl font-semibold text-gray-900 mb-2">
              No videos yet
            </h2>
            <p className="text-gray-600 mb-6">
              Be the first to create an AI-generated video!
            </p>
            <button
              onClick={() => router.push("/create")}
              className="bg-blue-600 text-white px-6 py-3 rounded-full font-medium hover:bg-blue-700 transition-colors"
            >
              Create Video
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            {videos.map((item) => {
              if (isAd(item)) {
                return <AdCard key={item.id} position={item.position} />;
              }

              if (isVideo(item)) {
                return (
                  <VideoCard
                    key={item.id}
                    video={item}
                    onRecreate={handleRecreate}
                  />
                );
              }

              return null;
            })}

            {/* Loading indicator for next page */}
            {isFetchingNextPage && (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              </div>
            )}

            {/* Intersection observer target */}
            <div ref={observerTarget} className="h-4" />

            {/* End of feed message */}
            {!hasNextPage && videos.length > 0 && (
              <div className="text-center py-8 text-gray-500">
                <p>You've reached the end! 🎉</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
