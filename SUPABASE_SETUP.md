# Supabase + Next.js Integration

This workspace has been configured with Supabase and Next.js integration.

## 🚀 What's Included

- **Turborepo monorepo** with pnpm workspaces
- **Next.js 16** with App Router, TypeScript, and Tailwind CSS
- **Supabase client** configured with authentication helpers
- **Ready-to-use components** for auth and user management
- **Custom hooks** for authentication state management

## ⚡ Quick Start

### 1. Install dependencies

```bash
pnpm install
```

### 2. Set up Supabase

1. Create a new project at [supabase.com](https://supabase.com)
2. Go to Project Settings → API
3. Copy your project URL and anon key
4. Create `.env.local` file in `apps/web/`:

```bash
cd apps/web
cp .env.local.example .env.local
```

Edit `.env.local` with your Supabase credentials:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### 3. Start development

```bash
# Start all workspaces with turbo
pnpm dev

# Or start just the web app
cd apps/web && pnpm dev
```

Visit [http://localhost:3000](http://localhost:3000) to see the app.

## 📁 Project Structure

```
ai-video-generator/
├── apps/
│   └── web/                 # Next.js app
│       ├── src/
│       │   ├── app/         # App Router pages
│       │   ├── components/  # React components
│       │   ├── hooks/       # Custom React hooks
│       │   └── lib/         # Utilities & Supabase client
│       └── .env.local.example
├── packages/
│   ├── ui/                  # Shared UI components
│   └── utils/               # Shared utilities
├── turbo.json              # Turborepo config
├── pnpm-workspace.yaml     # pnpm workspaces
└── package.json            # Root package.json
```

## 🔧 Available Scripts

```bash
# Development
pnpm dev          # Start all apps in dev mode
pnpm build        # Build all packages
pnpm lint         # Lint all packages
pnpm test         # Test all packages
```

## 📚 Key Files

### Supabase Configuration

- **`apps/web/src/lib/supabase.ts`** - Supabase client and helper functions
- **`apps/web/src/hooks/useAuth.ts`** - Authentication state management hook

### Components

- **`apps/web/src/components/AuthForm.tsx`** - Sign in/up form
- **`apps/web/src/components/UserProfile.tsx`** - User profile display

### Pages

- **`apps/web/src/app/page.tsx`** - Main homepage with auth demo

## 🎯 Next Steps

1. **Set up your Supabase database schema**

   - Create tables for your AI video data
   - Set up row-level security (RLS) policies

2. **Add more features**

   - File upload for videos/images
   - Database operations for video metadata
   - Real-time subscriptions

3. **Expand the workspace**
   - Add shared packages for video processing
   - Create API routes for AI services
   - Add testing and CI/CD

## 🔒 Authentication Features

The Supabase integration includes:

- Email/password authentication
- Session management with real-time updates
- User profile display
- Sign out functionality
- Protected routes (ready to implement)

## 🎨 Styling

The app uses Tailwind CSS for styling with a clean, modern design. All components are responsive and include loading states.

## 🛠 Development Notes

- The app uses TypeScript throughout
- ESLint is configured for code quality
- The monorepo structure allows for easy scaling
- Turborepo handles build caching and parallel execution

---

Ready to build your AI video generator! 🎬✨
