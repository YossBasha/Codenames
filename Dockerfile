FROM node:18-alpine

WORKDIR /app

# Copy package configurations
COPY server/package.json ./server/
COPY server/tsconfig.json ./server/

# Copy source code
COPY shared/ ./shared/
COPY server/src/ ./server/src/

# Install and build
WORKDIR /app/server
RUN npm install
RUN npm run build

# Expose port 3000 (Back4App will map this automatically)
EXPOSE 3000

# Start the server
CMD ["npm", "start"]
