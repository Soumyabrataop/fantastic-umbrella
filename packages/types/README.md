# @zappai/types

Shared TypeScript type definitions for the ZappAI monorepo.

## Overview

This package contains TypeScript type definitions that match the Python Pydantic schemas defined in `backend/app/schemas/`. This ensures type safety between the frontend and backend.

## Usage

### In Frontend (Next.js)

```typescript
import type { Video, Profile, FeedResponse } from "@zappai/types";

// Use the types
const video: Video = {
  id: "123",
  prompt: "A beautiful sunset",
  // ...
};
```

### Type Generation

Types can be auto-generated from Python Pydantic models:

```bash
# From packages/types directory
python generate-types.py

# Or from monorepo root
pnpm --filter @zappai/types generate
```

## Key Types

### Video Types

- `Video` - Complete video object with metadata
- `VideoCreateRequest` - Request payload for creating videos
- `VideoAsset` - Video assets (video file, thumbnail)
- `VideoStatus` - Video generation status enum

### Profile Types

- `Profile` - User profile information
- `ProfileUpdateRequest` - Request payload for updating profile

### Feed Types

- `FeedResponse` - Paginated feed response with videos

### Reaction Types

- `ReactionResponse` - Like/dislike response
- `TrackViewResponse` - View tracking response

## Type Sync Strategy

1. **Source of Truth**: Python Pydantic models in `backend/app/schemas/`
2. **Generation**: Run `python generate-types.py` to update TypeScript types
3. **Manual Overrides**: For custom frontend-specific types, add them to `src/index.ts`
4. **CI/CD**: Add type generation to your build pipeline

## Best Practices

1. **Keep in Sync**: Run type generation after modifying Pydantic schemas
2. **Don't Edit Generated Code**: Manual edits will be overwritten
3. **Use Strict Types**: Enable TypeScript strict mode for better type safety
4. **Import from Package**: Always import from `@zappai/types`, never from local types

## Development

```bash
# Install dependencies
pnpm install

# Build types
pnpm build

# Watch mode (for development)
pnpm dev

# Generate from Python schemas
pnpm generate
```

## Architecture

```
packages/types/
├── src/
│   └── index.ts          # Type definitions
├── generate-types.py     # Python → TypeScript generator
├── package.json
├── tsconfig.json
└── README.md
```

## Integration with Backend

The types in this package mirror the Pydantic schemas:

| Frontend Type        | Backend Schema       |
| -------------------- | -------------------- |
| `Video`              | `VideoRead`          |
| `VideoCreateRequest` | `VideoCreateRequest` |
| `Profile`            | `ProfileRead`        |
| `FeedResponse`       | `FeedResponse`       |

## Future Improvements

- [ ] Automated type generation in CI/CD
- [ ] Runtime type validation using Zod
- [ ] OpenAPI spec generation
- [ ] Type versioning for API changes
