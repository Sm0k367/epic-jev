FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --production

# Copy application
COPY server.js .
COPY public ./public

# Set environment
ENV PORT=3000
EXPOSE 3000

# Run application
CMD ["npm", "start"]
