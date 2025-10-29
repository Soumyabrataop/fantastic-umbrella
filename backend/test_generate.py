from __future__ import annotations

import argparse
import hashlib
import hmac
import json
import os
import time
from pathlib import Path
from typing import Any

import httpx

DEFAULT_PROMPT = "new meow meoww..."
DEFAULT_TOKEN_ENV = "SUPABASE_ACCESS_TOKEN"
DEFAULT_SIGNATURE_ENV = "REQUEST_SIGNATURE_SECRET"
DEFAULT_SIGNATURE_HEADER = "x-instaveo-signature"
DEFAULT_TIMESTAMP_HEADER = "x-instaveo-timestamp"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Trigger Flow/Veo3 video generation via local proxy")
    parser.add_argument(
        "--prompt",
        default=DEFAULT_PROMPT,
        help="Prompt text to send to the Flow API",
    )
    parser.add_argument(
        "--aspect-ratio",
        dest="aspect_ratio",
        default=None,
        help="Override aspect ratio (default from settings)",
    )
    parser.add_argument(
        "--seed",
        type=int,
        default=None,
        help="Optional fixed seed for reproducibility",
    )
    parser.add_argument(
        "--model",
        dest="video_model_key",
        default=None,
        help="Override video model key",
    )
    parser.add_argument(
        "--scene-id",
        dest="scene_id",
        default=None,
        help="Provide a specific scene ID (UUID)",
    )
    parser.add_argument(
        "--host",
        default="http://localhost:8000",
        help="FastAPI service host",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=None,
        help="Optional path to save the raw API response as JSON",
    )
    parser.add_argument(
        "--metadata-out",
        type=Path,
        default=Path("last_generation.json"),
        help="Optional path to store the video metadata for later status checks",
    )
    parser.add_argument(
        "--token",
        default=None,
        help=f"Supabase access token (defaults to env {DEFAULT_TOKEN_ENV})",
    )
    parser.add_argument(
        "--signature-secret",
        dest="signature_secret",
        default=None,
        help=f"Shared HMAC secret (defaults to env {DEFAULT_SIGNATURE_ENV})",
    )
    parser.add_argument(
        "--signature-header",
        dest="signature_header",
        default=DEFAULT_SIGNATURE_HEADER,
        help="Header name used for the request signature",
    )
    parser.add_argument(
        "--timestamp-header",
        dest="timestamp_header",
        default=DEFAULT_TIMESTAMP_HEADER,
        help="Header name used for the request timestamp",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()

    token = args.token or os.environ.get(DEFAULT_TOKEN_ENV)
    if not token:
        raise SystemExit(
            "Supabase access token missing. Provide --token or set SUPABASE_ACCESS_TOKEN in the environment."
        )

    signature_secret = args.signature_secret or os.environ.get(DEFAULT_SIGNATURE_ENV)
    if not signature_secret:
        raise SystemExit(
            "Request signature secret missing. Provide --signature-secret or set REQUEST_SIGNATURE_SECRET in the environment."
        )

    payload: dict[str, Any] = {"prompt": args.prompt}

    if args.aspect_ratio:
        payload["aspectRatio"] = args.aspect_ratio
    if args.seed is not None:
        payload["seed"] = args.seed
    if args.video_model_key:
        payload["videoModelKey"] = args.video_model_key
    if args.scene_id:
        payload["sceneId"] = args.scene_id

    url = f"{args.host.rstrip('/')}/videos/create"

    print(f"POST {url}")
    print("Payload:", json.dumps(payload, indent=2))

    body_bytes = json.dumps(payload, separators=(",", ":"), ensure_ascii=False).encode("utf-8")
    timestamp = str(int(time.time()))
    signature = _compute_signature(
        secret=signature_secret,
        timestamp=timestamp,
        method="POST",
        path="/videos/create",
        body=body_bytes,
    )

    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {token}",
        args.signature_header: signature,
        args.timestamp_header: timestamp,
    }

    with httpx.Client(timeout=httpx.Timeout(60.0)) as client:
        response = client.post(url, content=body_bytes, headers=headers)

    print(f"Response status: {response.status_code}")
    try:
        body = response.json()
        print("Response body:")
        print(json.dumps(body, indent=2))
    except ValueError:
        body = response.text
        print("Response body (text):")
        print(body)

    if args.output:
        args.output.write_text(json.dumps(body, indent=2), encoding="utf-8")
        print(f"Saved raw response to {args.output}")

    if isinstance(body, dict):
        metadata = _extract_video_metadata(body)
        if metadata:
            args.metadata_out.write_text(json.dumps(metadata, indent=2), encoding="utf-8")
            print(f"Saved video metadata to {args.metadata_out}")
        else:
            print("Warning: Could not find video metadata in response.")

    response.raise_for_status()


def _extract_video_metadata(response: dict[str, Any]) -> dict[str, Any] | None:
    video_id = response.get("id")
    if not isinstance(video_id, str):
        return None

    data: dict[str, Any] = {
        "videoId": video_id,
        "status": response.get("status"),
        "prompt": response.get("prompt"),
    }
    return data


def _compute_signature(*, secret: str, timestamp: str, method: str, path: str, body: bytes) -> str:
    components = [timestamp, method.upper(), path]
    if body:
        components.append(body.decode("utf-8"))
    payload = "\n".join(components).encode("utf-8")
    return hmac.new(secret.encode("utf-8"), payload, hashlib.sha256).hexdigest()


if __name__ == "__main__":
    main()
