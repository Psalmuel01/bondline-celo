# Bondline on Celo

Bondline is a group commitment protocol: members create Circles, escrow native CELO against deadlines, cosign results, and route missed stakes into an isolated Circle Pot. This repository is the independent Celo deployment of Bondline. Phase 1 accepts native CELO only; it does not support ERC-20s, G$, MiniPay, bridging, or cross-chain Circles.

> Security warning: these immutable escrow contracts are unaudited. Do not risk funds you cannot afford to lose.

## Architecture

- `contracts/`: payable Solidity protocol; `msg.value` funds Bonds and Circle Pots.
- `web/`: Next.js, wagmi, viem, React Query, wallet-authenticated private chat, media, profiles, and receipts.
- `supabase/`: an independent database, storage bucket, RLS, chain-scoped projections, and atomic indexer ingestion.
- Indexer: finalized Celo logs are atomically projected into Supabase. Sepolia uses JSON-RPC; mainnet can use `https://celo.hypersync.xyz`.

The canonical runtime selection is `web/src/lib/chain.ts`. `NEXT_PUBLIC_BONDLINE_NETWORK` defaults to `celo-sepolia`; production must explicitly set `celo-mainnet`. Contract addresses, RPC, deployment block, finality, explorer, and indexer behavior derive from that selection.

## Celo Sepolia setup

1. Install Foundry and Node.js, then run `pnpm install` in `web/`.
2. Copy `contracts/.env.example` to `contracts/.env` and `web/.env.example` to `web/.env.local`; provide your own values only.
3. Fund a dedicated deployer with test CELO.
4. From `contracts/`, run `make deploy-celo-sepolia`. Record the Core, Factory, and deployment block in the web environment.
5. Run `make verify-celo-sepolia` after the broadcast exists.

Sepolia: chain `11142220`, RPC `https://forno.celo-sepolia.celo-testnet.org`, explorer `https://celo-sepolia.blockscout.com`.

## Supabase and Vercel

Create a fresh Supabase project. Execute these files in order:

1. `supabase/schema.sql`
2. `supabase/migrations/202608130001_secure_circle_chat.sql`
3. `supabase/migrations/202608130002_secure_social_writes.sql`
4. `supabase/migrations/202608130003_indexed_circle_snapshots.sql`
5. `supabase/migrations/202608190001_atomic_indexer_ingestion.sql`

Set all variables documented in `web/.env.example` in Vercel. Secrets must remain server-only. Configure Supabase/Vercel Cron to call `/api/indexer/run` with `Authorization: Bearer $BONDLINE_INDEXER_SECRET`. Backfill locally with `pnpm indexer:backfill`; the endpoint reports ranges, safe head, event/projection counts, and catch-up state.

## Mainnet release checklist

- Obtain a security review and rerun Forge tests/type checks.
- Explicitly set `NEXT_PUBLIC_BONDLINE_NETWORK=celo-mainnet`, mainnet RPC, independently deployed addresses, and their exact deployment block.
- Use a fresh mainnet cursor and reconcile indexed counts/balances against RPC.
- Verify on CeloScan with `make verify-celo-mainnet`.
- Confirm wallet switching, explorer links, private membership checks, payouts, uploads, and Cron secrets before enabling traffic.
- Only then, with explicit authorization and a funded dedicated deployer, run `make deploy-celo-mainnet`.

Celo mainnet is chain `42220`, RPC `https://forno.celo.org`, explorer `https://celoscan.io`.

See `SECURITY_SYNC.md` for cross-repository security review guidance. No deployment is performed by repository setup or tests.
