# Bondline web

Bondline is a group commitment app deployed on Celo mainnet, with a separate Celo Sepolia test deployment. A Circle stakes CELO against
personal deadlines: meet the Line and the Circle cosigns a refund; miss it and
the stake funds the shared Pot.

## What is on-chain

- Circle membership, cosign threshold, and Pot balance
- Bonds, deadlines, stakes, receipts hashes, cosigns, and resolutions
- Payout proposals and their cosigns

## What is off-chain

Supabase makes the UI human without changing custody or contract rules:

- Display names, avatar image URLs, and avatar colors
- Circle mission, Pot goal, and banner image URL
- Circle chat and activity rows recorded by the UI

This social layer is optional. The core app still works with only the contract
addresses configured; chat, profile editing, and Circle customization show
setup states until Supabase is enabled.

## Local setup

```bash
cd web
npm install
cp .env.example .env.local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Environment variables

The production Celo mainnet deployment uses:

```env
NEXT_PUBLIC_BONDLINE_NETWORK=celo-mainnet
NEXT_PUBLIC_CORE_ADDRESS=0x111004038F8e918a02CD760E2E2630E0C9E789d6
NEXT_PUBLIC_CIRCLE_FACTORY_ADDRESS=0xB337fC04B8A146c93bCC7b57229Cc8cb18c03fd6
CELO_RPC_URL=https://forno.celo.org
BONDLINE_DEPLOYMENT_BLOCK=76480601
```

To enable profiles, Circle metadata, chat, and app-recorded activity, create a
Supabase project, run [`../supabase/schema.sql`](../supabase/schema.sql) in its
SQL Editor, then add:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# Server-only values used by wallet-authenticated private features
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
BONDLINE_SESSION_SECRET=replace-with-at-least-32-random-characters
CELO_RPC_URL=https://forno.celo-sepolia.celo-testnet.org
BONDLINE_INDEXER_SECRET=replace-with-another-32-random-characters
HYPERSYNC_BEARER_TOKEN=your-envio-hypersync-token
```

Restart `npm run dev` after changing `.env.local`.

## Product walkthrough

1. Connect an injected wallet on the configured Celo network.
2. Click **New Circle** and add at least one other member wallet.
3. Open the Circle and click your own name to add a profile name, avatar URL,
   or avatar color.
4. Circle members can select **Customize Circle** to set a mission, Pot goal,
   and optional banner image URL.
5. Open a Bond, declare it complete with a receipt URL, and let the crew
   cosign it. Images, GitHub links, Loom links, and YouTube links receive a
   lightweight receipt preview.
6. Use the header notification center for urgent deadlines and pending cosigns.

## Canonical chain indexer

The built-in indexer reads finalized `CircleFactory` and `BondlineCore` events,
replays them into queryable projections, and commits the raw events, projections,
and sync cursor to Supabase in one database transaction.
It is safe to retry: batches must be contiguous, duplicate logs are ignored,
and an older concurrent worker cannot overwrite a newer projection.

After migration `202608130003_indexed_circle_snapshots.sql`, run
`202608190001_atomic_indexer_ingestion.sql`. Deploy the web app with the indexer
environment variables above, plus the optional defaults in `.env.example`.

For the initial backfill, put the deployed URL in local `.env.local`:

```env
BONDLINE_APP_URL=https://your-deployment.example
BONDLINE_INDEXER_SECRET=the-same-secret-used-by-the-deployment
```

Then run:

```bash
pnpm indexer:backfill
```

After backfill, schedule an authenticated `GET` or `POST` request to `/api/indexer/run`
every minute with the header `Authorization: Bearer <BONDLINE_INDEXER_SECRET>`.
Each call advances one configurable block range.
Vercel Cron may instead use its standard server-only `CRON_SECRET`; the route
accepts either secret.
The Celo mainnet deployment block is `76480601`, finality lag is 12 blocks, and each
database batch covers 2,000 blocks. RPC log reads are automatically split into
100-block requests to respect Celo's public endpoint limit. A server-side Envio
HyperSync is used only for Celo mainnet, where the supported endpoint is
`https://celo.hypersync.xyz`. Celo Sepolia deliberately uses standard JSON-RPC
log fetching because no officially supported Sepolia HyperSync endpoint is
currently available. No historical contract-state access is required.

The frontend deliberately stays on its established contract reads until the
backfill is reconciled. Only then should React Query be hydrated from
`/api/circles/[address]/snapshot`.

## Activity and notifications

The landing feed and Circle workspace still use the established live read path.
Indexed snapshots expose canonical event activity once enabled.

Notifications are currently in-app. Browser/mobile push needs a VAPID-enabled
service worker or a notification provider and should be added only with a
wallet-authenticated backend.

## Security note

Circle chat is served only through wallet-authenticated API routes that verify
current on-chain membership. The browser never receives the Supabase service
role key. Profile, metadata, and media mutations use authenticated server
routes. The legacy browser-authored activity table remains beta; indexed
snapshots use canonical chain events instead.

## Verification

Run `pnpm exec tsc --noEmit` and the contract test suite before release. A production build should be run only as an intentional release check. The contracts are not audited.
