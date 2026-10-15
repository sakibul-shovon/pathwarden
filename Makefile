# Pathwarden task runner (plan §21). Written to work under Git Bash on Windows and on Linux CI.
# Recipes are deliberately simple (no bashisms) so GNU make can run them with sh or cmd.exe.
# Targets for later phases are fail-loud stubs: they exit 1 until their phase implements them.

ifeq ($(OS),Windows_NT)
  VENV_PY := .venv/Scripts/python.exe
else
  VENV_PY := .venv/bin/python
endif
PY ?= $(if $(wildcard $(VENV_PY)),$(VENV_PY),python)

.PHONY: up down probe probe-mcp test test-auth lint fmt hooks api demo demo-mcp eval eval-live web mcp-server gateway

up:
	docker compose up -d --build

down:
	docker compose down

probe:
	$(PY) scripts/probe_falkordb.py

test:
	$(PY) -m pytest

# the whole suite in hosted mode (PW_AUTH=on: workspace keys required); set in Python so it also works with cmd.exe
test-auth:
	$(PY) -c "import os, sys, pytest; os.environ['PW_AUTH'] = 'on'; sys.exit(pytest.main([]))"

# Explicit code folders only: never point ruff at the repo root (it would reformat Markdown, incl. plan.md).
CODE_DIRS := api tests scripts eval mock_upstreams

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
	$(PY) -m eval.run_eval

eval-live:
	@echo "make eval-live: not implemented until P8 (docs/phases/P8-live-llm.md)" && exit 1

web:
	cd web && npm run dev

# P9: needs the extra `mcp` (pip install -e ".[mcp]") and FalkorDB
probe-mcp:
	$(PY) scripts/probe_mcp.py

mcp-server:
	$(PY) -m api.mcp.tool_server

# one gateway = one agent: set PW_WORKSPACE, PW_AGENT_ID, PW_DAY_LABEL, PW_TASK_REF (see docs/MCP.md)
gateway:
	$(PY) -m api.mcp.gateway

demo-mcp:
	$(PY) -m api.mcp.demo
