# 🎯 Ranking Algorithm Documentation

## Overview

The AI Video Generator uses **two complementary ranking algorithms**:

1. **Video-Level Ranking** - Ranks individual videos in the feed
2. **Creator-Level Ranking** - Ranks users/creators on the leaderboard

---

## 📹 Video-Level Ranking

### Purpose

Determines the order of videos in the main feed. Prioritizes fresh, engaging content.

### Formula

```
Score = (likes - dislikes) × log₁₀(views + 1) + 100 × e^(-age_hours/24)
```

### Components

#### 1. Engagement Score

```
engagement_score = (likes - dislikes) × log₁₀(views + 1)
```

- **Net likes**: Positive engagement minus negative
- **Logarithmic views**: Prevents viral videos from dominating
- **Example**: 100 likes, 10 dislikes, 1000 views = 90 × 3 = 270 points

#### 2. Recency Bonus

```
recency_bonus = 100 × e^(-age_hours/24)
```

- **Exponential decay**: Fresh content gets significant boost
- **Half-life**: ~17 hours (loses 50% recency value)
- **24-hour decay**: Loses 63% of initial boost
- **Example**:
  - Just posted: +100 points
  - 12 hours old: +61 points
  - 24 hours old: +37 points
  - 48 hours old: +14 points

### Characteristics

✅ **Fresh content** gets visibility even with few likes  
✅ **Viral videos** stay relevant but don't monopolize feed  
✅ **Balanced** between new and popular content  
✅ **Time-sensitive** - encourages regular content creation

### Use Cases

- Main video feed
- Trending page
- Discovery feed

---

## 👤 Creator-Level Ranking (Your Suggestion!)

### Purpose

Ranks users/creators on the leaderboard. Rewards consistency, activity, and engagement.

### Formula

```
Score = recently_active × 0.4 + num_videos × 0.3 + likes × 0.2 + dislikes × 0.1
```

### Components (0-100 scale each)

#### 1. Recent Activity (40% weight)

```
recently_active = max(0, 100 - (hours_since_active / (24 × 30)) × 100)
```

- **Full points**: Active within last hour
- **Zero points**: Inactive for 30+ days
- **Decay rate**: Linear over 30 days
- **Why 40%**: Rewards consistent creators over dormant ones

**Examples:**

- Active 1 hour ago: 100 points → contributes 40 to final score
- Active yesterday: 96.7 points → contributes 38.7
- Active 1 week ago: 76.7 points → contributes 30.7
- Active 1 month ago: 0 points → contributes 0

#### 2. Video Count (30% weight)

```
video_count_score = min(100, (num_videos / 50) × 100)
```

- **Normalized**: 50 videos = 100 points
- **Linear scaling**: 1 video = 2 points, 25 videos = 50 points
- **Capped**: Doesn't exceed 100
- **Why 30%**: Rewards prolific creators

**Examples:**

- 5 videos: 10 points → contributes 3
- 25 videos: 50 points → contributes 15
- 50 videos: 100 points → contributes 30
- 100 videos: 100 points (capped) → contributes 30

#### 3. Total Likes (20% weight)

```
likes_score = min(100, (log₁₀(likes + 1) / log₁₀(1001)) × 100)
```

- **Logarithmic**: 1000 likes = 100 points
- **Quality indicator**: Shows audience approval
- **Prevents gaming**: Harder to inflate than video count
- **Why 20%**: Quality should matter, but not dominate

**Examples:**

- 10 likes: 33 points → contributes 6.6
- 100 likes: 66 points → contributes 13.2
- 1000 likes: 100 points → contributes 20
- 10000 likes: 100 points (capped) → contributes 20

#### 4. Total Dislikes (10% weight)

```
dislikes_score = min(100, (dislikes / 100) × 100)
```

- **Engagement indicator**: Even negative engagement shows reach
- **Capped at 100**: Prevents excessive penalty
- **Controversial content**: Still gets some credit for engagement
- **Why 10%**: Smallest weight, but acknowledges interaction

**Examples:**

- 5 dislikes: 5 points → contributes 0.5
- 50 dislikes: 50 points → contributes 5
- 100+ dislikes: 100 points (capped) → contributes 10

### Example Calculations

#### Example 1: Active, Prolific Creator

```
Last active: 2 hours ago
Videos: 45
Likes: 500
Dislikes: 20

recently_active = 100 - (2/(24×30))×100 = 99.7
video_count = (45/50)×100 = 90
likes = (log(501)/log(1001))×100 = 89.7
dislikes = (20/100)×100 = 20

Score = 99.7×0.4 + 90×0.3 + 89.7×0.2 + 20×0.1
      = 39.9 + 27 + 17.9 + 2
      = 86.8 ⭐ High rank!
```

#### Example 2: Popular but Inactive

```
Last active: 15 days ago
Videos: 10
Likes: 2000
Dislikes: 100

recently_active = 100 - (360/(24×30))×100 = 50
video_count = (10/50)×100 = 20
likes = 100 (capped)
dislikes = 100 (capped)

Score = 50×0.4 + 20×0.3 + 100×0.2 + 100×0.1
      = 20 + 6 + 20 + 10
      = 56.0 ⭐ Medium rank
```

