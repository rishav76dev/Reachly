# Reachlypaign Worker

Bun worker service for:

- Health endpoint (`GET /health`)
- Scraping a single X post (`POST /scrape`)
- Scraping multiple X posts (`POST /scrape-batch`)
- Finalizing campaign views + distribution on Stellar (`POST /sync-campaign`)

## Setup

Install dependencies:

```bash
npm install
```

Create environment file:

```bash
cp .env.example .env
```

Required values:

- `SCRAPING_DOG_API_KEY`
- `SOROBAN_RPC_URL`
- `CONTRACT_ID`
- `STELLAR_SECRET_KEY` (only required for `/sync-campaign` write transactions)

Run:

```bash
bun run index.ts
```
