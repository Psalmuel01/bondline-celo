# Bondline production roadmap

This roadmap turns the hackathon build into a production system without replacing working paths prematurely.

## Phase 1 — Trust and data integrity

- [x] Require receipt evidence in the UI and contract before a cosign opens.
- [x] Introduce wallet-signed, gasless HTTP sessions.
- [x] Move private chat reads and writes behind server-side membership checks.
- [x] Move profile, Circle metadata, and media writes behind the same session boundary.
- [x] Replace public Storage mutation policies with owner/member-scoped server routes.
- [ ] Add request rate limits and structured audit records.

## Phase 2 — Canonical chain data

- [x] Implement ingestion for every Core and Factory event with block number, transaction hash, and log index.
- [x] Make batches contiguous, idempotent, concurrency-safe, and atomic with the sync cursor.
- [x] Reconstruct projections by replaying the complete finalized event history.
- [ ] Run and verify the Celo Sepolia backfill from block `34271637`.
- [ ] Record the independent Celo mainnet deployment block before any production backfill.
- [ ] Schedule the protected indexer endpoint and monitor cursor lag.
- [x] Define canonical indexed projections and an atomic Circle snapshot endpoint.
- [ ] Populate and reconcile the projections before enabling the endpoint in the UI.
- [ ] Add cursor pagination for long Bond and activity histories.
- [ ] Hydrate React Query from the server and invalidate only the affected Circle after confirmed writes.

## Phase 3 — Retention

- [ ] Browser and email notifications for deadlines, cosigns, resolutions, and payouts.
- [ ] Durable multi-file receipts whose file-byte hashes are committed on-chain.
- [ ] Recurring Bond templates and weekly Circle summaries.
- [ ] Shareable, expiring Circle invitations.

## Phase 4 — Protocol maturity

- [ ] Governed membership and threshold changes.
- [ ] Payout expiry and cancellation.
- [ ] Invariant/fuzz expansion, independent audit, and migration runbook.
- [ ] Contextual reputation and Circle health metrics.

## Deployment order for the secure chat slice

1. Configure `SUPABASE_SERVICE_ROLE_KEY`, `BONDLINE_SESSION_SECRET`, and `CELO_RPC_URL` in the hosting environment.
2. Deploy the web application containing the authenticated API routes.
3. Run `supabase/migrations/202608130001_secure_circle_chat.sql`, then `202608130002_secure_social_writes.sql`.
4. Verify that a member can unlock chat and a non-member receives HTTP 403.

Do not run the SQL migration before the new web routes are live, or chat will be temporarily unavailable.

## Indexer deployment order

1. Run `202608130003_indexed_circle_snapshots.sql` if it has not already been applied.
2. Run `202608190001_atomic_indexer_ingestion.sql`.
3. Add `BONDLINE_INDEXER_SECRET` to the deployed web environment and redeploy the indexer code.
4. Set `BONDLINE_APP_URL` only in the local environment used to launch the backfill.
5. Run `pnpm indexer:backfill` from `web/` until it reports completion.
6. Compare Supabase Circle/Bond/payout counts with the contracts, then inspect several snapshots.
7. Schedule `/api/indexer/run` with its Bearer token and alert when the cursor falls behind.
8. Keep the live frontend on direct reads until reconciliation succeeds.
