# ==============================================================================
# Stage 1: Build the React + TypeScript + Vite Frontend
# ==============================================================================
FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend

# Install dependencies
COPY frontend/package*.json ./
RUN npm install

# Build static bundle to /app/frontend/dist
COPY frontend/ ./
RUN npm run build

# ==============================================================================
# Stage 2: Python Backend & Runtime Environment
# ==============================================================================
FROM python:3.11-slim

# Prevent Python from writing .pyc files and enable unbuffered logging
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONPATH="/app/backend:/app" \
    PORT=8000

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install PyTorch CPU-only first (saves ~2GB vs CUDA version, fits within free tier RAM/disk)
RUN pip install --no-cache-dir torch --index-url https://download.pytorch.org/whl/cpu

# Install remaining Python dependencies
COPY backend/requirements.txt ./backend/
RUN pip install --no-cache-dir -r backend/requirements.txt

# Copy application backend and necessary asset directories
COPY backend/ ./backend/
COPY models/ ./models/
COPY samples/ ./samples/
COPY sample_images/ ./sample_images/
COPY experiments/ ./experiments/

# Copy built frontend static assets from Stage 1 into /app/frontend/dist
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist

# Create a non-root user (compatible with Hugging Face Spaces, Render, and standard Docker)
RUN useradd -m -u 1000 appuser && \
    chown -R appuser:appuser /app
USER appuser

# Expose ports (8000 standard / 7860 Hugging Face Spaces default)
EXPOSE 8000 7860

# Launch server binding dynamically to $PORT (defaults to 8000 if not set by cloud host)
CMD ["sh", "-c", "uvicorn backend.app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]

