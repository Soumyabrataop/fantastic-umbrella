# Frontend Video Preloading Plan

## Current Feed Behavior (frontend branch)
- `apps/web/src/app/feed/page.tsx` still relies on `generateMockVideos` and not the real REST feed (`useFeed`).
- Each `FeedVideoCard` drives playback with an `IntersectionObserver`, toggling `preload="auto"` only when the card enters the viewport.
- Preload hints are limited to the video element itself; browsers still start fetching the file only when `load()` is called, so there is an unavoidable wait on scroll.
- There is no request coalescing or warm cache for upcoming items, and no low-bitrate preview to keep the UI busy while the full MP4 streams in.

## Immediate Frontend Fixes
- Switch the page to `useFeed()` so we request the ranked feed from the new backend. Keep a fallback to mock data if the API URL isn’t configured.
- Introduce a small `useVideoPrefetch` hook:
  - As soon as the feed page receives a `videoUrl`, inject `<link rel="preload" as="video">` into the document head for the next N items.
  - On mobile (where preloading should be conservative), gate by `navigator.connection.saveData` or bandwidth.
  - Remove link tags when the video has played or when unmounting to avoid polluting head.
- Amend `FeedVideoCard` so the `video` element keeps `preload="auto"` when it has been preloaded already and skip repeated `.load()` calls; this prevents restarts when scrolling away and back.
- Add a `poster` skeleton: render the `thumbnailUrl` returned by the backend while the real stream loads. If no thumbnail exists yet, generate one client-side via `canvas` once playback starts and store it in state for future renders.
- Cache `fetch()` responses with the Cache API: when preloading, perform a `fetch(videoUrl, { mode: "no-cors" })` and place the result in a `caches.open('feed-videos')`. Use `URL.createObjectURL` to play from the cached blob while FireFox/Safari work on direct stream playback.

## Optional Backend-Assisted Enhancements
- Ask the backend to deliver a `previewUrl` (GIF/WebM or low bitrate HLS) alongside `videoUrl` so we can autoplay the lightweight asset immediately and swap to the full MP4 once the user pauses or manually plays.
- Return a `preloadPriority`/`rankingScore` so the frontend can decide which videos warrant aggressive prefetch (higher engagement).
- Provide signed URLs with cache-friendly headers (long `Cache-Control`, range requests enabled) so repeated prefetches don’t stress Supabase storage.

## Implementation Checklist
1. Replace the hard-coded mock feed with the real `/videos/feed` call and infinite scroll from `useFeed`.
2. Create `apps/web/src/hooks/useVideoPrefetch.ts` to own link-tag injection + Cache API usage; consume it from `feed/page.tsx`.
3. Update `FeedVideoCard` to accept a `prefetched` flag and avoid calling `.load()` when we already have an object URL.
4. Store any generated poster URLs and revoke them on unmount to prevent leaks.
5. Wire loader/shimmer state so the card shows a thumbnail or preview while the main stream warms up.
6. Coordinate with backend for optional `previewUrl`/`thumbnailUrl` population and long-lived signed URLs.

Once these pieces land, the feed can scroll smoothly with videos ready to play before they hit the viewport, even on slower connections.
