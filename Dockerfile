# ----------------------------
# Step 1: Build the Next.js app
# ----------------------------
FROM node:18 AS builder

# Set working directory
WORKDIR /app

# Copy package.json and lock file
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy all project files
COPY . .

# Build the app
RUN npm run build

# ----------------------------
# Step 2: Create a lightweight production image
# ----------------------------
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy built app from builder stage
COPY --from=builder /app ./

# Expose the port
EXPOSE 3000

# Start the app
CMD ["npm", "start"]
