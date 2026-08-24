# Security synchronization

This repository began from the Bondline Monad implementation. The payable escrow model, Circle isolation, cosign and payout state machines, React UI, wallet sessions, private chat boundary, uploads, receipts, profiles, snapshot loading, and atomic event ingestion originated there. Celo configuration, deployment artifacts, database records, sessions, storage paths, and indexer cursors are independent here.

Review security fixes across both repositories when they affect protocol invariants, reentrancy, checks-effects-interactions, signature/session validation, membership authorization, input validation, storage ownership, RLS, event decoding, finality/reorg handling, idempotency, or snapshot consistency. Chain configuration and deployment-address changes should remain deployment-specific and must never be copied blindly.

For every shared fix, compare tests and threat assumptions in both repositories, then port deliberately. Never reuse private keys, Supabase service-role keys, session secrets, indexer secrets, deployment artifacts, or database cursors.
