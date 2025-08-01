# Multi-stage build for production
FROM golang:1.24.5-alpine AS backend-builder

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

# Build the application
RUN CGO_ENABLED=0 GOOS=linux go build -a -installsuffix cgo -o volumeviz ./cmd/server

# Frontend builder stage
FROM node:18-alpine AS frontend-builder

WORKDIR /app

# Copy package files
COPY frontend/package*.json ./

# Install dependencies
RUN npm ci

# Copy frontend source
COPY frontend/ .

# Build frontend
RUN npm run build

# Final stage
FROM alpine:latest

# Install ca-certificates for HTTPS and coreutils for du command
RUN apk --no-cache add ca-certificates coreutils

WORKDIR /root/

# Copy backend binary
COPY --from=backend-builder /app/volumeviz .

# Copy frontend build
COPY --from=frontend-builder /app/dist ./frontend/dist

# Expose port
EXPOSE 8080

# Run the application
CMD ["./volumeviz"]