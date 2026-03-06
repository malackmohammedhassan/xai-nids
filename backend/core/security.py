"""
Security utilities for XAI-NIDS backend.

Covers:
  - Filename sanitization (path traversal prevention)
  - Path confinement guard
  - Upload content-type validation
"""
from __future__ import annotations

import re
from pathlib import Path

# Safe filename: alphanumeric, dots, dashes, underscores only.
# Everything else is replaced with underscore.
_UNSAFE_CHARS = re.compile(r"[^a-zA-Z0-9._\-]")
_DOUBLE_DOT  = re.compile(r"\.\.+")


def sanitize_filename(filename: str) -> str:
    """Strip path components and replace unsafe characters.

    Examples
    --------
    >>> sanitize_filename("../../etc/passwd")
    'etc_passwd'
    >>> sanitize_filename("my dataset (v2).csv")
    'my_dataset__v2_.csv'
    """
    # 1. Collapse any directory traversal — keep only the base name
    name = Path(filename).name

    # 2. Remove null bytes
    name = name.replace("\x00", "")

    # 3. Replace unsafe characters with underscores
    name = _UNSAFE_CHARS.sub("_", name)

    # 4. Collapse consecutive dots that survived (but allow single dots like in .csv)
    name = _DOUBLE_DOT.sub("_", name)

    # 5. Guard empty result
    return name or "upload"


def assert_within_base(base_dir: Path, candidate: Path) -> None:
    """Raise ``ValueError`` if *candidate* escapes *base_dir*.

    Should be called before writing any file derived from user input.
    """
    try:
        candidate.resolve().relative_to(base_dir.resolve())
    except ValueError as exc:
        raise ValueError(
            f"Path traversal blocked: '{candidate}' is outside of '{base_dir}'"
        ) from exc


ALLOWED_MIME_TYPES = {
    "text/csv",
    "application/csv",
    "application/octet-stream",   # parquet / generic binary uploads
    "application/vnd.ms-excel",   # some browsers send csv with this
    "text/plain",                  # some browsers send csv with this
}


def is_allowed_content_type(content_type: str | None) -> bool:
    """Return True if the MIME type is acceptable for dataset uploads."""
    if content_type is None:
        return True  # no Content-Type header — allow; we validate by parsing
    # Strip parameters (e.g. "text/csv; charset=utf-8")
    base = content_type.split(";")[0].strip().lower()
    return base in ALLOWED_MIME_TYPES
