"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { userAPI, UserProfile } from "@/utils/api";
import { calculateCreatorRankingScore } from "@/utils/ranking";

export default function LeaderboardPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  // Redirect to home if not authenticated
  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/");
    }
  }, [user, authLoading, router]);

  // Fetch top creators (this would be a new API endpoint)
  const { data: creators = [], isLoading } = useQuery<UserProfile[]>({
    queryKey: ["leaderboard"],
    queryFn: async () => {
      // TODO: Replace with actual API call
      // return userAPI.getTopCreators();
      return [];
    },
    enabled: !!user,
  });

  // Calculate creator scores
  const rankedCreators = creators
    .map((creator) => ({
      ...creator,
      score: calculateCreatorRankingScore(
        creator.lastActiveAt || creator.createdAt,
        creator.videosCreated,
        creator.totalLikes,
        creator.totalDislikes || 0
      ),
    }))
    .sort((a, b) => b.score - a.score);

  if (authLoading || isLoading) {
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
          <h1 className="text-2xl font-bold text-gray-900">
            🏆 Creator Leaderboard
          </h1>
        </div>
      </header>

      {/* Ranking Formula Info */}
      <div className="max-w-5xl mx-auto px-4 py-6">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <h3 className="font-semibold text-blue-900 mb-2">
            📊 Ranking Formula
          </h3>
          <div className="text-sm text-blue-800 space-y-1">
            <p className="font-mono text-xs bg-blue-100 p-2 rounded">
              Score = recently_active × 0.4 + num_videos × 0.3 + likes × 0.2 +
              dislikes × 0.1
            </p>
            <ul className="mt-3 space-y-1">
              <li>
                • <strong>40%</strong> - Recent activity (active = higher rank)
              </li>
              <li>
                • <strong>30%</strong> - Video count (prolific creators
                rewarded)
              </li>
              <li>
                • <strong>20%</strong> - Total likes (quality matters)
              </li>
              <li>
                • <strong>10%</strong> - Total dislikes (engagement indicator)
              </li>
            </ul>
          </div>
        </div>

        {/* Leaderboard */}
        {rankedCreators.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg shadow-md">
            <div className="text-6xl mb-4">🏆</div>
            <h2 className="text-2xl font-semibold text-gray-900 mb-2">
              No Creators Yet
            </h2>
            <p className="text-gray-600">
              Be the first to create videos and climb the leaderboard!
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {rankedCreators.map((creator, index) => (
              <div
                key={creator.id}
                className={`bg-white rounded-lg shadow-md p-4 flex items-center gap-4 ${
                  index < 3 ? "border-2" : ""
                } ${
                  index === 0
                    ? "border-yellow-400 bg-linear-to-r from-yellow-50 to-white"
                    : index === 1
                    ? "border-gray-400 bg-linear-to-r from-gray-50 to-white"
                    : index === 2
                    ? "border-orange-400 bg-linear-to-r from-orange-50 to-white"
                    : ""
                }`}
              >
                {/* Rank */}
                <div className="shrink-0 w-12 text-center">
                  {index === 0 && <div className="text-3xl">🥇</div>}
                  {index === 1 && <div className="text-3xl">🥈</div>}
                  {index === 2 && <div className="text-3xl">🥉</div>}
                  {index > 2 && (
                    <div className="text-xl font-bold text-gray-600">
                      #{index + 1}
                    </div>
                  )}
                </div>

                {/* Avatar */}
                <div className="shrink-0">
                  <div className="w-16 h-16 bg-linear-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white text-xl font-bold">
                    {creator.username?.[0]?.toUpperCase() ||
                      creator.email[0].toUpperCase()}
                  </div>
                </div>

                {/* Creator Info */}
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900 text-lg">
                    {creator.username || creator.email.split("@")[0]}
                  </h3>
                  <div className="flex gap-4 text-sm text-gray-600 mt-1">
                    <span>📹 {creator.videosCreated} videos</span>
                    <span>👍 {creator.totalLikes} likes</span>
                    {creator.totalDislikes && creator.totalDislikes > 0 && (
                      <span>👎 {creator.totalDislikes}</span>
                    )}
                  </div>
                </div>

                {/* Score */}
                <div className="shrink-0 text-right">
                  <div className="text-2xl font-bold text-blue-600">
                    {creator.score.toFixed(1)}
                  </div>
                  <div className="text-xs text-gray-500">score</div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Example Calculation */}
        {rankedCreators.length > 0 && (
          <div className="mt-8 bg-white rounded-lg shadow-md p-6">
            <h3 className="font-semibold text-gray-900 mb-4">
              💡 Example Score Calculation
            </h3>
            <div className="text-sm text-gray-600 space-y-2">
              <p>
                For top creator{" "}
                <strong>{rankedCreators[0].username || "User"}</strong>:
              </p>
              <ul className="list-disc list-inside space-y-1 ml-4">
                <li>Recent activity component: varies by last active time</li>
                <li>Video count: {rankedCreators[0].videosCreated} videos</li>
                <li>Like count: {rankedCreators[0].totalLikes} likes</li>
                <li>
                  Dislike count: {rankedCreators[0].totalDislikes || 0} dislikes
                </li>
              </ul>
              <p className="pt-2 border-t border-gray-200">
                <strong>
                  Final Score: {rankedCreators[0].score.toFixed(1)}
                </strong>
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
