# Cloudflare R2 Setup Guide

## Overview

This guide explains how to set up Cloudflare R2 for video storage in InstaVEO.

## Flow

1. **Generate Video** → Stored in Google Drive (draft)
2. **User Reviews** → Video stays in Google Drive
3. **Click Publish** → Video migrates from Google Drive to Cloudflare R2
4. **Feed Display** → Serves from R2 (fast, no CORS issues)

## Why R2?

- ✅ Zero egress fees (free bandwidth)
- ✅ Fast global CDN delivery
- ✅ No CORS/CSP issues
- ✅ Cost-effective ($0.015/GB/month)
- ✅ Only published videos use R2 storage

## Setup Instructions

### 1. Create Cloudflare R2 Bucket

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. Navigate to **R2** in the left sidebar
3. Click **Create bucket**
4. Name it: `instaveo-videos`
5. Choose a region (or leave as automatic)
6. Click **Create bucket**

### 2. Create R2 API Token

1. In R2, go to **Manage R2 API Tokens**
2. Click **Create API token**
3. Name: `InstaVEO Backend`
4. Permissions: **Object Read & Write**
5. Bucket: Select `instaveo-videos` (or "All buckets")
6. Click **Create API token**
7. **SAVE THESE VALUES** (shown only once):
   - Access Key ID
   - Secret Access Key
   - Endpoint URL (format: `https://<account_id>.r2.cloudflarestorage.com`)

### 3. Set Up Public Access (Custom Domain)

**Option A: Using Cloudflare Domain (Recommended)**

1. In your bucket settings, click **Connect Domain**
2. Choose a subdomain: `videos.yourdomain.com`
3. Cloudflare will automatically configure DNS
4. Use this as your `R2_PUBLIC_URL`

**Option B: Using R2.dev Subdomain (Quick Setup)**

1. In bucket settings, enable **Public Access**
2. Click **Allow Access** → Enable **R2.dev subdomain**
3. Your public URL: `https://pub-<hash>.r2.dev`
4. Use this as your `R2_PUBLIC_URL`

### 4. Configure Backend Environment Variables

Add these to `backend/.env`:

```bash
# Cloudflare R2 Configuration
R2_ENDPOINT_URL=https://<your_account_id>.r2.cloudflarestorage.com
R2_ACCESS_KEY_ID=<your_access_key_id>
R2_SECRET_ACCESS_KEY=<your_secret_access_key>
R2_BUCKET_NAME=instaveo-videos
R2_PUBLIC_URL=https://videos.yourdomain.com
# OR for R2.dev subdomain:
# R2_PUBLIC_URL=https://pub-<hash>.r2.dev
```

**Finding your Account ID:**

- Go to Cloudflare Dashboard
- Click on R2
- Account ID is shown in the URL: `dash.cloudflare.com/<account_id>/r2`

### 5. Run Database Migration

```bash
cd backend
# Apply the migration
psql $DATABASE_URL -f migrations/002_add_r2_support.sql
```

### 6. Install Python Dependencies

```bash
cd backend
pip install boto3
# OR
pip install -r requirements.txt
```

### 7. Test the Setup

1. Start backend:

```bash
cd backend
uvicorn app.main:app --reload --port 8000
```

2. Generate a video (stays in Google Drive)
3. Click **Publish** button
4. Check logs for:

   - "Downloading video from Google Drive"
   - "Uploading video to R2"
   - "Successfully published video to R2"

5. Verify in feed:
   - Video should load from R2 URL
   - Check Network tab: URL should be `https://videos.yourdomain.com/videos/{user_id}/{video_id}.mp4`

## Architecture

### Before Publish (Draft):

```
Flow API → Google Drive → Database (google_drive_file_id)
Frontend → Proxy endpoint → Google Drive
```

### After Publish:

```
Flow API → Google Drive (temporary)
Publish → Download from Drive → Upload to R2 → Database (r2_video_url)
Frontend → Direct R2 URL (fast, no proxy needed)
```

## Cost Estimation

**R2 Pricing:**

- Storage: $0.015/GB/month
- Class A Operations (writes): $4.50 per million requests
- Class B Operations (reads): $0.36 per million requests
- **Egress: FREE** ⭐

**Example for 1000 published videos (500MB each):**

- Storage: 500GB × $0.015 = $7.50/month
- Writes: 1000 uploads ≈ $0.005
- Reads: 100K views ≈ $0.04
- **Total: ~$7.60/month** (vs AWS S3 ~$50+/month with egress)

## Troubleshooting

### Error: "Failed to upload to R2"

- Check R2_ENDPOINT_URL format
- Verify API token has write permissions
- Confirm bucket name matches R2_BUCKET_NAME

### Videos not loading in feed

- Verify R2_PUBLIC_URL is accessible
- Check bucket has public access enabled
- Ensure custom domain DNS is configured

### "File not available in Google Drive"

- Video might not be fully processed
- Check google_drive_file_id exists in database
- Verify user has valid Drive OAuth tokens

## Security Notes

- ✅ R2 credentials stored server-side only
- ✅ Videos only migrate to R2 after user publishes
- ✅ Unpublished videos stay private in Google Drive
- ✅ R2 public URLs are unguessable (UUID-based)

## Benefits

1. **Performance**: Direct CDN delivery (no proxy overhead)
2. **Cost**: Zero egress fees (unlimited bandwidth)
3. **Reliability**: Google Drive as backup, R2 for production
4. **Privacy**: Drafts stay private, only published content goes public
5. **Scalability**: Handle millions of views without cost concerns
