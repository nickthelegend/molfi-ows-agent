# Molfi OWS Agent Backend

A secure Node.js backend for managing AI agent wallets and signing transactions using the Open Wallet Standard (OWS).

## Features

- **Secure Wallet Creation**: Generates encrypted OWS wallets for each AI agent.
- **Transaction Signing**: Safely signs transactions and messages without exposing private keys.
- **ENS Integration**: Automatically creates subdomains for agents (e.g., `agent-name.nivesh.eth`).
- **Policy Enforcement**: Middleware support for spending limits and chain restrictions.
- **Dockerized**: Multi-stage build with non-root user and persistent volume support.

## Tech Stack

- **Runtime**: Node.js 20+ (TypeScript)
- **Framework**: Express + Zod
- **SDK**: @open-wallet-standard/core
- **Blockchain**: viem (ENS & Transaction support)
- **Security**: Helmet, CORS, Rate Limiting, JWT

## Getting Started

### 1. Prerequisites
- Docker & Docker Compose
- An Ethereum RPC URL (e.g., Alchemy or Infura)
- (Optional) Private key for the ENS root name owner to create subdomains.

### 2. Configuration
Copy `.env.example` to `.env` and fill in the values:
```bash
cp .env.example .env
```

### 3. Run with Docker
```bash
docker compose up --build -d
```

The server will be available at `http://localhost:3000`.

## API Documentation

### Create Agent
`POST /agents/create`
**Body:**
```json
{
  "name": "trader-bot-1",
  "policy": {
    "maxDailyUsd": 100,
    "allowedChains": ["ethereum", "base"]
  }
}
```
**Response:**
```json
{
  "success": true,
  "agentId": "uuid-v4",
  "ensName": "trader-bot-1.nivesh.eth",
  "walletAddress": "0x...",
  "agentToken": "jwt-token"
}
```

### Sign Transaction/Message
`POST /agents/:agentId/sign`
**Headers:** `Authorization: Bearer <agentToken>`
**Body (Message):**
```json
{
  "chain": "ethereum",
  "message": "Sign this message"
}
```
**Body (Transaction):**
```json
{
  "chain": "base",
  "transaction": {
    "to": "0x...",
    "value": "1000000000000000",
    "data": "0x..."
  }
}
```

## Security Warning
⚠️ **NEVER** expose this backend publicly without additional authentication (e.g., API Gateway, VPC, or mTLS). This backend manages private keys and should only be accessible by your trusted Expo app backend or a secure relay.

## Persistent Storage
Wallets are stored in an encrypted format within the `ows-vault` Docker volume. They are located at `/home/node/.ows/wallets` inside the container.
