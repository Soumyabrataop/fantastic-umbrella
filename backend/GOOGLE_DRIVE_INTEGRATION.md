# Google Drive OAuth Integration for InstaVEO

## Overview

InstaVEO now uses **Google Drive** to store user videos instead of GCP Cloud Storage. This gives users:
- ✅ Full ownership of their video files in their own Google Drive
- ✅ Privacy control - videos are private by default
- ✅ Publish/unpublish control - users decide when videos go public
- ✅ No storage costs for the platform

## How It Works

### 1. User Flow

1. **OAuth Connection**: User clicks "Connect Google Drive" → OAuth consent screen
2. **Authorization**: User grants Drive access → Tokens stored securely
3. **Video Creation**: User creates video → Video uploaded to their Drive (private)
4. **Publishing**: User clicks "Publish" → Video becomes visible in public feed
5. **Drive Permissions**: Published videos are made publicly viewable

### 2. Architecture

```
User creates video
    ↓
Flow API generates video
    ↓
Backend downloads from Flow API
    ↓
Backend uploads to user's Google Drive (PRIVATE)
    ↓
Video stored in "InstaVEO Videos" folder
    ↓
User clicks "Publish"
    ↓
Backend sets Drive permissions to PUBLIC
    ↓
Video appears in feed with embed URL
```

### 3. Database Schema

**Videos Table**:
- `is_published` (boolean): Whether video is in public feed
- `google_drive_file_id` (string): Drive file ID for video
- `google_drive_thumbnail_id` (string): Drive file ID for thumbnail

**Profiles Table**:
- `google_access_token` (string): OAuth access token
- `google_refresh_token` (string): OAuth refresh token
- `google_token_expiry` (timestamp): Token expiration time

## Setup Instructions

### 1. Google Cloud Console Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Enable **Google Drive API**:
   - Go to "APIs & Services" → "Enable APIs and Services"
   - Search for "Google Drive API"
   - Click "Enable"

4. Create OAuth 2.0 Credentials:
   - Go to "APIs & Services" → "Credentials"
   - Click "Create Credentials" → "OAuth client ID"
   - Application type: "Web application"
   - Add authorized redirect URIs:
     - `http://localhost:8000/api/auth/google/callback` (development)
     - `https://your-domain.com/api/auth/google/callback` (production)
   - Click "Create"
   - **Copy the Client ID and Client Secret**

5. Configure OAuth Consent Screen:
   - Go to "APIs & Services" → "OAuth consent screen"
   - User type: "External" (for testing) or "Internal" (for organization)
   - Add scopes:
     - `https://www.googleapis.com/auth/drive.file`
     - `https://www.googleapis.com/auth/userinfo.email`
   - Add test users (if External with testing mode)

### 2. Backend Configuration

1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```

2. Update `.env` with your Google OAuth credentials:
   ```env
   GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
   GOOGLE_CLIENT_SECRET=your-client-secret
   GOOGLE_REDIRECT_URI=http://localhost:8000/api/auth/google/callback
   GOOGLE_DRIVE_FOLDER_NAME=InstaVEO Videos
   
   # Set storage backend to "drive"
   MEDIA_STORAGE_BACKEND=drive
   ```

3. Install required Python packages:
   ```bash
   pip install google-auth google-auth-oauthlib google-auth-httplib2 google-api-python-client
   ```

4. Run database migration:
   ```bash
   psql -d your_database -f migrations/001_add_google_drive_oauth.sql
   ```
   
   Or manually run the SQL commands in your database client.

5. Start the backend:
   ```bash
   python -m uvicorn app.main:app --reload
   ```

### 3. Frontend Integration

#### Connect Google Drive

```typescript
// Redirect user to OAuth flow
window.location.href = 'http://localhost:8000/api/auth/google/login';

// Check connection status
const response = await fetch('/api/auth/google/status');
const { is_connected, email } = await response.json();
```

#### Publish/Unpublish Videos

```typescript
// Publish video
const response = await fetch(`/api/videos/${videoId}/publish`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${token}` }
});

// Unpublish video
const response = await fetch(`/api/videos/${videoId}/unpublish`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${token}` }
});
```

#### UI Components

```tsx
// Connection button
{!isConnected ? (
  <button onClick={() => window.location.href = '/api/auth/google/login'}>
    Connect Google Drive
  </button>
) : (
  <div>
    <span>Connected: {email}</span>
    <button onClick={disconnect}>Disconnect</button>
  </div>
)}

