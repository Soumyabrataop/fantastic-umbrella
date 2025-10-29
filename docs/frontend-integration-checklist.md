# Frontend Integration Checklist

## Authentication Flow
- Auth UI at `apps/web/src/app/auth/page.tsx` uses `useAuth` hook. `useAuth` is configured in `apps/web/src/hooks/useAuth.ts` and delegates to `supabase.auth.signInWithPassword` / `supabase.auth.signUp`.
- User session and redirects (`router.push('/feed')`) depend on valid Supabase environment variables (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`).
- Sign-up adds optional profile metadata (name) in `options.data`. Email confirmation flow is handled automatically by Supabase.
- After adjusting the backend, ensure Supabase project has the correct Site URL + Redirect URL to allow local testing.

## Feed Page
- `apps/web/src/app/feed/page.tsx` currently consumes mock data (`generateMockVideos`). Replace with fetch from `/videos/feed` when backend is ready.
- `FeedVideoCard` handles preloading logic (intersection observer, fallback retries). Add additional prefetch logic for upcoming videos via Cache API or `<link rel="preload">` to improve smoothness.
- Ranking logic for display is in `VideoCard`/`ranking.ts`. Use the backend-provided `ranking_score` when available to avoid recalculation.

## Create Page
- `apps/web/src/app/create/page.tsx` still simulates generation with sample videos; replace the mock timer with calls to `/videos/create` once backend endpoints are stable.
- Publishing, sharing, download actions currently use alerts. Hook them to real backend endpoints when implemented.

## Profile Page
- `apps/web/src/app/profile/page.tsx` uses React Query to call `videoAPI` endpoints (`/users/:id`, `/users/:id/videos`, `/users/:id/liked`). Ensure backend end points match interface defined in `apps/web/src/utils/api.ts`.
- `useVideoActions` handles `like`, `dislike`, `trackView`, `recreate`. These call REST endpoints; ensure backend responses align with expected shapes.

## Leaderboard Page
- `apps/web/src/app/leaderboard/page.tsx` still uses placeholder empty array (`return []`). Update to call backend `/users/top` once implemented.

## Supabase Client
- `apps/web/src/lib/supabase.ts` requires both public env variables; otherwise falls back to placeholder client.
- `hasSupabaseCredentials` flag prevents hooks from running when missing configuration.

## API Client
- `apps/web/src/utils/api.ts` defines base URL `NEXT_PUBLIC_API_URL` (default `http://localhost:8000`). All REST endpoints expect 200/201 responses with body matching `Video`, `FeedResponse`, `UserProfile` interfaces.
- Axios interceptor reads `supabase.auth.token` from `localStorage`; ensure frontend properly stores the session JSON so backend receives `Authorization: Bearer <token>`.

## Todo
- Feed: swap mocks for backend data + infinite scroll from `useFeed` hook (already scaffolded).
- Create: use `useVideoActions.createVideo` and poll for status updates.
- Auth: handle `hasCredentials` false state gracefully on the UI.
- Preload: implement `useVideoPrefetch` hook (refer to `docs/frontend-video-preloading.md`).
- Leaderboard: call real endpoint once backend ready.
- Ensure `.env.local` contains all required `NEXT_PUBLIC_*` values for local runs.
