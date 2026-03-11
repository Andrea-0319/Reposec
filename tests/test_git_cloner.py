"""Unit tests for orchestrator/git_cloner.py utility functions."""
import subprocess
from pathlib import Path
from unittest.mock import patch, MagicMock

import pytest

from orchestrator.git_cloner import (
    is_git_url,
    validate_git_url,
    parse_repo_name,
    list_remote_branches,
    clone_repo,
)


# ---------------------------------------------------------------------------
# is_git_url
# ---------------------------------------------------------------------------
class TestIsGitUrl:
    def test_https_url(self):
        assert is_git_url("https://github.com/owner/repo") is True

    def test_https_url_with_git_suffix(self):
        assert is_git_url("https://github.com/owner/repo.git") is True

    def test_ssh_url(self):
        assert is_git_url("git@github.com:owner/repo.git") is True

    def test_local_windows_path(self):
        assert is_git_url(r"C:\Projects\app") is False

    def test_local_unix_path(self):
        assert is_git_url("./src") is False

    def test_relative_path(self):
        assert is_git_url("my-project") is False

    def test_empty_string(self):
        assert is_git_url("") is False


# ---------------------------------------------------------------------------
# validate_git_url
# ---------------------------------------------------------------------------
class TestValidateGitUrl:
    def test_valid_https(self):
        result = validate_git_url("https://github.com/owner/repo")
        assert result == "https://github.com/owner/repo"

    def test_valid_ssh(self):
        result = validate_git_url("git@github.com:owner/repo.git")
        assert result == "git@github.com:owner/repo.git"

    def test_rejects_empty(self):
        with pytest.raises(ValueError, match="cannot be empty"):
            validate_git_url("")

    def test_rejects_semicolon_injection(self):
        with pytest.raises(ValueError, match="forbidden characters"):
            validate_git_url("https://evil.com/repo;rm -rf /")

    def test_rejects_ampersand_injection(self):
        with pytest.raises(ValueError, match="forbidden characters"):
            validate_git_url("https://evil.com/repo&&echo pwned")

    def test_rejects_subshell_injection(self):
        with pytest.raises(ValueError, match="forbidden characters"):
            validate_git_url("https://evil.com/$(whoami)")

    def test_rejects_local_path(self):
        with pytest.raises(ValueError, match="Unsupported"):
            validate_git_url("/local/path")


# ---------------------------------------------------------------------------
# parse_repo_name
# ---------------------------------------------------------------------------
class TestParseRepoName:
    def test_https_with_git_suffix(self):
        assert parse_repo_name("https://github.com/owner/repo.git") == "repo"

    def test_https_without_suffix(self):
        assert parse_repo_name("https://github.com/owner/repo") == "repo"

    def test_ssh_format(self):
        assert parse_repo_name("git@github.com:owner/repo.git") == "repo"

    def test_trailing_slash(self):
        assert parse_repo_name("https://github.com/owner/repo/") == "repo"

    def test_nested_path(self):
        assert parse_repo_name("https://gitlab.com/group/subgroup/repo") == "repo"


# ---------------------------------------------------------------------------
# list_remote_branches (mocked subprocess)
# ---------------------------------------------------------------------------
class TestListRemoteBranches:
    @patch("orchestrator.git_cloner.subprocess.run")
    def test_returns_branches_and_default(self, mock_run):
        """Mocked ls-remote returns parsed branch list with default detection."""
        # First call: ls-remote --symref → detect default
        symref_result = MagicMock()
        symref_result.returncode = 0
        symref_result.stdout = "ref: refs/heads/main\tHEAD\nabc123\tHEAD\n"

        # Second call: ls-remote --heads → list branches
        heads_result = MagicMock()
        heads_result.returncode = 0
        heads_result.stdout = (
            "abc123\trefs/heads/main\n"
            "def456\trefs/heads/develop\n"
            "ghi789\trefs/heads/feature/x\n"
        )

        mock_run.side_effect = [symref_result, heads_result]

        result = list_remote_branches("https://github.com/owner/repo")

        assert result["branches"] == ["main", "develop", "feature/x"]
        assert result["default_branch"] == "main"
        assert result["error"] is None

    @patch("orchestrator.git_cloner.subprocess.run")
    def test_handles_timeout(self, mock_run):
        """Branch listing should report timeout gracefully."""
        mock_run.side_effect = subprocess.TimeoutExpired(cmd="git", timeout=15)

        result = list_remote_branches("https://github.com/owner/repo", timeout=15)

        assert result["error"] is not None
        assert "Timed out" in result["error"]
        assert result["branches"] == []

    @patch("orchestrator.git_cloner.subprocess.run")
    def test_handles_git_not_found(self, mock_run):
        """Missing git executable should produce a helpful error."""
        mock_run.side_effect = FileNotFoundError("git not found")

        result = list_remote_branches("https://github.com/owner/repo")

        assert "git executable not found" in result["error"]


# ---------------------------------------------------------------------------
# clone_repo (mocked subprocess)
# ---------------------------------------------------------------------------
class TestCloneRepo:
    @patch("orchestrator.git_cloner.subprocess.run")
    def test_clone_with_branch(self, mock_run, tmp_path: Path):
        """Clone should pass --branch flag and return dest path."""
        mock_run.return_value = MagicMock(returncode=0, stderr="")

        dest = tmp_path / "clone_dest"
        result = clone_repo("https://github.com/owner/repo", dest, branch="develop")

        assert result == dest
        # Verify subprocess received correct arguments
        call_args = mock_run.call_args[0][0]
        assert "--branch" in call_args
        assert "develop" in call_args
        assert "--depth" in call_args
        assert "1" in call_args

    @patch("orchestrator.git_cloner.subprocess.run")
    def test_clone_without_branch(self, mock_run, tmp_path: Path):
        """Clone without branch should omit --branch flag."""
        mock_run.return_value = MagicMock(returncode=0, stderr="")

        dest = tmp_path / "clone_dest"
        clone_repo("https://github.com/owner/repo", dest)

        call_args = mock_run.call_args[0][0]
        assert "--branch" not in call_args

    @patch("orchestrator.git_cloner.subprocess.run")
    def test_clone_failure_raises(self, mock_run, tmp_path: Path):
        """Failed clone should raise RuntimeError with stderr details."""
        mock_run.return_value = MagicMock(returncode=128, stderr="fatal: repo not found")

        dest = tmp_path / "clone_dest"
        with pytest.raises(RuntimeError, match="repo not found"):
            clone_repo("https://github.com/owner/repo", dest)

    @patch("orchestrator.git_cloner.subprocess.run")
    def test_clone_timeout_raises(self, mock_run, tmp_path: Path):
        """Clone timeout should raise RuntimeError."""
        mock_run.side_effect = subprocess.TimeoutExpired(cmd="git", timeout=300)

        dest = tmp_path / "clone_dest"
        with pytest.raises(RuntimeError, match="timed out"):
            clone_repo("https://github.com/owner/repo", dest, timeout=300)