// Publish button (on user's own videos)
{!video.is_published ? (
  <button onClick={() => publishVideo(video.id)}>
    Publish to Feed
  </button>
) : (
  <button onClick={() => unpublishVideo(video.id)}>
    Remove from Feed
  </button>
)}
```

## API Endpoints

### Google OAuth

#### `GET /api/auth/google/status`
Check if user has connected Google Drive.

**Response**:
```json
{
  "is_connected": true,
  "email": "user@example.com"
}
```

#### `GET /api/auth/google/login`
Initiate OAuth flow. Redirects to Google consent screen.

#### `GET /api/auth/google/callback?code=...&state=...`
OAuth callback handler. Stores tokens and redirects to frontend.

#### `POST /api/auth/google/disconnect`
Disconnect Google Drive and remove stored tokens.

### Video Publishing

#### `POST /api/videos/{video_id}/publish`
Publish video - makes it visible in feed and sets Drive permissions to public.

**Authentication**: Required
**Authorization**: Must be video owner

**Response**: `VideoRead` with `is_published: true`

#### `POST /api/videos/{video_id}/unpublish`
Unpublish video - removes from feed and sets Drive permissions to private.

**Authentication**: Required
**Authorization**: Must be video owner

**Response**: `VideoRead` with `is_published: false`

### Feed Changes

#### `GET /api/videos/feed`
Now only returns videos where `is_published = true`.

## Security Considerations

1. **Token Storage**: OAuth tokens are stored encrypted in the database
2. **Token Refresh**: Tokens automatically refresh when expired
3. **CSRF Protection**: OAuth state parameter prevents CSRF attacks
4. **Scope Limitation**: Only requests `drive.file` scope (access to files created by app)
5. **User Ownership**: Users can only publish/unpublish their own videos

## Drive File Structure

```
User's Google Drive
└── InstaVEO Videos/
    ├── {video-id}.mp4
    ├── {video-id}_thumbnail.jpg
    ├── {another-video-id}.mp4
    └── {another-video-id}_thumbnail.jpg
```

## Video Embed URLs

Published videos use Google Drive's embed URL format:
```
https://drive.google.com/file/d/{file_id}/preview
```

This allows direct embedding in video players without download limits.

## Troubleshooting

### "User has not connected Google Drive"
- User needs to complete OAuth flow first
- Check `/api/auth/google/status` endpoint
- Verify tokens are stored in database

### "Failed to update Drive permissions"
- Check Google Drive API is enabled
- Verify OAuth scopes include `drive.file`
- Check token expiry and refresh

### "Invalid redirect URI"
- Ensure redirect URI in Google Console matches `GOOGLE_REDIRECT_URI` in `.env`
- URIs are case-sensitive and must match exactly

### Videos not appearing in feed
- Check `is_published` field is `true`
- Verify Drive file permissions are set to public
- Check video status is `COMPLETED`

## Migration from GCP

If migrating from GCP Storage:

1. ✅ All GCP code has been removed
2. ✅ Existing videos will continue to work (using old URLs)
3. ✅ New videos will use Google Drive
4. ⚠️ Users must connect Google Drive before creating new videos
5. ⚠️ Set `MEDIA_STORAGE_BACKEND=drive` in `.env`

## Development Tips

- Use `MEDIA_STORAGE_BACKEND=local` for testing without OAuth
- Test OAuth flow in incognito mode to verify new user experience
- Monitor backend logs for token refresh events
- Use Google's [OAuth 2.0 Playground](https://developers.google.com/oauthplayground/) to test scopes

## Production Checklist

- [ ] OAuth consent screen published (not in testing mode)
- [ ] Production redirect URI added to Google Console
- [ ] `GOOGLE_REDIRECT_URI` updated in `.env`
- [ ] SSL/HTTPS enabled for OAuth callback
- [ ] Database migration applied
- [ ] Environment variables configured
- [ ] Google Drive API enabled
- [ ] Token refresh monitoring enabled
