# Multi-stage build for production
FROM golang:1.24.5-alpine AS backend-builder

# Version arguments
ARG VERSION=dev
ARG GIT_COMMIT=unknown
ARG GIT_BRANCH=unknown
ARG BUILD_DATE=unknown

# Install dependencies for building and scanning
RUN apk add --no-cache git coreutils

# Set working directory
WORKDIR /app

# Copy go mod files
COPY go.mod go.sum ./

# Download dependencies
RUN go mod download

# Copy source code
COPY . .

# Build the application with version information
RUN CGO_ENABLED=0 GOOS=linux go build -a -installsuffix cgo \
    -ldflags "-X github.com/mantonx/volumeviz/internal/version.Version=${VERSION} \
              -X github.com/mantonx/volumeviz/internal/version.GitCommit=${GIT_COMMIT} \
              -X github.com/mantonx/volumeviz/internal/version.GitBranch=${GIT_BRANCH} \
              -X github.com/mantonx/volumeviz/internal/version.BuildDate=${BUILD_DATE}" \
    -o volumeviz ./cmd/server

# Frontend builder stage
FROM node:24-alpine AS frontend-builder

WORKDIR /app

# Copy package files
COPY frontend/package*.json ./

# Install dependencies
RUN npm install --legacy-peer-deps

# Copy frontend source
COPY frontend/ .

# Build frontend
RUN npm run build

# Final stage
FROM alpine:latest

# Install ca-certificates for HTTPS, coreutils for du command, and curl for health checks
RUN apk --no-cache add ca-certificates coreutils curl

WORKDIR /root/

# Copy backend binary
COPY --from=backend-builder /app/volumeviz .

# Copy frontend build
COPY --from=frontend-builder /app/dist ./frontend/dist

# Expose port
EXPOSE 8080

# Run the application
CMD ["./volumeviz"]