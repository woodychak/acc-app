# ---------------------------
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


ENV NODE_ENV=production
ENV NEXT_PUBLIC_SUPABASE_URL=https://mxjzobvvobpofffowbcn.supabase.co
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im14anpvYnZ2b2Jwb2ZmZm93YmNuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDgwNzc0NjYsImV4cCI6MjA2MzY1MzQ2Nn0.s2xPWA8tqvs9NjQ_ZkZX_prqPZCS3pLdFD_p2IAftQ0

RUN npm run build

# ----------------------------
# Step 2: Create a lightweight production image
# ----------------------------
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy built app from builder stage

COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json

# ✅ 再次設環境變數（讓 runtime 有值
ENV NODE_ENV=production
ENV NEXT_PUBLIC_SUPABASE_URL=https://mxjzobvvobpofffowbcn.supabase.co
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im14anpvYnZ2b2Jwb2ZmZm93YmNuIiwicm9sZSI6ImFu>

# Expose the port
EXPOSE 3000

# Start the app
CMD ["npm", "start"]
