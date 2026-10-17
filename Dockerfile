FROM python:3.11-slim
WORKDIR /app
COPY pyproject.toml constraints.txt ./
COPY api ./api
COPY fixtures ./fixtures
# Editable install keeps the package in /app so api/ finds ../fixtures at runtime.
# PW_EXTRAS=llm adds LiteLLM (live mode); build with --build-arg PW_EXTRAS= for a scripted-only image.
ARG PW_EXTRAS=llm
RUN pip install --no-cache-dir -c constraints.txt -e ".[${PW_EXTRAS}]"
ENV PW_STATE_DIR=/app/state
EXPOSE 8000
CMD ["uvicorn", "api.main:create_app", "--factory", "--host", "0.0.0.0", "--port", "8000"]
