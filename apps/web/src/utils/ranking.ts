import { Video } from "./api";

/**
 * Calculate ranking score for a video
 * This mirrors the backend ranking algorithm
 * Score = (likes - dislikes) * engagement_multiplier + recency_bonus
 */
export function calculateRankingScore(video: Video): number {
  const now = new Date().getTime();
  const videoAge = now - new Date(video.createdAt).getTime();
  const ageInHours = videoAge / (1000 * 60 * 60);

  // Engagement score
  const netLikes = video.likes - video.dislikes;
  const engagementMultiplier = Math.log10(Math.max(video.views, 1) + 1);
  const engagementScore = netLikes * engagementMultiplier;

  // Recency bonus (decays over time)
  // Videos lose 10% of recency bonus every 24 hours
  const recencyBonus = 100 * Math.exp(-ageInHours / 24);

  return engagementScore + recencyBonus;
}

/**
 * Enhanced video ranking with creator activity boost
 * Combines video engagement with creator reliability
 */
export function calculateEnhancedRankingScore(
  video: Video,
  creatorStats?: {
    totalVideos: number;
    totalLikes: number;
    lastActiveHours: number;
  }
): number {
  // Base video score
  const baseScore = calculateRankingScore(video);

  // If no creator stats, return base score
  if (!creatorStats) return baseScore;

  // Creator quality score (0-100 scale)
  const recentActivityScore = Math.max(
    0,
    100 - creatorStats.lastActiveHours / 24
  );
  const productivityScore = Math.min(100, creatorStats.totalVideos * 5);
  const popularityScore = Math.min(
    100,
    Math.log10(creatorStats.totalLikes + 1) * 20
  );

  const creatorScore =
    recentActivityScore * 0.4 + productivityScore * 0.3 + popularityScore * 0.3;

  // Boost video score by 0-50% based on creator quality
  const creatorBoost = (creatorScore / 100) * 0.5;
  return baseScore * (1 + creatorBoost);
}

/**
 * Calculate user/creator ranking score
 * Score = recently_active * 0.4 + num_videos * 0.3 + likes * 0.2 + dislikes * 0.1
 *
 * @param lastActiveTimestamp - User's last activity timestamp
 * @param numVideos - Total number of videos created
 * @param totalLikes - Total likes across all videos
 * @param totalDislikes - Total dislikes across all videos
 * @returns Creator ranking score (0-100+ scale)
 */
export function calculateCreatorRankingScore(
  lastActiveTimestamp: string | Date,
  numVideos: number,
  totalLikes: number,
  totalDislikes: number = 0
): number {
  const now = new Date().getTime();
  const lastActive = new Date(lastActiveTimestamp).getTime();
  const hoursSinceActive = (now - lastActive) / (1000 * 60 * 60);

  // Recently active score (0-100, decays over 30 days)
  // 100 if active within last hour, 0 if inactive for 30+ days
  const recentlyActiveScore = Math.max(
    0,
    100 - (hoursSinceActive / (24 * 30)) * 100
  );

  // Video count score (normalized, 50 videos = 100 points)
  const videoCountScore = Math.min(100, (numVideos / 50) * 100);

  // Likes score (logarithmic scale, 1000 likes = 100 points)
  const likesScore = Math.min(
    100,
    (Math.log10(totalLikes + 1) / Math.log10(1001)) * 100
  );

  // Dislikes score (capped at 100, shows engagement even if negative)
  const dislikesScore = Math.min(100, (totalDislikes / 100) * 100);

  // Weighted score
  const finalScore =
    recentlyActiveScore * 0.4 +
    videoCountScore * 0.3 +
    likesScore * 0.2 +
    dislikesScore * 0.1;

  return Math.round(finalScore * 10) / 10; // Round to 1 decimal
}

/**
 * Sort videos by ranking score
 */
export function sortByRanking(videos: Video[]): Video[] {
  return [...videos].sort((a, b) => {
    const scoreA =
      (a as Video & { ranking_score?: number }).rankingScore ??
      (a as Video & { ranking_score?: number }).ranking_score ??
      calculateRankingScore(a);
    const scoreB =
      (b as Video & { ranking_score?: number }).rankingScore ??
      (b as Video & { ranking_score?: number }).ranking_score ??
      calculateRankingScore(b);
    return scoreB - scoreA;
  });
}

/**
 * Format view count for display
 */
export function formatViews(views: number): string {
  if (views < 1000) return views.toString();
  if (views < 1000000) return `${(views / 1000).toFixed(1)}K`;
  return `${(views / 1000000).toFixed(1)}M`;
}

/**
 * Format time ago
 */
export function formatTimeAgo(dateString: string): string {
  const now = new Date().getTime();
  const date = new Date(dateString).getTime();
  const diffInSeconds = Math.floor((now - date) / 1000);

  if (diffInSeconds < 60) return "just now";
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
  if (diffInSeconds < 604800)
    return `${Math.floor(diffInSeconds / 86400)}d ago`;
  return `${Math.floor(diffInSeconds / 604800)}w ago`;
}

/**
 * Calculate engagement rate
 */
export function calculateEngagementRate(video: Video): number {
  if (video.views === 0) return 0;
  const totalEngagement = video.likes + video.dislikes;
  return (totalEngagement / video.views) * 100;
}
