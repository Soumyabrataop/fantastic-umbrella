# Backend Integration Plan

## Frontend Expectations Snapshot
- Next.js 16 app under `apps/web` uses React Query + Axios for data and Supabase JS for auth.
- Data hooks already scaffolded: `useAuth` (session, redirects) and `useFeed`/`useVideoActions` for CRUD against a REST API.
- Current pages rely on mock data (`generateMockVideos`, static sample videos) but are wired to replace mocks with real API responses once endpoints exist.
- All API calls use `NEXT_PUBLIC_API_URL` (defaults to `http://localhost:8000`) and expect JSON payloads shaped like the TypeScript interfaces in `src/types/index.ts` and `src/utils/api.ts`.
- Supabase credentials (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`) must be present for auth-dependent pages (`/feed`, `/create`, `/profile`, `/leaderboard`).

## Authentication Requirements
- **Sign up / Sign in / Sign out**: `auth.signUp`, `auth.signIn`, and `auth.signOut` in `src/lib/supabase.ts` wrap Supabase email+password flows. Backend should verify the Supabase access token on every protected REST call.
- **Session tracking**: `useAuth` subscribes to `supabase.auth.onAuthStateChange` and redirects unauthenticated users away from protected pages. Any 401 response from the backend should trigger Supabase to refresh/revoke sessions; return `statusCode: 401` with an `APIError` body when tokens are invalid.
- **Token forwarding**: the Axios interceptor reads `localStorage.getItem("supabase.auth.token")`. That value is the JSON-encoded Supabase session; the frontend still needs to parse it and forward `session.access_token`. Until that fix lands, document the expected `Authorization: Bearer <supabase JWT>` contract so backend validation logic is ready.
- **Optional OAuth**: there is no UI yet for Google/OTP sign-in, but Supabase supports it. If alternative providers are required, expose helper endpoints that call `supabase.auth.signInWithOAuth` and return the redirect URL for the frontend.

## Data Contracts Expected by the UI
```ts
interface Video {
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

interface UserProfile {
  id: string;
  username: string;
  email: string;
  videosCreated: number;
  totalLikes: number;
  totalDislikes?: number;
  lastActiveAt?: string;
  createdAt: string;
}

interface FeedResponse {
  videos: Video[];
  nextCursor?: string;
  hasMore: boolean;
}

interface APIError {
  message: string;
  statusCode?: number;
  error?: string;
}
```
- `Video.status` drives create/progress states. Return `pending`/`processing` for jobs that are still rendering so the UI can show spinners.
- `ranking_score` is optional; the frontend falls back to local scoring if it is missing but prefers the backend-provided value for feed ordering.
- `UserProfile` powers `/profile` (stats cards) and `/leaderboard` (ranking). Provide `totalDislikes` and `lastActiveAt` so creator scores can be computed accurately.

## Database Schema Additions / Updates
| Table | Purpose | Required Columns | Notes |
| videos | Store generated videos | `id` (uuid), `user_id` (uuid FK to auth.users), `prompt` (text), `video_url` (text), `thumbnail_url` (text nullable), `status` (enum pending/processing/completed/failed), `likes_count` (int), `dislikes_count` (int), `views_count` (bigint), `ranking_score` (numeric), `created_at` (timestamptz), `updated_at` (timestamptz), `source_video_id` (uuid nullable for recreate lineage) | Maintain counters atomically. Generate `ranking_score` with a trigger or background job. |
| video_assets | Track storage references | `video_id` (uuid FK), `file_path` (text), `duration_seconds` (numeric), `resolution` (text), `model` (text), `created_at` | Optional but useful for storage + download events. |
| video_reactions | Deduplicate likes/dislikes | `id` (uuid), `video_id` (uuid FK), `user_id` (uuid FK), `reaction` (enum like/dislike), `created_at` | Enforce one reaction per user/video and backfill `likes_count`/`dislikes_count` via trigger.
| video_views | Track unique or total views | `id` (uuid), `video_id` (uuid FK), `user_id` (uuid FK nullable), `session_id` (text), `created_at` | Use to increment `views_count`; decide on uniqueness rules. |
| profiles | Extend Supabase users | `id` (uuid PK == auth.users.id), `username` (text unique), `email` (text), `avatar_url` (text nullable), `created_at`, `updated_at`, `last_active_at` | Upsert from Supabase webhook or on first login. |
| creator_stats (materialized view or table) | Aggregate leaderboard metrics | `user_id`, `videos_created`, `total_likes`, `total_dislikes`, `last_active_at`, `creator_score` | Recompute nightly or via triggers so `/leaderboard` can read quickly. |
| video_jobs | Track generation pipeline | `id` (uuid), `video_id` (uuid FK), `prompt` (text), `status` (enum queued/running/succeeded/failed), `failure_reason` (text), `created_at`, `updated_at`, `output_url` (text) | Useful if video rendering is asynchronous; UI expects job state via `Video.status`. |

## REST API Surface to Implement
| Method | Path | Description | Request Body | Response | Used By |
| GET | `/videos/feed?cursor=&limit=` | Paginated ranked feed | n/a | `FeedResponse` | `useFeed` (future feed page integration) |
| GET | `/videos/:id` | Fetch a single video | n/a | `Video` | Share links, future detail page |
| POST | `/videos/create` | Create a new video generation job | `{ prompt: string }` | `Video` (new record with `status: "pending"`) | `useVideoActions.createVideo`, `/create` page |
| POST | `/videos/:id/recreate` | Duplicate prompt and start a new job | n/a | `Video` (new job) | `useVideoActions.recreateVideo`, feed/profile recreate buttons |
| POST | `/videos/:id/like` | Register a like from the current user | n/a | `{ success: true }` | `useVideoActions.likeVideo`, `VideoCard` |
| POST | `/videos/:id/dislike` | Register a dislike | n/a | `{ success: true }` | `useVideoActions.dislikeVideo`, `VideoCard` |
| POST | `/videos/:id/view` | Increment view count / record view event | n/a | `{ success: true }` | `useVideoActions.trackView`, autoplay observers |
| GET | `/users/:id` | Retrieve profile stats | n/a | `UserProfile` | `/profile` header + stats |
| PATCH | `/users/:id` | Update profile info (username, avatar) | `Partial<UserProfile>` | `UserProfile` | future profile edit form |
| GET | `/users/:id/videos` | List videos by owner | n/a | `Video[]` | `/profile` "My Videos" tab |
| GET | `/users/:id/liked` | List videos liked by owner | n/a | `Video[]` | `/profile` "Liked" tab |
| GET | `/users/top?limit=` | Top creators for leaderboard | n/a | `UserProfile[]` (with ranking metadata) | `/leaderboard` (currently TODO) |

**Conventions**
- Return 200 with the payload above on success; prefer 201 for creation endpoints.
- On errors, respond with `statusCode` and `message` per `APIError` so the frontend toasts show meaningful text.
- Use cursor-based pagination (`nextCursor` as the encoded `videos.created_at`/`videos.id`). When `hasMore` is false the frontend stops infinite scrolling.
- `Authorization: Bearer <token>` should be required for all non-public endpoints. Public feed access can be allowed anonymously if desired, but `/profile`, `/leaderboard`, and mutation routes assume auth.

## Supabase ↔ Backend Coordination
- Validate incoming JWTs against Supabase by calling the Admin API or using `SUPABASE_JWT_SECRET`.
- Consider Supabase database triggers (or Edge Functions) to keep `profiles` and counter columns in sync when `video_reactions`/`video_views` change.
- Emit `last_active_at` updates on any write (like video creation, reaction, or view) so leaderboard scoring remains accurate.
- If video rendering happens outside Supabase, post job status updates back into the database or expose a webhook that the worker can call to mark a `video` as `completed` and populate `video_url`/`thumbnail_url`.

## Outstanding Follow-ups for Frontend + Backend
- Swap the mock feed (`apps/web/src/app/feed/page.tsx`) to use `useFeed` once `/videos/feed` is live.
- Replace the simulated generation flow in `/create` with a call to `useVideoActions().createVideo` and poll (or subscribe) for status updates.
- Implement a sign-up/sign-in form (missing `AuthForm`) and ensure Supabase tokens are forwarded correctly in the Axios interceptor.
- Add optimistic updates or revalidation hooks after like/dislike/view endpoints respond so counters stay in sync without another full fetch.
- Confirm whether video downloads and shares require signed URLs; if so, extend the API to return short-lived signed links instead of raw storage paths.
- Define rate limits for mutation endpoints (video creation, reactions) to protect resources when the app is public.
