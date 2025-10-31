"""GCP Storage client for uploading and managing video assets."""

from __future__ import annotations

import asyncio
import logging
from typing import Optional

from google.cloud import storage
from google.cloud.exceptions import GoogleCloudError, NotFound
from google.api_core import retry

logger = logging.getLogger(__name__)


class GCPStorageClient:
    """Client for interacting with Google Cloud Storage."""

    def __init__(self, bucket_name: str, credentials_path: str | None = None):
        """
        Initialize GCP Storage client with bucket and credentials.

        Args:
            bucket_name: Name of the GCP bucket to use
            credentials_path: Path to service account JSON key file.
                            If None, uses Application Default Credentials (ADC)
        """
        self.bucket_name = bucket_name
        self.credentials_path = credentials_path

        try:
            if credentials_path:
                self.client = storage.Client.from_service_account_json(credentials_path)
                logger.info(f"Initialized GCP Storage client with credentials from {credentials_path}")
            else:
                self.client = storage.Client()
                logger.info("Initialized GCP Storage client with Application Default Credentials")

            self.bucket = self.client.bucket(bucket_name)
            logger.info(f"Connected to GCP bucket: {bucket_name}")

        except Exception as e:
            logger.error(f"Failed to initialize GCP Storage client: {e}")
            raise

    async def upload_file(
        self,
        source_data: bytes,
        destination_blob_name: str,
        content_type: str | None = None,
    ) -> str:
        """
        Upload file to GCP bucket with retry logic.

        Args:
            source_data: File content as bytes
            destination_blob_name: Target path in the bucket (e.g., "videos/uuid/video.mp4")
            content_type: MIME type of the file (e.g., "video/mp4", "image/jpeg")

        Returns:
            The blob name (destination_blob_name) on success

        Raises:
            GoogleCloudError: If upload fails after all retry attempts
        """
        # Infer content type from file extension if not provided
        if content_type is None:
            content_type = self._infer_content_type(destination_blob_name)

        # Define retry strategy with exponential backoff (3 attempts)
        retry_strategy = retry.Retry(
            initial=1.0,  # Initial delay of 1 second
            maximum=10.0,  # Maximum delay of 10 seconds
            multiplier=2.0,  # Exponential backoff multiplier
            deadline=60.0,  # Total timeout of 60 seconds
            predicate=retry.if_exception_type(GoogleCloudError),
        )

        def _upload():
            """Synchronous upload function to be run in thread."""
            blob = self.bucket.blob(destination_blob_name)
            blob.upload_from_string(
                source_data,
                content_type=content_type,
                retry=retry_strategy,
            )
            logger.info(
                f"Successfully uploaded {len(source_data)} bytes to gs://{self.bucket_name}/{destination_blob_name}"
            )
            return destination_blob_name

        try:
            # Run the blocking upload in a thread pool
            result = await asyncio.to_thread(_upload)
            return result
        except GoogleCloudError as e:
            logger.error(
                f"Failed to upload to gs://{self.bucket_name}/{destination_blob_name} after retries: {e}"
            )
            raise
        except Exception as e:
            logger.error(f"Unexpected error during upload: {e}")
            raise

    def generate_signed_url(
        self,
        blob_name: str,
        expiration_seconds: int = 3600,
    ) -> str:
        """
        Generate a signed URL for accessing a blob.

        Args:
            blob_name: Name of the blob in the bucket
            expiration_seconds: URL expiration time in seconds (default: 3600 = 1 hour)

        Returns:
            Signed URL string

        Raises:
            GoogleCloudError: If signed URL generation fails
        """
        try:
            blob = self.bucket.blob(blob_name)
            url = blob.generate_signed_url(
                version="v4",
                expiration=expiration_seconds,
                method="GET",
            )
            logger.debug(f"Generated signed URL for {blob_name} (expires in {expiration_seconds}s)")
            return url
        except Exception as e:
            logger.error(f"Failed to generate signed URL for {blob_name}: {e}")
            raise

    async def blob_exists(self, blob_name: str) -> bool:
        """
        Check if a blob exists in the bucket.

        Args:
            blob_name: Name of the blob to check

        Returns:
            True if blob exists, False otherwise
        """
        def _check_exists():
            """Synchronous existence check to be run in thread."""
            blob = self.bucket.blob(blob_name)
            return blob.exists()

        try:
            exists = await asyncio.to_thread(_check_exists)
            logger.debug(f"Blob {blob_name} exists: {exists}")
            return exists
        except Exception as e:
            logger.error(f"Error checking if blob {blob_name} exists: {e}")
            return False

    async def delete_blob(self, blob_name: str) -> None:
        """
        Delete a blob from the bucket.

        Args:
            blob_name: Name of the blob to delete

        Raises:
            NotFound: If blob does not exist
            GoogleCloudError: If deletion fails
        """
        def _delete():
            """Synchronous delete function to be run in thread."""
            blob = self.bucket.blob(blob_name)
            blob.delete()
            logger.info(f"Deleted blob: gs://{self.bucket_name}/{blob_name}")

        try:
            await asyncio.to_thread(_delete)
        except NotFound:
            logger.warning(f"Blob not found for deletion: {blob_name}")
            raise
        except GoogleCloudError as e:
            logger.error(f"Failed to delete blob {blob_name}: {e}")
            raise
        except Exception as e:
            logger.error(f"Unexpected error during blob deletion: {e}")
            raise

    @staticmethod
    def _infer_content_type(filename: str) -> str:
        """
        Infer MIME type from file extension.

        Args:
            filename: Name of the file

        Returns:
            MIME type string
        """
        extension = filename.lower().split(".")[-1] if "." in filename else ""
        content_types = {
            "mp4": "video/mp4",
            "webm": "video/webm",
            "mov": "video/quicktime",
            "avi": "video/x-msvideo",
            "jpg": "image/jpeg",
            "jpeg": "image/jpeg",
            "png": "image/png",
            "gif": "image/gif",
            "webp": "image/webp",
        }
        return content_types.get(extension, "application/octet-stream")
