FROM node:20

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

# Create directory for OWS wallets and set permissions
RUN mkdir -p /home/node/.ows/wallets && chown -R node:node /home/node/.ows

# Use non-root user
USER node

# Environment variables
ENV PORT=3000
ENV NODE_ENV=production
ENV OWS_WALLETS_PATH=/home/node/.ows/wallets

EXPOSE 3000

# Use ts-node to run directly (bypassing tsc strictness for dependencies)
CMD ["npx", "ts-node", "src/index.ts"]
