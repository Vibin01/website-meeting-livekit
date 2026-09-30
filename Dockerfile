FROM node:20-slim

WORKDIR /app

# Install build tools for native dependencies
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

# Copy package manifests
COPY package*.json ./

# Install dependencies including tsx
RUN npm install

# Copy application source
COPY . .

ENV NODE_ENV=production

# Run the agent in production mode
CMD ["npm", "run", "agent:start"]
