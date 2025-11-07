-- Migration: Add Google Drive OAuth and publishing support
-- Description: Adds Google OAuth tokens to profiles, Drive file IDs and is_published flag to videos
-- Date: 2025-11-05

-- Add Google OAuth tokens to profiles table
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS google_access_token TEXT,
ADD COLUMN IF NOT EXISTS google_refresh_token TEXT,
ADD COLUMN IF NOT EXISTS google_token_expiry TIMESTAMP WITH TIME ZONE;

-- Add Google Drive file IDs and publishing flag to videos table
ALTER TABLE videos
ADD COLUMN IF NOT EXISTS is_published BOOLEAN NOT NULL DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS google_drive_file_id VARCHAR(255),
ADD COLUMN IF NOT EXISTS google_drive_thumbnail_id VARCHAR(255);

-- Create index on is_published for faster feed queries
CREATE INDEX IF NOT EXISTS idx_videos_is_published ON videos(is_published);

-- Create index on google_drive_file_id for lookups
CREATE INDEX IF NOT EXISTS idx_videos_google_drive_file_id ON videos(google_drive_file_id);

COMMENT ON COLUMN profiles.google_access_token IS 'Google OAuth access token for Drive API';
COMMENT ON COLUMN profiles.google_refresh_token IS 'Google OAuth refresh token for Drive API';
COMMENT ON COLUMN profiles.google_token_expiry IS 'Expiration time of Google OAuth access token';
COMMENT ON COLUMN videos.is_published IS 'Whether video is published and visible in public feed';
COMMENT ON COLUMN videos.google_drive_file_id IS 'Google Drive file ID for the video';
COMMENT ON COLUMN videos.google_drive_thumbnail_id IS 'Google Drive file ID for the thumbnail';
