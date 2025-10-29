from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any

import httpx

DEFAULT_METADATA = Path("last_generation.json")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Fetch video status from the local backend (/videos/{id})")
    parser.add_argument(
        "--video-id",
        dest="video_id",
        default=None,
        help="Video UUID (defaults to value stored in metadata file)",
    )
    parser.add_argument(
        "--metadata-in",
        dest="metadata_path",
        type=Path,
        default=DEFAULT_METADATA,
        help="Path to the metadata file produced by test_generate.py",
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
        help="Optional path to save the raw JSON response",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    video_id = _load_video_id(args)

    url = f"{args.host.rstrip('/')}/videos/{video_id}"

    print(f"GET {url}")

    with httpx.Client(timeout=httpx.Timeout(30.0)) as client:
        response = client.get(url)

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


def _load_video_id(args: argparse.Namespace) -> str:
    if args.video_id:
        return args.video_id

    path = args.metadata_path
    if not path.exists():
        raise SystemExit(
            "Video metadata not provided. Pass --video-id or run test_generate.py first to create last_generation.json."
        )

    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise SystemExit(f"Failed to read metadata from {path}: {exc}") from exc

    video_id = data.get("videoId")
    if not isinstance(video_id, str):
        raise SystemExit("Metadata file is missing videoId.")
    return video_id


if __name__ == "__main__":
    main()
