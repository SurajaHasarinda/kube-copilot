# Multi-stage build for single container deployment
FROM node:20-alpine AS frontend-builder

WORKDIR /app

# Copy package files first for better caching
COPY ui/package*.json ./

# Install dependencies
RUN npm ci

# Copy the rest of the frontend source code
COPY ui ./

# Build the frontend - output to dist
RUN npm run build

# Backend with built frontend
FROM python:3.11-slim

WORKDIR /app

# Install curl (useful for healthchecks)
RUN apt-get update && \
    DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends curl && \
    rm -rf /var/lib/apt/lists/*

# Install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend code
COPY agent ./agent
COPY config ./config
COPY controllers ./controllers
COPY services ./services
COPY persistence ./persistence
COPY k8s_tools ./k8s_tools
COPY templates ./templates

COPY main.py .

# Create data directory
RUN mkdir -p data

# Copy built frontend from previous stage
# We'll put it in ./static to serve from there
COPY --from=frontend-builder /app/dist ./static

# Expose port
EXPOSE 8321

# Run application
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8321"]
