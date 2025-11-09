"""Google Drive service for uploading and managing video files."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
import logging
from pathlib import Path
from typing import Any

from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from googleapiclient.http import MediaFileUpload
from googleapiclient.errors import HttpError

from app.core.settings import Settings, get_settings

logger = logging.getLogger(__name__)


class GoogleDriveService:
    """Service for uploading videos to user's Google Drive."""

    def __init__(self, access_token: str, refresh_token: str, token_expiry: datetime | None = None, settings: Settings | None = None):
        """
        Initialize Google Drive service with user's OAuth credentials.

        Args:
            access_token: User's Google OAuth access token
            refresh_token: User's Google OAuth refresh token
            token_expiry: Token expiration datetime
            settings: Optional settings override
        """
        self._settings = settings or get_settings()
        self._credentials = self._build_credentials(access_token, refresh_token, token_expiry)
        self._drive_service = None
        self._folder_id: str | None = None

    def _build_credentials(self, access_token: str, refresh_token: str, token_expiry: datetime | None) -> Credentials:
        """Build Google OAuth2 credentials."""
        creds = Credentials(
            token=access_token,
            refresh_token=refresh_token,
            token_uri="https://oauth2.googleapis.com/token",
            client_id=self._settings.google_client_id,
            client_secret=self._settings.google_client_secret,
            scopes=["https://www.googleapis.com/auth/drive.file"],
        )
        
        # Set token expiry if provided
        if token_expiry:
            # Google OAuth library expects expiry as naive datetime in UTC
            if token_expiry.tzinfo is not None:
                # Convert timezone-aware datetime to naive UTC
                token_expiry = token_expiry.astimezone(timezone.utc).replace(tzinfo=None)
            creds.expiry = token_expiry
        
        return creds

    def _get_drive_service(self):
        """Get or create Google Drive service instance."""
        if self._drive_service is None:
            # Refresh token if expired
            if self._credentials.expired and self._credentials.refresh_token:
                logger.info("Refreshing expired Google OAuth token")
                self._credentials.refresh(Request())
            
            self._drive_service = build('drive', 'v3', credentials=self._credentials)
        
        return self._drive_service

    def get_updated_tokens(self) -> tuple[str, datetime | None]:
        """
        Get updated access token and expiry after potential refresh.
        
        Returns:
            Tuple of (access_token, token_expiry)
        """
        return (self._credentials.token, self._credentials.expiry)

    def _get_or_create_folder(self) -> str:
        """Get or create InstaVEO folder in user's Drive."""
        if self._folder_id:
            return self._folder_id

        service = self._get_drive_service()
        folder_name = self._settings.google_drive_folder_name

        try:
            # Search for existing folder
            query = f"name='{folder_name}' and mimeType='application/vnd.google-apps.folder' and trashed=false"
            response = service.files().list(
                q=query,
                spaces='drive',
                fields='files(id, name)',
                pageSize=1
            ).execute()

            files = response.get('files', [])
            if files:
                self._folder_id = files[0]['id']
                logger.info(f"Found existing Drive folder: {folder_name} (ID: {self._folder_id})")
                return self._folder_id

            # Create new folder
            folder_metadata = {
                'name': folder_name,
                'mimeType': 'application/vnd.google-apps.folder'
            }
            folder = service.files().create(
                body=folder_metadata,
                fields='id'
            ).execute()
            
            self._folder_id = folder['id']
            logger.info(f"Created new Drive folder: {folder_name} (ID: {self._folder_id})")
            return self._folder_id

        except HttpError as e:
            logger.error(f"Failed to get/create Drive folder: {e}")
            raise

    def upload_file(
        self,
        file_path: str | Path,
        filename: str,
        mime_type: str = 'video/mp4',
        is_public: bool = False,
    ) -> str:
        """
        Upload file to user's Google Drive.

        Args:
            file_path: Local path to file
            filename: Name for the file in Drive
            mime_type: MIME type of the file
            is_public: Whether to make file publicly accessible

        Returns:
            Google Drive file ID

        Raises:
            HttpError: If upload fails
        """
        service = self._get_drive_service()
        folder_id = self._get_or_create_folder()

        file_metadata = {
            'name': filename,
            'parents': [folder_id]
        }

        media = MediaFileUpload(
            str(file_path),
            mimetype=mime_type,
            resumable=True
        )

        try:
            logger.info(f"Uploading file to Google Drive: {filename}")
            file = service.files().create(
                body=file_metadata,
                media_body=media,
                fields='id, webViewLink, webContentLink'
            ).execute()

            file_id = file['id']
            logger.info(f"Successfully uploaded file to Drive: {filename} (ID: {file_id})")

            # Set permissions based on is_public flag
            if is_public:
                self.make_public(file_id)
            else:
                self.make_private(file_id)

            return file_id

        except HttpError as e:
            logger.error(f"Failed to upload file to Drive: {e}")
            raise

    def make_public(self, file_id: str) -> None:
        """
        Make a Drive file publicly accessible (anyone with link can view).

        Args:
            file_id: Google Drive file ID
        """
        service = self._get_drive_service()

        try:
            # Add permission for anyone with link
            permission = {
                'type': 'anyone',
                'role': 'reader'
            }
            service.permissions().create(
                fileId=file_id,
                body=permission,
                fields='id'
            ).execute()
            
            logger.info(f"Made Drive file public: {file_id}")

        except HttpError as e:
            logger.error(f"Failed to make file public: {e}")
            raise

    def make_private(self, file_id: str) -> None:
        """
        Make a Drive file private (remove public access).

        Args:
            file_id: Google Drive file ID
        """
        service = self._get_drive_service()

        try:
            # List all permissions
            permissions = service.permissions().list(
                fileId=file_id,
                fields='permissions(id, type)'
            ).execute()

            # Remove 'anyone' permissions
            for permission in permissions.get('permissions', []):
                if permission.get('type') == 'anyone':
                    service.permissions().delete(
                        fileId=file_id,
                        permissionId=permission['id']
                    ).execute()
                    logger.info(f"Removed public permission from Drive file: {file_id}")

        except HttpError as e:
            logger.error(f"Failed to make file private: {e}")
            raise

    def get_file_url(self, file_id: str) -> str:
        """
        Get download URL for a Drive file (works for video playback).

        Args:
            file_id: Google Drive file ID

        Returns:
            Download URL for the file
        """
        # Use download format for video playback compatibility
        return f"https://drive.google.com/uc?export=download&id={file_id}"

    def get_embed_url(self, file_id: str) -> str:
        """
        Get embeddable URL for a Drive file.

        Args:
            file_id: Google Drive file ID

        Returns:
            Embeddable URL (for video player)
        """
        return f"https://drive.google.com/file/d/{file_id}/preview"

    def delete_file(self, file_id: str) -> None:
        """
        Delete a file from Google Drive.

        Args:
            file_id: Google Drive file ID
        """
        service = self._get_drive_service()

        try:
            service.files().delete(fileId=file_id).execute()
            logger.info(f"Deleted Drive file: {file_id}")
        except HttpError as e:
            logger.error(f"Failed to delete file from Drive: {e}")
            raise
