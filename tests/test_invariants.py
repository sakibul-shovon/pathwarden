"""Static architecture invariants: the plan's hard rules, executable (WORKFLOW.md section 7, G4).

No database needed. Each phase extends this file (see the list in docs/WORKFLOW.md).
"""

from __future__ import annotations

import ast
import re
import shutil
import subprocess
from pathlib import Path

import pytest

REPO = Path(__file__).resolve().parents[1]

# Cypher keywords that must not appear as upper-case words inside Python string literals under api/
# (plan rule 2: all Cypher lives in api/graph/queries/*.cypher).
# schema.py is exempt: it holds the index DDL (plan 7.5).
CYPHER_WORDS = re.compile(r"\b(MATCH|CREATE|MERGE|UNWIND|DETACH|RETURN|OPTIONAL MATCH)\b")
CYPHER_EXEMPT = {Path("api/graph/schema.py")}

NEO4J_ONLY = re.compile(r"\b(apoc|gds|dbms)\.", re.IGNORECASE)


def _git(*args: str) -> str:
    return subprocess.run(
        ["git", *args], cwd=REPO, check=True, capture_output=True, text=True
    ).stdout


def _sh() -> str:
    found = shutil.which("sh")
    if found:
        return found
    fallback = Path(r"C:\Program Files\Git\bin\sh.exe")
    if fallback.exists():
        return str(fallback)
    pytest.fail("no `sh` found; run from Git Bash or install Git for Windows")


def _docstring_nodes(tree: ast.AST) -> set[int]:
    ids: set[int] = set()
    for node in ast.walk(tree):
        if isinstance(node, ast.Module | ast.ClassDef | ast.FunctionDef | ast.AsyncFunctionDef):
            body = node.body
            if body and isinstance(body[0], ast.Expr) and isinstance(body[0].value, ast.Constant):
                ids.add(id(body[0].value))
    return ids


def test_cypher_files_use_no_neo4j_only_procedures():
    for path in (REPO / "api" / "graph" / "queries").glob("*.cypher"):
        assert not NEO4J_ONLY.search(path.read_text(encoding="utf-8")), (
            f"{path.name}: apoc./gds./dbms. are not available in FalkorDB (plan rule 1)"
        )


def test_no_cypher_in_python_string_literals_outside_query_files():
    offenders: list[str] = []
    for path in (REPO / "api").rglob("*.py"):
        rel = path.relative_to(REPO)
        if rel in CYPHER_EXEMPT:
            continue
        tree = ast.parse(path.read_text(encoding="utf-8"), filename=str(rel))
        docstrings = _docstring_nodes(tree)
        for node in ast.walk(tree):
            if (
                isinstance(node, ast.Constant)
                and isinstance(node.value, str)
                and id(node) not in docstrings
                and CYPHER_WORDS.search(node.value)
            ):
                offenders.append(f"{rel}:{node.lineno}")
    assert not offenders, f"Cypher belongs in api/graph/queries/*.cypher (rule 2): {offenders}"


def test_agents_md_section_2_is_plan_section_4_verbatim():
    def block(path: Path) -> list[str]:
        out: list[str] = []
        started = False
        for line in path.read_text(encoding="utf-8").splitlines():
            if line.startswith("### Working method"):
                started = True
            if started:
                out.append(line.rstrip())
            if started and line.startswith("13. Before using any third-party SDK"):
                break
        return out

    plan, agents = block(REPO / "plan.md"), block(REPO / "AGENTS.md")
    assert plan, "plan.md section 4 not found"
    assert agents == plan, "AGENTS.md section 2 drifted from plan.md section 4 (D-001)"


def test_formatter_and_linter_never_touch_markdown_or_the_plan():
    """Regression: `ruff format .` once rewrote the code blocks inside plan.md (source of truth)."""
    config = (REPO / "pyproject.toml").read_text(encoding="utf-8")
    assert '"*.md"' in config and '"plan.md"' in config, "ruff must exclude Markdown and plan.md"
    makefile = (REPO / "Makefile").read_text(encoding="utf-8")
    for line in makefile.splitlines():
        if "ruff" in line and line.startswith("\t"):
            assert "$(CODE_DIRS)" in line, f"ruff needs explicit code folders: {line.strip()}"


def test_secret_scan_passes_on_the_git_index():
    result = subprocess.run(
        [_sh(), "scripts/scan_secrets.sh"], cwd=REPO, capture_output=True, text=True
    )
    assert result.returncode == 0, result.stderr


def test_hooks_and_scan_script_are_executable_in_the_index():
    listing = _git("ls-files", "-s", ".githooks", "scripts/scan_secrets.sh").splitlines()
    assert listing, "hooks not tracked yet"
    for line in listing:
        mode, _, _, name = line.split(None, 3)
        assert mode == "100755", f"{name} must be executable (git update-index --chmod=+x)"


def test_shell_and_query_files_use_lf_line_endings():
    tracked = _git("ls-files").splitlines()
    wanted = [
        f
        for f in tracked
        if f.endswith((".sh", ".cypher", ".yml", ".yaml"))
        or f in {"Makefile"}
        or "/.githooks/" in f
        or f.startswith(".githooks/")
    ]
    for name in wanted:
        assert b"\r" not in (REPO / name).read_bytes(), f"{name} contains CR characters"
