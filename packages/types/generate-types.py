"""
Generate TypeScript types from Python Pydantic models
Run this script from the monorepo root: python packages/types/generate-types.py
"""
import sys
import json
from pathlib import Path
from typing import Any, Dict

# Add backend to path
backend_path = Path(__file__).parent.parent.parent / "backend"
sys.path.insert(0, str(backend_path))

from app.schemas.media import (
    VideoRead,
    VideoCreateRequest,
    ProfileRead,
    ProfileUpdateRequest,
    VideoAssetRead,
    FeedResponse,
    ReactionResponse,
    TrackViewResponse,
)
from app.schemas.video import (
    GenerateVideoRequest,
    GenerateVideoResponse,
    CheckVideoStatusRequest,
    CheckVideoStatusResponse,
)


def pydantic_to_typescript_type(python_type: str) -> str:
    """Convert Python type annotations to TypeScript types"""
    type_map = {
        "str": "string",
        "int": "number",
        "float": "number",
        "bool": "boolean",
        "datetime": "string",  # ISO format
        "UUID": "string",
        "None": "null",
        "Any": "any",
    }
    
    # Handle Optional types
    if "None" in python_type or "| None" in python_type:
        base_type = python_type.replace(" | None", "").replace("None |", "").strip()
        return f"{pydantic_to_typescript_type(base_type)} | null"
    
    # Handle list types
    if python_type.startswith("list["):
        inner = python_type[5:-1]
        return f"Array<{pydantic_to_typescript_type(inner)}>"
    
    # Map basic types
    for py_type, ts_type in type_map.items():
        if py_type in python_type:
            return ts_type
    
    # Return as-is for complex types (will be interfaces)
    return python_type


def generate_interface(schema_class: Any, name: str) -> str:
    """Generate TypeScript interface from Pydantic model"""
    schema = schema_class.model_json_schema()
    
    lines = [f"export interface {name} {{"]
    
    properties = schema.get("properties", {})
    required_fields = set(schema.get("required", []))
    
    for field_name, field_info in properties.items():
        field_type = field_info.get("type", "any")
        
        # Handle different JSON schema types
        if field_type == "string":
            ts_type = "string"
            if field_info.get("format") == "date-time":
                ts_type = "string"  # ISO datetime string
            elif field_info.get("format") == "uuid":
                ts_type = "string"  # UUID string
        elif field_type == "integer" or field_type == "number":
            ts_type = "number"
        elif field_type == "boolean":
            ts_type = "boolean"
        elif field_type == "array":
            items = field_info.get("items", {})
            item_ref = items.get("$ref", "")
            if item_ref:
                item_type = item_ref.split("/")[-1]
                ts_type = f"Array<{item_type}>"
            else:
                ts_type = "Array<any>"
        elif field_type == "object":
            ts_type = "Record<string, any>"
        elif "$ref" in field_info:
            ts_type = field_info["$ref"].split("/")[-1]
        else:
            ts_type = "any"
        
        # Handle nullable/optional fields
        optional_marker = "" if field_name in required_fields else "?"
        null_union = " | null" if field_name not in required_fields else ""
        
        # Convert snake_case to camelCase for TypeScript
        ts_field_name = "".join(
            word.capitalize() if i > 0 else word
            for i, word in enumerate(field_name.split("_"))
        )
        
        lines.append(f"  {ts_field_name}{optional_marker}: {ts_type}{null_union};")
    
    lines.append("}")
    return "\n".join(lines)


def main():
    output_dir = Path(__file__).parent / "src"
    output_dir.mkdir(exist_ok=True)
    
    # Generate types file
    output_lines = [
        "/**",
        " * Auto-generated TypeScript types from Python Pydantic models",
        " * DO NOT EDIT MANUALLY - Run `pnpm generate` in packages/types to regenerate",
        " */",
        "",
    ]
    
    # Define all schemas to generate
    schemas = [
        ("VideoRead", VideoRead),
        ("VideoCreateRequest", VideoCreateRequest),
        ("ProfileRead", ProfileRead),
        ("ProfileUpdateRequest", ProfileUpdateRequest),
        ("VideoAssetRead", VideoAssetRead),
        ("FeedResponse", FeedResponse),
        ("ReactionResponse", ReactionResponse),
        ("TrackViewResponse", TrackViewResponse),
        ("GenerateVideoRequest", GenerateVideoRequest),
        ("GenerateVideoResponse", GenerateVideoResponse),
        ("CheckVideoStatusRequest", CheckVideoStatusRequest),
        ("CheckVideoStatusResponse", CheckVideoStatusResponse),
    ]
    
    # Add enums
    output_lines.extend([
        "// Enums",
        "export type VideoStatus = 'pending' | 'generating' | 'completed' | 'failed';",
        "export type AssetType = 'video' | 'thumbnail';",
        "export type ReactionType = 'like' | 'dislike';",
        "",
    ])
    
    # Generate interfaces
    for name, schema_class in schemas:
        try:
            interface = generate_interface(schema_class, name)
            output_lines.append(interface)
            output_lines.append("")
        except Exception as e:
            print(f"Error generating {name}: {e}")
            continue
    
    # Add index export
    output_file = output_dir / "index.ts"
    output_file.write_text("\n".join(output_lines))
    
    print(f"✅ Generated TypeScript types at {output_file}")
    print(f"   Generated {len(schemas)} type definitions")


if __name__ == "__main__":
    main()
