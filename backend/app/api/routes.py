from __future__ import annotations

import httpx
from fastapi import APIRouter, HTTPException, status

from app.schemas.video import (
    CheckVideoStatusRequest,
    CheckVideoStatusResponse,
    GenerateVideoRequest,
    GenerateVideoResponse,
)
from app.services.flow_client import FlowClient

router = APIRouter()
flow_client = FlowClient()


@router.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@router.post("/generate-video", response_model=GenerateVideoResponse, status_code=status.HTTP_202_ACCEPTED)
async def generate_video(payload: GenerateVideoRequest) -> GenerateVideoResponse:
    try:
        response = await flow_client.generate_video(payload)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc)) from exc
    except httpx.HTTPStatusError as exc:
        detail = _extract_error_detail(exc)
        raise HTTPException(status_code=exc.response.status_code, detail=detail) from exc
    except httpx.RequestError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc)) from exc

    operation_name = _extract_operation_name(response)
    if not operation_name:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Missing operation name in Flow response")

    return GenerateVideoResponse(operation_name=operation_name, raw_response=response)


@router.post("/generation-status", response_model=CheckVideoStatusResponse)
async def generation_status(payload: CheckVideoStatusRequest) -> CheckVideoStatusResponse:
    try:
        response = await flow_client.check_video_status(payload)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc)) from exc
    except httpx.HTTPStatusError as exc:
        detail = _extract_error_detail(exc)
        raise HTTPException(status_code=exc.response.status_code, detail=detail) from exc
    except httpx.RequestError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc)) from exc

    return CheckVideoStatusResponse(raw_response=response)


def _extract_operation_name(response: dict[str, object] | None) -> str | None:
    if not isinstance(response, dict):
        return None
    operations = response.get("operations")
    if not isinstance(operations, list) or not operations:
        return None
    first = operations[0]
    if not isinstance(first, dict):
        return None
    op = first.get("operation")
    if not isinstance(op, dict):
        return None
    name = op.get("name")
    return str(name) if isinstance(name, str) else None


def _extract_error_detail(exc: httpx.HTTPStatusError) -> dict[str, object]:
    if exc.response.headers.get("content-type", "").startswith("application/json"):
        try:
            upstream = exc.response.json()
        except ValueError:
            upstream = exc.response.text
    else:
        upstream = exc.response.text
    return {"message": "Flow API call failed", "upstream": upstream}
