# ai-video-generator (monorepo)

This repository is initialized as a Turborepo monorepo using pnpm workspaces.

Quick start (Windows cmd.exe):

1. Ensure pnpm is available. If you have Node >=16.10 and Corepack enabled:

   corepack enable
   corepack prepare pnpm@latest --activate

   Or install pnpm globally:

   npm install -g pnpm

2. Install dependencies at the repo root:

   pnpm install

3. Start dev (runs `dev` scripts in all packages via Turbo):

   pnpm dev

Files added:

- `package.json` - root workspace config and turbo scripts
- `pnpm-workspace.yaml` - pnpm workspace packages
- `turbo.json` - turborepo pipeline config
- `apps/web` - placeholder web app
- `packages/ui`, `packages/utils` - example packages

Next steps:

- Replace the placeholder package.json scripts with real dev/build tooling (Next.js, Vite, etc.).
- Add shared eslint/prettier configs and CI tasks.
