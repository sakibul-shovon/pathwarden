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


def _referenced_query_names() -> set[str]:
    """String literals passed to ``<graph>.run("name", ...)`` or ``load_query("name")`` in api/."""
    names: set[str] = set()
    for path in (REPO / "api").rglob("*.py"):
        for node in ast.walk(ast.parse(path.read_text(encoding="utf-8"))):
            if not (isinstance(node, ast.Call) and node.args):
                continue
            func = node.func
            called = func.attr if isinstance(func, ast.Attribute) else getattr(func, "id", "")
            first = node.args[0]
            if called in {"run", "load_query"} and isinstance(first, ast.Constant):
                if isinstance(first.value, str):
                    names.add(first.value)
    return names


def test_every_referenced_query_exists_and_every_query_file_is_used():
    files = {p.stem for p in (REPO / "api" / "graph" / "queries").glob("*.cypher")}
    called = _referenced_query_names()  # names passed straight to .run(...) / load_query(...)
    assert called <= files, f"code references missing queries: {sorted(called - files)}"
    # A file also counts as used when its name appears as a string literal anywhere in api/
    # (e.g. passed through a helper such as Gate._witness("q2a_untrusted_witness", ...)).
    literals = {
        node.value
        for path in (REPO / "api").rglob("*.py")
        for node in ast.walk(ast.parse(path.read_text(encoding="utf-8")))
        if isinstance(node, ast.Constant) and isinstance(node.value, str)
    }
    unused = sorted(files - literals)
    assert not unused, f"unused query files (dead code?): {unused}"


def test_gate_forensic_and_ui_queries_never_read_artifact_content():
    """Plan rule 3: no `.content` in any q2*-q8* query (the runtime's q1_* lookups may)."""
    for path in (REPO / "api" / "graph" / "queries").glob("q[2-8]*.cypher"):
        assert not re.search(r"\.content\b", path.read_text(encoding="utf-8")), path.name


def test_the_gate_imports_no_llm_client_and_never_touches_content():
    source = (REPO / "api" / "runtime" / "gate.py").read_text(encoding="utf-8")
    banned = {"litellm", "openai", "anthropic", "groq", "cohere", "mistralai", "ollama"}
    imported = {
        alias.name.split(".")[0]
        for node in ast.walk(ast.parse(source))
        if isinstance(node, ast.Import)
        for alias in node.names
    } | {
        node.module.split(".")[0]
        for node in ast.walk(ast.parse(source))
        if isinstance(node, ast.ImportFrom) and node.module
    }
    assert not (imported & banned), f"LLM client imported in the gate: {imported & banned}"
    assert not re.search(r"\.content\b", source), "the gate must not read artifact content"


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


# -------------------------------------------------- P11: every route is guarded or classified
HUMAN_ONLY_ROUTES = {
    "POST /api/ws/{ws}/actions/{action_id}/approve",
    "POST /api/ws/{ws}/actions/{action_id}/reject",
    "POST /api/ws/{ws}/heal/{action_id}/approve",
    "POST /api/ws/{ws}/quarantine/{quarantine_id}/release",
    "POST /api/remediation/{topology}/apply",
    "POST /api/remediation/{topology}/reset",
}
# mutating routes that are deliberately NOT human-only (docs/SECURITY.md explains why)
OTHER_MUTATING_ROUTES = {
    "POST /api/ws/{ws}/reset",
    "POST /api/ws/{ws}/scenarios/{name}/run",
    "POST /api/ws/{ws}/scenarios/custom/run",  # live agents on a visitor's text (P8)
    "POST /api/ws/{ws}/forensics/{action_id}",
    "POST /api/remediation/{topology}/suggest",
}


def _guards(dependant) -> set[str]:
    names: set[str] = set()
    for dep in dependant.dependencies:
        names.add(getattr(dep.call, "__name__", ""))
        names |= _guards(dep)
    return names


def _route_modules() -> list:
    """Every ``api/routes/*.py`` module with a ``router`` (found on disk, never hand-listed)."""
    import importlib

    names = sorted(p.stem for p in (REPO / "api" / "routes").glob("*.py") if p.stem != "__init__")
    modules = [importlib.import_module(f"api.routes.{name}") for name in names]
    return [m for m in modules if hasattr(m, "router")]


def test_every_router_is_included_in_the_app():
    """A router module nobody includes would hide its routes from the checks below."""
    main = (REPO / "api" / "main.py").read_text(encoding="utf-8")
    for module in _route_modules():
        alias = module.__name__.rsplit(".", 1)[1]
        included = f"{alias}.router" in main or f"{alias}_routes.router" in main
        assert included, f"api/routes/{alias}.py is not included in api/main.py"


def test_every_route_is_covered_by_the_workspace_key_or_explicitly_classified():
    from fastapi.routing import APIRoute

    seen_mutating: set[str] = set()
    for module in _route_modules():
        for route in module.router.routes:
            assert isinstance(route, APIRoute), route
            guards = _guards(route.dependant)
            for method in sorted(route.methods - {"HEAD", "OPTIONS"}):
                label = f"{method} {route.path}"
                if route.path.startswith("/api/ws/"):
                    assert "require_workspace_access" in guards, f"{label} is not key-scoped"
                if method == "GET":
                    assert "require_human" not in guards, f"{label}: a read needs no human header"
                    continue
                seen_mutating.add(label)
                assert label in HUMAN_ONLY_ROUTES | OTHER_MUTATING_ROUTES, (
                    f"{label} is a new mutating route: classify it here and in docs/SECURITY.md"
                )
                assert ("require_human" in guards) == (label in HUMAN_ONLY_ROUTES), label
                if label.startswith("POST /api/remediation/") and label in HUMAN_ONLY_ROUTES:
                    assert "require_any_key" in guards, f"{label} needs a key when hosted"
    stale = (HUMAN_ONLY_ROUTES | OTHER_MUTATING_ROUTES) - seen_mutating
    assert not stale, f"classified routes that no longer exist: {sorted(stale)}"
