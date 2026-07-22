# Build stage
FROM golang:alpine AS builder

WORKDIR /app

# Copy dependency files
COPY go.mod go.sum ./
RUN go mod download

# Copy application source
COPY . .

# Build statically linked binary
RUN CGO_ENABLED=0 GOOS=linux go build -o server ./cmd/server/main.go

# Production stage
FROM alpine:latest
WORKDIR /app

# Copy binary
COPY --from=builder /app/server .

EXPOSE 8081

CMD ["./server"]
