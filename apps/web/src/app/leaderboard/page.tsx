"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { userAPI, UserProfile } from "@/utils/api";
import { calculateCreatorRankingScore } from "@/utils/ranking";
import Loader from "@/components/Loader";

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
    return <Loader message="LOADING RANKS..." />;
  }

  if (!user) {
    return null;
  }

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
        className="bg-[#240046] border-b-4 border-[#FFBE0B] sticky top-0 z-40"
        style={{
          boxShadow: "0 0 20px rgba(255, 190, 11, 0.5)",
        }}
      >
        <div className="max-w-5xl mx-auto px-4 py-4">
          <h1
            className="text-2xl font-['Press_Start_2P'] text-[#FFBE0B] retro-glow"
            style={{ fontSize: "16px" }}
          >
            ★ LEADERBOARD ★
          </h1>
        </div>
      </header>

      {/* Ranking Formula Info */}
      <div className="max-w-5xl mx-auto px-4 py-6 relative">
        <div className="retro-card p-6 mb-6 bg-[#0D0221]">
          <h3
            className="font-['Press_Start_2P'] text-[#00F5FF] mb-4"
            style={{ fontSize: "12px" }}
          >
            :: RANKING FORMULA ::
          </h3>
          <div className="text-sm font-['VT323'] space-y-2">
            <p className="text-[#FFBE0B] text-lg bg-[#240046] p-3 border-2 border-[#9D4EDD]">
              SCORE = ACTIVE×40% + VIDEOS×30% + LIKES×20% + DISLIKES×10%
            </p>
            <ul className="mt-4 space-y-2 text-[#00F5FF] text-base">
              <li className="flex items-start gap-2">
                <span className="text-[#FF006E]">▶</span>
                <span>
                  <strong className="text-[#FFBE0B]">40%</strong> RECENT
                  ACTIVITY
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-[#FF006E]">▶</span>
                <span>
                  <strong className="text-[#FFBE0B]">30%</strong> VIDEO COUNT
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-[#FF006E]">▶</span>
                <span>
                  <strong className="text-[#FFBE0B]">20%</strong> TOTAL LIKES
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-[#FF006E]">▶</span>
                <span>
                  <strong className="text-[#FFBE0B]">10%</strong> ENGAGEMENT
                </span>
              </li>
            </ul>
          </div>
        </div>

        {/* Leaderboard */}
        {rankedCreators.length === 0 ? (
          <div className="text-center py-12">
            <div className="retro-card p-8 max-w-md mx-auto">
              <div
                className="text-8xl mb-6 retro-glow"
                style={{ color: "#FFBE0B" }}
              >
                ★
              </div>
              <h2
                className="text-2xl font-['Press_Start_2P'] text-[#FF006E] mb-4"
                style={{ fontSize: "14px" }}
              >
                NO CREATORS YET
              </h2>
              <p className="text-[#00F5FF] text-xl font-['VT323']">
                Be the first to climb the ranks!
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {rankedCreators.map((creator, index) => (
              <div
                key={creator.id}
                className={`retro-card p-4 flex items-center gap-4 hover:scale-105 transition-transform ${
                  index === 0
                    ? "border-[#FFBE0B]"
                    : index === 1
                    ? "border-[#00F5FF]"
                    : index === 2
                    ? "border-[#FF006E]"
                    : ""
                }`}
                style={{
                  background:
                    index < 3
                      ? `linear-gradient(135deg, ${
                          index === 0
                            ? "#3C096C"
                            : index === 1
                            ? "#240046"
                            : "#1A1423"
                        } 0%, #0D0221 100%)`
                      : undefined,
                }}
              >
                {/* Rank */}
                <div className="shrink-0 w-16 text-center">
                  {index === 0 && (
                    <div
                      className="text-5xl retro-glow"
                      style={{ color: "#FFBE0B" }}
                    >
                      ★
                    </div>
                  )}
                  {index === 1 && (
                    <div
                      className="text-5xl retro-glow"
                      style={{ color: "#00F5FF" }}
                    >
                      ★
                    </div>
                  )}
                  {index === 2 && (
                    <div
                      className="text-5xl retro-glow"
                      style={{ color: "#FF006E" }}
                    >
                      ★
                    </div>
                  )}
                  {index > 2 && (
                    <div
                      className="text-2xl font-['Press_Start_2P'] text-[#9D4EDD]"
                      style={{ fontSize: "14px" }}
                    >
                      #{index + 1}
                    </div>
                  )}
                </div>

                {/* Avatar */}
                <div className="shrink-0">
                  <div
                    className="w-16 h-16 pixel-corners retro-card flex items-center justify-center text-[#00F5FF] text-2xl font-['Press_Start_2P']"
                    style={{
                      background:
                        "linear-gradient(135deg, #FF006E 0%, #9D4EDD 100%)",
                      boxShadow: "0 0 15px rgba(0, 245, 255, 0.5)",
                    }}
                  >
                    {creator.username?.[0]?.toUpperCase() ||
                      creator.email[0].toUpperCase()}
                  </div>
                </div>

                {/* Creator Info */}
                <div className="flex-1">
                  <h3
                    className="font-['Press_Start_2P'] text-[#00F5FF] text-lg mb-2"
                    style={{ fontSize: "12px" }}
                  >
                    {creator.username || creator.email.split("@")[0]}
                  </h3>
                  <div className="flex gap-4 font-['VT323'] text-base">
                    <span className="text-[#FFBE0B]">
                      ◈ {creator.videosCreated}
                    </span>
                    <span className="text-[#06FFA5]">
                      ▲ {creator.totalLikes}
                    </span>
                    {creator.totalDislikes && creator.totalDislikes > 0 && (
                      <span className="text-[#FF006E]">
                        ▼ {creator.totalDislikes}
                      </span>
                    )}
                  </div>
                </div>

                {/* Score */}
                <div className="shrink-0 text-right retro-card p-3 bg-[#0D0221]">
                  <div
                    className="text-3xl font-['Press_Start_2P'] retro-glow"
                    style={{
                      color:
                        index === 0
                          ? "#FFBE0B"
                          : index === 1
                          ? "#00F5FF"
                          : index === 2
                          ? "#FF006E"
                          : "#9D4EDD",
                      fontSize: "16px",
                    }}
                  >
                    {creator.score.toFixed(1)}
                  </div>
                  <div className="text-xs font-['VT323'] text-[#9D4EDD]">
                    SCORE
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
