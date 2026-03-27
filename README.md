# Reachly

Reachly is a decentralized campaign platform where brands fund campaigns on Stellar Soroban, creators submit X/Twitter post links, and rewards are distributed proportionally from on-chain recorded views.

## What Reachly does

- Brands create campaigns and lock a reward budget on-chain.
- Creators submit post links to campaign entries.
- A Bun worker fetches post metrics from ScrapingDog.
- The worker writes views on-chain and finalizes campaign results.
- Creators claim rewards directly from the contract.

## Reward formula

When results are finalized, each submission reward is computed proportionally:

```text
reward = (submission_views * total_budget) / total_views
```

This logic is implemented in the Soroban contract at `stdcontract/contracts/hello-world/src/lib.rs`.

## Architecture

```text
Reachly/
├── client/       React + Vite frontend
├── worker/       Bun service for scraping and on-chain sync
└── stdcontract/  Soroban smart contract workspace
```

## Detailed file guide

### Root

- `README.md`: Project overview, architecture, setup, and operational notes.

### Frontend (`client`)

- `client/package.json`: Frontend scripts (`dev`, `build`, `lint`, `preview`) and web dependencies.
- `client/src/main.tsx`: App bootstrap, React root rendering, and provider composition.
- `client/src/App.tsx`: Router map for home, dashboard, and campaign detail pages.
- `client/src/index.css`: Global design tokens, app-level styles, and shared visual rules.
- `client/src/App.css`: Additional app-scoped styling.

Pages:

- `client/src/pages/Home.tsx`: Landing page and entry point for the user journey.
- `client/src/pages/Dashboard.tsx`: Campaign list, campaign creation flow, and high-level campaign stats.
- `client/src/pages/CampaignDetail.tsx`: Submission management, worker sync actions, finalization flow, and reward claiming UI.

Core data and chain integration:

- `client/src/lib/campaigns.ts`: Main Soroban integration layer for fetching campaigns, reading submissions, creating campaigns, submitting links, and claiming rewards.
- `client/src/lib/stellarCampaign.ts`: Helper utilities related to campaign handling and Stellar-specific transformations.
- `client/src/types/index.ts`: Shared TypeScript models used across pages/components (`Campaign`, `Submission`, status types).

Wallet and providers:

- `client/src/web3/Providers.tsx`: Wraps app with React Query and Stellar wallet provider contexts.
- `client/src/web3/stellarWallet.tsx`: Freighter connection lifecycle, account state, network checks, and wallet actions.

UI and feature components:

- `client/src/components/Navbar.tsx`: Top navigation used across pages.
- `client/src/components/campaign/AddSubmissionForm.tsx`: Input form for adding X/Twitter post links to a campaign.
- `client/src/components/campaign/SubmissionList.tsx`: Table/list rendering for campaign submissions.
- `client/src/components/campaign/SubmissionRow.tsx`: Single submission row with link, views, and claim status controls.
- `client/src/components/campaign/ActionBar.tsx`: Action controls for sync/finalize and related campaign operations.
- `client/src/components/campaign/CampaignOverview.tsx`: Campaign summary block (budget, deadline, status).
- `client/src/components/dashboard/CampaignCard.tsx`: Dashboard campaign card preview component.
- `client/src/components/dashboard/DashboardStats.tsx`: Dashboard KPI and aggregate stats display.

Generated contract client:

- `client/src/packages/hello_world/src/index.ts`: Generated TypeScript bindings for invoking Soroban contract methods.

### Worker (`worker`)

- `worker/package.json`: Worker runtime scripts and Bun-related dependencies.
- `worker/index.ts`: HTTP server, route handlers, scrape APIs, and on-chain sync/finalization orchestration.
- `worker/scraper.ts`: Tweet ID extraction, ScrapingDog API call, and metric normalization.
- `worker/README.md`: Worker-specific setup and endpoint notes.
- `worker/.env.example`: Template for required worker environment variables.

### Smart contract (`stdcontract`)

- `stdcontract/Cargo.toml`: Workspace manifest and shared Rust/Soroban dependency setup.
- `stdcontract/contracts/hello-world/Cargo.toml`: Contract crate definition.
- `stdcontract/contracts/hello-world/src/lib.rs`: Campaign contract implementation (`create_campaign`, `submit`, `set_views`, `finalize_results`, `claim_reward`, getters).
- `stdcontract/contracts/hello-world/Makefile`: Build and test shortcuts for contract development.
- `stdcontract/README.md`: Soroban workspace-level notes.

## Worker endpoints

- `GET /health`
- `POST /scrape`
- `POST /scrape-batch`
- `POST /sync-campaign`

## Environment variables

Frontend (used in code):

- `VITE_STELLAR_CONTRACT_ID`
- `VITE_STELLAR_RPC_URL` (or `VITE_RPC_URL` fallback)
- `VITE_STELLAR_NETWORK_PASSPHRASE`
- `VITE_STELLAR_TOKEN_ADDRESS`
- `VITE_WORKER_URL`
- `VITE_STELLAR_NETWORK`

Worker:

- `SCRAPING_DOG_API_KEY`
- `PORT`
- `SOROBAN_RPC_URL`
- `CONTRACT_ID`
- `STELLAR_SECRET_KEY`

## Local development

Frontend:

```bash
cd client
npm install
npm run dev
```

Worker:

```bash
cd worker
bun install
bun run dev
```

Contract:

```bash
cd stdcontract/contracts/hello-world
make build
```

From workspace root, contract tests can also be run with:

```bash
cd stdcontract
cargo test
```

## Tech stack

- Frontend: React, TypeScript, Vite, TanStack Query
- Wallet: Freighter API + Stellar SDK
- Worker: Bun, TypeScript
- Contract: Soroban SDK (Rust)
- Social data source: ScrapingDog X/Twitter API
