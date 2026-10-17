"""The README must not drift from the generated evidence (P12: "generate, don't type")."""

from __future__ import annotations

import re
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
README = (REPO / "README.md").read_text(encoding="utf-8")
SUMMARY_MD = (REPO / "eval" / "results" / "summary.md").read_text(encoding="utf-8")


def _defenses_table(markdown: str) -> str:
    section = markdown.split("## Defenses", 1)[1].split("\n## ", 1)[0]
    rows = [line for line in section.splitlines() if line.startswith("|")]
    return "\n".join(rows)


def test_the_readme_results_table_is_exactly_the_generated_one():
    block = README.split("<!-- results:begin -->", 1)[1].split("<!-- results:end -->", 1)[0]

    assert block.strip() == _defenses_table(SUMMARY_MD)


def test_the_headline_numbers_quoted_in_prose_match_the_summary():
    import json

    summary = json.loads((REPO / "eval" / "results" / "summary.json").read_text(encoding="utf-8"))
    remediation = summary["remediation"]["enterprise12"]

    assert f"costs {remediation['best_candidate_cost']}" in README
    assert f"optimum of {remediation['optimum_cost']}" in README
    assert f"gap of {remediation['gap']}" in README
    blog = (REPO / "docs" / "blog.md").read_text(encoding="utf-8")
    assert f"cost {remediation['best_candidate_cost']}" in blog
    witness = summary["witness_accuracy"]
    assert f"{witness['correct']}/{witness['n']}" in README
    for name, key in (("B4", "asr"), ("PW-coarse", "fhr"), ("B4", "fhr")):
        rate = summary["defenses"][name][key]["rate"]
        assert f"{rate * 100:.1f}%" in README


def test_every_local_link_in_the_readme_and_the_docs_resolves():
    broken: list[str] = []
    for path in [REPO / "README.md", *sorted((REPO / "docs").glob("*.md"))]:
        for target in re.findall(r"\]\(([^)\s]+)\)", path.read_text(encoding="utf-8")):
            if target.startswith(("http://", "https://", "#", "mailto:")):
                continue
            file_part = target.split("#", 1)[0]
            if file_part and not (path.parent / file_part).exists():
                broken.append(f"{path.relative_to(REPO)} -> {target}")
    assert not broken, broken


def test_the_readme_follows_the_section_order_of_the_plan():
    titles = re.findall(r"^## (\d+)\. ", README, re.M)

    assert titles == [str(n) for n in range(1, 18)]  # the 17 sections of plan §24.1


def test_the_readme_states_the_things_that_are_not_done():
    lowered = README.lower()

    for must_say in (
        "not_run",
        "not implemented",
        "apache license, version 2.0",
        "no hosted demo is running yet",
        "not authentication",
    ):
        assert must_say in lowered, must_say
