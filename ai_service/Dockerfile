# Production Dockerfile for OneTrack AI Extraction Microservice
FROM python:3.11-slim

WORKDIR /app

# Prevent Python from writing .pyc files & enable unbuffered stdout/stderr logging
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

# Install curl for container health checks
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy dependency specifications and install packages
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy microservice application files
COPY . .

# Expose microservice port
EXPOSE 8000

# Container healthcheck
HEALTHCHECK --interval=10s --timeout=5s --retries=5 --start-period=10s \
    CMD curl -f http://localhost:8000/health || exit 1

# Start Uvicorn in production mode
CMD ["python", "-m", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
