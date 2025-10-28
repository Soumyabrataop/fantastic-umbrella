from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any

import httpx

DEFAULT_PROMPT = "new meow meoww..."


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
        "--check-status",
        action="store_true",
        help="Call the /generation-status endpoint instead of triggering a new generation",
    )
    parser.add_argument(
        "--operation-name",
        dest="operation_name",
        default=None,
        help="Operation name returned from a previous generation (required with --check-status)",
    )
    parser.add_argument(
        "--status-scene-id",
        dest="status_scene_id",
        default=None,
        help="Scene ID associated with the operation (required with --check-status)",
    )
    parser.add_argument(
        "--status-flag",
        dest="status_flag",
        default="MEDIA_GENERATION_STATUS_PENDING",
        help="Status hint to send when polling (optional)",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    if args.check_status:
        if not args.operation_name or not args.status_scene_id:
            raise SystemExit("--operation-name and --status-scene-id are required when --check-status is set")

        payload: dict[str, Any] = {
            "operationName": args.operation_name,
            "sceneId": args.status_scene_id,
        }
        if args.status_flag:
            payload["status"] = args.status_flag

        url = f"{args.host.rstrip('/')}/generation-status"

        print(f"POST {url}")
        print("Payload:", json.dumps(payload, indent=2))

        with httpx.Client(timeout=httpx.Timeout(60.0)) as client:
            response = client.post(url, json=payload)

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

        response.raise_for_status()
        return

    payload: dict[str, Any] = {"prompt": args.prompt}

    if args.aspect_ratio:
        payload["aspectRatio"] = args.aspect_ratio
    if args.seed is not None:
        payload["seed"] = args.seed
    if args.video_model_key:
        payload["videoModelKey"] = args.video_model_key
    if args.scene_id:
        payload["sceneId"] = args.scene_id

    url = f"{args.host.rstrip('/')}/generate-video"

    print(f"POST {url}")
    print("Payload:", json.dumps(payload, indent=2))

    with httpx.Client(timeout=httpx.Timeout(60.0)) as client:
        response = client.post(url, json=payload)

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

    response.raise_for_status()


if __name__ == "__main__":
    main()
