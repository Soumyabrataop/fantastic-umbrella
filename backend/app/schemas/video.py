from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field


class GenerateVideoRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    prompt: str = Field(..., min_length=1)
    aspect_ratio: str | None = Field(None, alias="aspectRatio")
    seed: int | None = None
    video_model_key: str | None = Field(None, alias="videoModelKey")
    scene_id: str | None = Field(None, alias="sceneId")


class GenerateVideoResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    operation_name: str = Field(..., alias="operationName")
    raw_response: dict = Field(..., alias="rawResponse")


class CheckVideoStatusRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    operation_name: str = Field(..., alias="operationName")
    scene_id: str = Field(..., alias="sceneId")
    status: str | None = Field("MEDIA_GENERATION_STATUS_PENDING", alias="status")


class CheckVideoStatusResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    raw_response: dict = Field(..., alias="rawResponse")
