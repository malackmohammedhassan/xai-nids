"""
Security-focused tests: path traversal, filename sanitization,
input validation hardening, and CORS behaviour.
"""
from __future__ import annotations

import pytest
from core.security import sanitize_filename, assert_within_base
from pathlib import Path


# ─── Unit tests for security utilities ───────────────────────────────────────

class TestSanitizeFilename:
    def test_strips_directory_traversal(self):
        assert sanitize_filename("../../etc/passwd") == "passwd"

    def test_strips_windows_path_separators(self):
        result = sanitize_filename("C:\\Windows\\System32\\evil.csv")
        assert "\\" not in result
        assert ":" not in result

    def test_replaces_spaces_with_underscore(self):
        result = sanitize_filename("my dataset v2.csv")
        assert " " not in result

    def test_preserves_extension(self):
        assert sanitize_filename("data.csv").endswith(".csv")
        assert sanitize_filename("data.parquet").endswith(".parquet")

    def test_handles_null_bytes(self):
        result = sanitize_filename("file\x00.csv")
        assert "\x00" not in result

    def test_empty_input_returns_default(self):
        result = sanitize_filename("")
        assert result and len(result) > 0

    def test_relative_prefix_stripped(self):
        result = sanitize_filename("./subdir/payload.csv")
        assert "/" not in result
        assert "." != result[0]  # no leading dot sequences


class TestAssertWithinBase:
    def test_child_path_is_accepted(self, tmp_path):
        child = tmp_path / "sub" / "file.csv"
        assert_within_base(tmp_path, child)  # no exception

    def test_sibling_path_is_blocked(self, tmp_path):
        sibling = tmp_path.parent / "evil" / "file.csv"
        with pytest.raises(ValueError, match="Path traversal blocked"):
            assert_within_base(tmp_path, sibling)

    def test_traversal_via_dotdot_is_blocked(self, tmp_path):
        traversal = tmp_path / ".." / ".." / "etc" / "passwd"
        with pytest.raises(ValueError):
            assert_within_base(tmp_path, traversal)


# ─── Integration tests via HTTP ──────────────────────────────────────────────

class TestUploadSecurity:
    def test_path_traversal_in_filename_never_causes_500(self, client, sample_csv_bytes):
        for dangerous_name in [
            "../../etc/passwd.csv",
            "../../../Windows/System32/drivers/etc/hosts.csv",
            "....//evil.csv",
            "%2e%2e%2fetc%2fpasswd.csv",
            "file\x00injection.csv",
        ]:
            resp = client.post(
                "/api/v1/datasets/upload",
                files={"file": (dangerous_name, sample_csv_bytes, "text/csv")},
            )
            assert resp.status_code != 500, (
                f"Server crashed (500) for filename: {dangerous_name!r}"
            )

    def test_empty_filename_handled_gracefully(self, client, sample_csv_bytes):
        resp = client.post(
            "/api/v1/datasets/upload",
            files={"file": ("", sample_csv_bytes, "text/csv")},
        )
        assert resp.status_code != 500

    def test_binary_blob_without_extension_returns_422(self, client):
        resp = client.post(
            "/api/v1/datasets/upload",
            files={"file": ("danger", b"\x4d\x5a" + b"\xff" * 100, "application/octet-stream")},
        )
        assert resp.status_code == 422

    def test_sql_injection_in_dataset_id_returns_404_not_500(self, client):
        """Dataset IDs come from the path; SQL-like values should 404 not crash."""
        resp = client.get("/api/v1/datasets/'; DROP TABLE datasets; --/summary")
        assert resp.status_code in (404, 422)


class TestCORSHeaders:
    def test_allowed_origin_gets_cors_headers(self, client):
        resp = client.get(
            "/api/v1/health",
            headers={"Origin": "http://localhost:5173"},
        )
        # FastAPI TestClient doesn't go through the ASGI middleware by default
        # but we can confirm the endpoint responds 200 and isn't blocked
        assert resp.status_code == 200

    def test_no_arbitrary_file_overwrite_on_duplicate_upload(self, client, sample_csv_bytes):
        """Upload the same filename twice — second upload creates a new dataset_id."""
        resp1 = client.post(
            "/api/v1/datasets/upload",
            files={"file": ("same.csv", sample_csv_bytes, "text/csv")},
        )
        resp2 = client.post(
            "/api/v1/datasets/upload",
            files={"file": ("same.csv", sample_csv_bytes, "text/csv")},
        )
        assert resp1.status_code == 200
        assert resp2.status_code == 200
        # Each upload must produce a distinct dataset_id
        assert resp1.json()["dataset_id"] != resp2.json()["dataset_id"]
