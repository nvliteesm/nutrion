# Railway builds the FastAPI backend from the repo root using this Dockerfile.
# (Railway auto-detects a root Dockerfile and skips Railpack/Nixpacks.)
FROM python:3.12-slim

WORKDIR /app

# System deps kept minimal; all Python deps ship manylinux wheels.
ENV PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

COPY backend/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/ ./

EXPOSE 8000

# Railway injects $PORT; default to 8000 for local docker runs.
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
