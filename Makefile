# Pathwarden task runner (plan §21). Written to work under Git Bash on Windows and on Linux CI.
# Recipes are deliberately simple (no bashisms) so GNU make can run them with sh or cmd.exe.
# Targets for later phases are fail-loud stubs: they exit 1 until their phase implements them.

ifeq ($(OS),Windows_NT)
  VENV_PY := .venv/Scripts/python.exe
else
  VENV_PY := .venv/bin/python
endif
PY ?= $(if $(wildcard $(VENV_PY)),$(VENV_PY),python)

.PHONY: up down probe test lint fmt hooks api demo eval eval-live web mcp-server gateway

up:
	docker compose up -d --build

down:
	docker compose down

probe:
	$(PY) scripts/probe_falkordb.py

test:
	$(PY) -m pytest

# Explicit code folders only: never point ruff at the repo root (it would reformat Markdown, incl. plan.md).
CODE_DIRS := api tests scripts

lint:
	$(PY) -m ruff check $(CODE_DIRS)
	$(PY) -m ruff format --check $(CODE_DIRS)

fmt:
	$(PY) -m ruff format $(CODE_DIRS)
	$(PY) -m ruff check --fix $(CODE_DIRS)

hooks:
	git config core.hooksPath .githooks

api:
	$(PY) -m uvicorn api.main:create_app --factory --port 8000

# --- stubs: not implemented until their phase ---------------------------------------------
demo:
	$(PY) -m api.scenarios.demo

eval:
	@echo "make eval: not implemented until P5 (docs/phases/P5-evaluation.md)" && exit 1

eval-live:
	@echo "make eval-live: not implemented until P8 (docs/phases/P8-live-llm.md)" && exit 1

web:
	@echo "make web: not implemented until P10a (docs/phases/P10a-ui-run-investigate.md)" && exit 1

mcp-server:
	@echo "make mcp-server: not implemented until P9 (docs/phases/P9-mcp.md)" && exit 1

gateway:
	@echo "make gateway: not implemented until P9 (docs/phases/P9-mcp.md)" && exit 1
