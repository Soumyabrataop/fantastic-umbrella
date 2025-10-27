# AI Video Generator - Frontend

Modern Next.js 15 frontend for the AI Video Generator app with infinite scroll feed, video creation, and user profiles.

## 🚀 Features

- **Authentication**: Supabase Auth integration with email/password
- **Video Feed**: Infinite scroll feed with ranking algorithm
- **Create Videos**: AI-powered video generation from text prompts
- **User Profile**: View your videos, stats, and liked content
- **Video Actions**: Like, dislike, recreate, and share videos
- **Ads Integration**: Monetization-ready with ad cards in feed
- **Responsive Design**: Mobile-first design with TailwindCSS

## 📁 Project Structure

```
apps/web/
├── app/
│   ├── feed/           # Video feed with infinite scroll
│   ├── create/         # Video creation page
│   ├── profile/        # User profile and videos
│   ├── layout.tsx      # Root layout with providers
│   └── page.tsx        # Landing/auth page
├── components/
│   ├── VideoCard.tsx   # Video player with actions
│   ├── AdCard.tsx      # Advertisement component
│   ├── Navbar.tsx      # Bottom navigation
│   ├── AuthForm.tsx    # Login/signup form
│   └── UserProfile.tsx # User profile component
├── hooks/
│   ├── useAuth.ts      # Authentication hook
│   ├── useFeed.ts      # Infinite scroll feed logic
│   ├── useVideoActions.ts  # Video interactions
│   └── useToast.ts     # Toast notifications
├── utils/
│   ├── api.ts          # API client and types
│   └── ranking.ts      # Ranking algorithm helpers
└── lib/
    └── supabase.ts     # Supabase client
```

## 🛠️ Setup

### 1. Install Dependencies

```bash
cd apps/web
pnpm install
```

### 2. Configure Environment Variables

Copy the example environment file:

```bash
cp .env.local.example .env.local
```

Update `.env.local` with your credentials:

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# Backend API URL (your Cloud Run URL or local server)
NEXT_PUBLIC_API_URL=https://your-api.run.app
```

### 3. Run Development Server

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## 📱 Pages

### Landing Page (`/`)

- Hero section with features
- Authentication form (login/signup)
- Auto-redirects to feed if authenticated

### Feed (`/feed`)

- Infinite scroll video feed
- Videos ranked by engagement + recency
- Ad cards every 3 videos
- Auto-play on scroll
- Like/dislike/recreate/share actions

### Create (`/create`)

- Text prompt input for video generation
- Example prompts for inspiration
- Real-time generation status
- Redirects to feed after creation

### Profile (`/profile`)

- User stats (videos, likes)
- Tabs: My Videos / Liked Videos
- Sign out functionality
- Video grid view

## 🎨 Components

### VideoCard

- Video player with auto-play
- Like/dislike counters
- Recreate button (same prompt)
- Share functionality
- View tracking

### AdCard

- Multiple ad variations
- Placement every 3 videos
- Call-to-action buttons
- Responsive design

### Navbar

- Bottom navigation (mobile-first)
- Active route highlighting
- Icons for Feed, Create, Profile

## 🔌 API Integration

The app connects to a backend API (expected endpoints):

```typescript
// Video Endpoints
GET  /videos/feed?cursor={cursor}&limit={limit}
GET  /videos/{videoId}
POST /videos/create
POST /videos/{videoId}/like
POST /videos/{videoId}/dislike
POST /videos/{videoId}/view
POST /videos/{videoId}/recreate
GET  /users/{userId}/videos
GET  /users/{userId}/liked

// User Endpoints
GET   /users/{userId}
PATCH /users/{userId}
```

## 🧠 Ranking Algorithm

Videos are ranked using:

```
Score = (likes - dislikes) * log10(views + 1) + (100 * e^(-age_hours/24))
```

- **Engagement**: Net likes weighted by view count
- **Recency**: Exponential decay (10% per 24h)
- **Result**: Fresh + popular content ranks highest

## 🎯 Key Features

### Infinite Scroll

- Uses `@tanstack/react-query` for data fetching
- Intersection Observer for scroll detection
- Automatic pagination with cursor-based loading

### Video Interactions

- Optimistic updates for instant feedback
- Query invalidation for real-time data
- Error handling with toast notifications

### Authentication Flow

1. User lands on home page
2. Signs up/logs in with email
3. Redirected to feed
4. Can access create/profile pages

## 📦 Dependencies

```json
{
  "@tanstack/react-query": "^5.x",
  "@supabase/supabase-js": "^2.x",
  "axios": "^1.x",
  "next": "^15.x",
  "react": "^19.x",
  "tailwindcss": "^4.x"
}
```

## 🚀 Deployment

### Vercel (Recommended)

```bash
# Install Vercel CLI
pnpm add -g vercel

# Deploy
vercel
```

Add environment variables in Vercel dashboard.

### Docker

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN pnpm install
COPY . .
RUN pnpm build
CMD ["pnpm", "start"]
```

## 🔧 Development Tips

### Mock API During Development

Update `utils/api.ts` to return mock data:

```typescript
export const videoAPI = {
  getFeed: async () => ({
    videos: mockVideos,
    hasMore: false,
  }),
  // ... other methods
};
```

### Toast Notifications

Replace simple alerts with a library:

```bash
pnpm add react-hot-toast
```

Update `hooks/useToast.ts` to use the library.

### Environment Variables

- `NEXT_PUBLIC_*` variables are exposed to the browser
- Don't put secrets in `NEXT_PUBLIC_*` variables
- Backend API handles sensitive operations

## 📝 TODO / Future Enhancements

- [ ] Add video comments system
- [ ] Implement search functionality
- [ ] Add video filters (trending, recent, etc.)
- [ ] Dark mode support
- [ ] Video progress saving
- [ ] Push notifications
- [ ] Video analytics dashboard
- [ ] Social sharing integrations
- [ ] Video download option

## 🐛 Troubleshooting

### "Cannot find module @tanstack/react-query"

```bash
pnpm install @tanstack/react-query
```

### "Supabase not connected"

Check `.env.local` has valid credentials from your Supabase project.

### "API errors"

Ensure backend API is running and `NEXT_PUBLIC_API_URL` is correct.

### TypeScript errors

```bash
pnpm exec tsc --noEmit
```

## 📄 License

MIT