#### Example 3: New but Active

```
Last active: 30 minutes ago
Videos: 3
Likes: 15
Dislikes: 2

recently_active = 100 - (0.5/(24×30))×100 = 99.9
video_count = (3/50)×100 = 6
likes = (log(16)/log(1001))×100 = 40
dislikes = (2/100)×100 = 2

Score = 99.9×0.4 + 6×0.3 + 40×0.2 + 2×0.1
      = 40 + 1.8 + 8 + 0.2
      = 50.0 ⭐ Medium rank (boosted by activity)
```

### Characteristics

✅ **Rewards consistency** - Active creators ranked higher  
✅ **Balanced metrics** - No single metric dominates  
✅ **Discourages spam** - Quality (likes) still matters  
✅ **Fair to new creators** - Recent activity heavily weighted  
✅ **Engagement-focused** - Even dislikes count slightly

### Use Cases

- Creator leaderboard
- Featured creators
- Recommendation system
- Creator badges/tiers

---

## 🔄 Hybrid Approach: Enhanced Video Ranking

### Concept

Combine video-level and creator-level scores for **personalized feeds**.

### Formula

```
enhanced_score = video_base_score × (1 + creator_boost)
creator_boost = (creator_score / 100) × 0.5  // 0-50% boost
```

### How It Works

1. Calculate base video score (engagement + recency)
2. Calculate creator quality score (0-100)
3. Boost video score by 0-50% based on creator quality

### Example

```
Video: 150 base score
Creator: 80/100 quality score

creator_boost = (80/100) × 0.5 = 0.4 (40% boost)
enhanced_score = 150 × (1 + 0.4) = 210

Result: Video from quality creator gets 40% ranking boost!
```

### Benefits

✅ **Rewards consistency** - Videos from reliable creators rank higher  
✅ **Discovery** - New creator videos still get visibility  
✅ **Fair** - Boost is capped at 50%, not overwhelming  
✅ **Holistic** - Considers both video and creator quality

---

## 📊 Comparison

| Aspect                 | Video Ranking      | Creator Ranking      | Hybrid         |
| ---------------------- | ------------------ | -------------------- | -------------- |
| **Focus**              | Individual content | User profile         | Both           |
| **Time Sensitivity**   | High (exponential) | Medium (linear)      | High           |
| **Discovery**          | New videos visible | Active users visible | Balanced       |
| **Gaming Resistance**  | High               | Very High            | Very High      |
| **Viral Content**      | Slightly dampened  | Indirect benefit     | Moderate boost |
| **Consistency Reward** | Low                | Very High            | High           |

---

## 🎯 Which to Use?

### Use Video-Level When:

- Main feed ranking
- Trending/viral content
- Time-sensitive posts
- Discovery mode

### Use Creator-Level When:

- Leaderboards
- Featured creators
- Creator recommendations
- Badges/tiers

### Use Hybrid When:

- Personalized feeds
- Following page
- Recommended content
- Quality-focused curation

---

## 🔧 Implementation

### Backend API Endpoints Needed

```typescript
// Video ranking
GET /videos/feed?algorithm=video  // Default
GET /videos/feed?algorithm=hybrid // Enhanced
GET /videos/feed?algorithm=creator // Sort by creator score

// Creator ranking
GET /users/leaderboard
GET /users/{id}/score
```

### Frontend Usage

```typescript
// Video feed (current)
import { calculateRankingScore } from "@/utils/ranking";
const score = calculateRankingScore(video);

// Creator leaderboard (new!)
import { calculateCreatorRankingScore } from "@/utils/ranking";
const score = calculateCreatorRankingScore(
  user.lastActiveAt,
  user.videosCreated,
  user.totalLikes,
  user.totalDislikes
);

// Hybrid ranking
import { calculateEnhancedRankingScore } from "@/utils/ranking";
const score = calculateEnhancedRankingScore(video, creatorStats);
```

---

## 🚀 Future Enhancements

### Creator Score

- [ ] Add watch time component
- [ ] Include comment engagement
- [ ] Add follower count
- [ ] Implement streak bonuses

### Video Score

- [ ] Add watch completion rate
- [ ] Include share count
- [ ] Consider comment activity
- [ ] Add bookmark/save metrics

### Hybrid

- [ ] Personalization (user preferences)
- [ ] A/B testing framework
- [ ] Machine learning adjustments
- [ ] Real-time score updates

---

## 💡 Why Your Formula is Better for Creators

Your formula (`recently_active × 0.4 + num_videos × 0.3 + likes × 0.2 + dislikes × 0.1`) excels at:

1. **Encouraging Activity** - 40% weight on recent activity fights creator burnout
2. **Rewarding Consistency** - 30% on video count values regular creators
3. **Balancing Quality** - 20% on likes ensures quality still matters
4. **Acknowledging Engagement** - 10% on dislikes shows controversial = engaging

It's perfect for **creator leaderboards** and **reputation systems**!

---

## 📝 Summary

Both algorithms serve different purposes:

- **Video Ranking**: "What should users see right now?"
- **Creator Ranking**: "Who are the best creators on the platform?"
- **Hybrid**: "Boost good content from reliable creators"

Your creator formula is now implemented in `/leaderboard` page! 🎉
