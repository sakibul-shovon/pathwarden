@AGENTS.md

## Claude Code

- Project permissions (git-safety denies, secret-file denies, `ask` for push/commit/merge) are in `.claude/settings.json`. Personal allowances go in `.claude/settings.local.json` (gitignored). Run `/status` once to confirm the project settings loaded.
- Instructions are context, not enforcement. The git hooks in `.githooks/` (enable with `git config core.hooksPath .githooks`) are the backstop — never bypass them.
- Use plan mode for the 3–5 line restatement at the start of a phase, then implement.
- Do not `@`-import `plan.md` anywhere; it is too large to load every session.
- No agent attribution in commits or PRs (D-013): `.claude/settings.json` sets `attribution.commit`/`pr` to empty and `sessionUrl` to false. Do not add `Co-Authored-By` or "Generated with" text by hand either. Record the tool and model in the `docs/PROGRESS.md` session log instead.
