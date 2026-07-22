# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy configuration and package details
COPY package*.json ./
RUN npm ci

# Copy application files and build static bundle
COPY . .
RUN npm run build

# Production server stage
FROM nginx:1.25-alpine

# Copy built frontend assets to Nginx html directory
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy custom Nginx configuration for SPA routing and API reverse-proxying
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
