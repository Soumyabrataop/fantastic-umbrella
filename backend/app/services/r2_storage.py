"""
Cloudflare R2 Storage Service
Handles uploading videos to Cloudflare R2 for published content
"""

import logging
from typing import Optional
import boto3
from botocore.exceptions import ClientError
from botocore.client import Config

from app.core.settings import get_settings

logger = logging.getLogger(__name__)


class R2StorageService:
    """Service for uploading and managing videos in Cloudflare R2"""

    def __init__(self):
        settings = get_settings()
        
        # Cloudflare R2 uses S3-compatible API
        self.s3_client = boto3.client(
            "s3",
            endpoint_url=settings.r2_endpoint_url,
            aws_access_key_id=settings.r2_access_key_id,
            aws_secret_access_key=settings.r2_secret_access_key,
            config=Config(signature_version="s3v4"),
            region_name="auto",  # R2 uses "auto" for region
        )
        self.bucket_name = settings.r2_bucket_name
        self.public_url_base = settings.r2_public_url

    async def upload_from_bytes(
        self, 
        video_data: bytes, 
        object_key: str,
        content_type: str = "video/mp4"
    ) -> Optional[str]:
        """
        Upload video bytes to R2
        
        Args:
            video_data: Video file bytes
            object_key: R2 object key (path/filename in bucket)
            content_type: MIME type of the video
            
        Returns:
            Public URL of the uploaded video, or None on failure
        """
        try:
            self.s3_client.put_object(
                Bucket=self.bucket_name,
                Key=object_key,
                Body=video_data,
                ContentType=content_type,
                CacheControl="public, max-age=31536000",  # Cache for 1 year
            )
            
            # Construct public URL
            public_url = f"{self.public_url_base}/{object_key}"
            logger.info(f"Successfully uploaded video to R2: {public_url}")
            return public_url
            
        except ClientError as e:
            logger.error(f"Failed to upload to R2: {str(e)}")
            return None
        except Exception as e:
            logger.error(f"Unexpected error uploading to R2: {str(e)}")
            return None

    async def delete_object(self, object_key: str) -> bool:
        """
        Delete a video from R2
        
        Args:
            object_key: R2 object key to delete
            
        Returns:
            True if deleted successfully, False otherwise
        """
        try:
            self.s3_client.delete_object(
                Bucket=self.bucket_name,
                Key=object_key
            )
            logger.info(f"Successfully deleted R2 object: {object_key}")
            return True
            
        except ClientError as e:
            logger.error(f"Failed to delete from R2: {str(e)}")
            return False
        except Exception as e:
            logger.error(f"Unexpected error deleting from R2: {str(e)}")
            return False

    def get_public_url(self, object_key: str) -> str:
        """Get the public URL for an R2 object"""
        return f"{self.public_url_base}/{object_key}"


# Singleton instance
_r2_service: Optional[R2StorageService] = None


def get_r2_service() -> R2StorageService:
    """Get or create R2 storage service instance"""
    global _r2_service
    if _r2_service is None:
        _r2_service = R2StorageService()
    return _r2_service
