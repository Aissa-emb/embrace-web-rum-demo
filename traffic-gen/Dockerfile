FROM mcr.microsoft.com/playwright:v1.49.0-jammy

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci

# Copy source and build
COPY tsconfig.json ./
COPY src ./src
RUN npx tsc

CMD ["node", "dist/index.js"]
