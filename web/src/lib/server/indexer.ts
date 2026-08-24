import "server-only";

import {
  createPublicClient,
  decodeEventLog,
  http,
  isAddress,
  type Address,
  type Hash,
  type Log,
} from "viem";
import { activeChain, bondlineConfig } from "@/lib/chain";
import {
  CIRCLE_FACTORY_ADDRESS,
  CORE_ADDRESS,
  circleFactoryAbi,
  coreAbi,
  isConfigured,
} from "@/lib/contracts";
import { supabaseAdminRequest } from "@/lib/server/supabase-admin";

const DEFAULT_DEPLOYMENT_BLOCK = BigInt(bondlineConfig.deploymentBlock);
const DEFAULT_FINALITY_BLOCKS = BigInt(bondlineConfig.finalityBlocks);
const DEFAULT_BLOCK_RANGE = 2_000n;
const DEFAULT_HYPERSYNC_BLOCK_RANGE = 2_000_000n;
const DEFAULT_LOG_RANGE = 100n;
type SyncRow = {
  deployment_block: number | string;
  last_finalized_block: number | string;
  last_finalized_hash: Hash | null;
};

type IndexedEntityCircle = {
  bond_id: string;
  circle_address: string;
};

type IndexedPayoutCircle = {
  payout_id: string;
  circle_address: string;
};

type DecodedLog = {
  log: Log<bigint, number, false>;
  eventName: string;
  args: Record<string, unknown>;
};

type HyperSyncResponse = {
  data: Array<{
    logs?: Array<{
      address: Address;
      block_hash: Hash;
      block_number: number;
      data: `0x${string}`;
      log_index: number;
      transaction_hash: Hash;
      topic0?: Hash;
      topic1?: Hash;
      topic2?: Hash;
      topic3?: Hash;
    }>;
  }>;
  next_block?: number;
};

export type IndexerRunResult = {
  applied: boolean;
  caughtUp: boolean;
  fromBlock: string;
  throughBlock: string;
  safeHeadBlock: string;
  events: number;
  circles: number;
  bonds: number;
  payouts: number;
};

function positiveBigInt(name: string, fallback: bigint) {
  const raw = process.env[name];
  if (!raw) return fallback;
  try {
    const parsed = BigInt(raw);
    if (parsed <= 0n) throw new Error();
    return parsed;
  } catch {
    throw new Error(`${name} must be a positive whole number.`);
  }
}

function unixTime(seconds: bigint) {
  return new Date(Number(seconds) * 1_000).toISOString();
}

function jsonValue(value: unknown): unknown {
  if (typeof value === "bigint") return value.toString();
  if (typeof value === "string" && isAddress(value)) return value.toLowerCase();
  if (Array.isArray(value)) return value.map(jsonValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, jsonValue(item)]));
  }
  return value;
}

async function mapConcurrent<T, R>(items: readonly T[], concurrency: number, work: (item: T) => Promise<R>) {
  const results = new Array<R>(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (next < items.length) {
      const index = next++;
      results[index] = await work(items[index]);
    }
  }));
  return results;
}

async function getLogsInRanges(
  client: Pick<ReturnType<typeof createPublicClient>, "getLogs">,
  address: Address,
  fromBlock: bigint,
  toBlock: bigint,
  range: bigint,
) {
  const starts: bigint[] = [];
  for (let start = fromBlock; start <= toBlock; start += range) starts.push(start);
  const pages = await mapConcurrent(starts, 6, (start) => client.getLogs({
    address,
    fromBlock: start,
    toBlock: start + range - 1n < toBlock ? start + range - 1n : toBlock,
  }));
  return pages.flat();
}

async function getLogsFromHyperSync(fromBlock: bigint, toBlock: bigint) {
  const token = process.env.HYPERSYNC_BEARER_TOKEN;
  if (!token || bondlineConfig.indexer.mode !== "hypersync") return;
  const endpoint = (process.env.BONDLINE_HYPERSYNC_URL ?? bondlineConfig.indexer.hyperSyncUrl).replace(/\/$/, "");
  const logs: Log<bigint, number, false>[] = [];
  let cursor = fromBlock;

  while (cursor <= toBlock) {
    const response = await fetch(`${endpoint}/query`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from_block: Number(cursor),
        to_block: Number(toBlock + 1n),
        logs: [{ address: [CIRCLE_FACTORY_ADDRESS, CORE_ADDRESS] }],
        field_selection: {
          log: ["block_number", "block_hash", "log_index", "transaction_hash", "address", "data", "topic0", "topic1", "topic2", "topic3"],
        },
      }),
      cache: "no-store",
    });
    if (!response.ok) throw new Error(`HyperSync log query failed (${response.status}).`);
    const page = await response.json() as HyperSyncResponse;
    for (const entry of page.data) {
      for (const log of entry.logs ?? []) {
        if (
          log.block_number === undefined ||
          !log.block_hash ||
          !log.topic0 ||
          log.log_index === undefined ||
          !log.transaction_hash ||
          !log.address
        ) {
          throw new Error("HyperSync returned an incomplete contract log.");
        }
        const topics = [log.topic0, log.topic1, log.topic2, log.topic3].filter(Boolean) as [Hash, ...Hash[]];
        logs.push({
          address: log.address,
          blockHash: log.block_hash,
          blockNumber: BigInt(log.block_number),
          data: log.data,
          logIndex: log.log_index,
          removed: false,
          topics,
          transactionHash: log.transaction_hash,
          transactionIndex: 0,
        });
      }
    }
    const next = page.next_block === undefined ? undefined : BigInt(page.next_block);
    if (!next || next <= cursor || next > toBlock) break;
    cursor = next;
  }
  return logs;
}

function decodeLogs(logs: readonly Log<bigint, number, false>[], abi: typeof coreAbi | typeof circleFactoryAbi) {
  return logs.map((log) => {
    try {
      const event = decodeEventLog({ abi, data: log.data, topics: log.topics, strict: true });
      return { log, eventName: event.eventName, args: event.args as Record<string, unknown> };
    } catch {
      throw new Error(`Could not decode a Bondline log at block ${log.blockNumber}. Cursor was not advanced.`);
    }
  });
}

export async function runIndexerBatch(): Promise<IndexerRunResult> {
  if (!isConfigured) throw new Error("The Core and CircleFactory addresses are not configured.");
  const rpcUrl = process.env.CELO_RPC_URL;
  if (!rpcUrl) throw new Error("CELO_RPC_URL is required by the indexer.");

  const deploymentBlock = positiveBigInt("BONDLINE_DEPLOYMENT_BLOCK", DEFAULT_DEPLOYMENT_BLOCK);
  const finalityBlocks = positiveBigInt("BONDLINE_INDEXER_FINALITY_BLOCKS", DEFAULT_FINALITY_BLOCKS);
  const useHyperSync = bondlineConfig.indexer.mode === "hypersync" && Boolean(process.env.HYPERSYNC_BEARER_TOKEN);
  const blockRange = useHyperSync
    ? positiveBigInt("BONDLINE_INDEXER_HYPERSYNC_BLOCK_RANGE", DEFAULT_HYPERSYNC_BLOCK_RANGE)
    : positiveBigInt("BONDLINE_INDEXER_BLOCK_RANGE", DEFAULT_BLOCK_RANGE);
  const logRange = positiveBigInt("BONDLINE_INDEXER_LOG_RANGE", DEFAULT_LOG_RANGE);
  const client = createPublicClient({
    chain: activeChain,
    transport: http(rpcUrl, { retryCount: 3, timeout: 20_000 }),
  });

  const syncRows = await supabaseAdminRequest<SyncRow[]>(
    `chain_sync_state?select=deployment_block,last_finalized_block,last_finalized_hash&chain_id=eq.${activeChain.id}&limit=1`,
  );
  const sync = syncRows[0];
  if (sync && BigInt(sync.deployment_block) !== deploymentBlock) {
    throw new Error("BONDLINE_DEPLOYMENT_BLOCK does not match the existing Supabase indexer cursor.");
  }
  if (sync?.last_finalized_hash) {
    const savedBlock = await client.getBlock({ blockNumber: BigInt(sync.last_finalized_block) });
    if (savedBlock.hash.toLowerCase() !== sync.last_finalized_hash.toLowerCase()) {
      throw new Error("A finalized-chain reorganization was detected. Stop the indexer and rebuild its projections.");
    }
  }

  const head = await client.getBlockNumber();
  const safeHead = head > finalityBlocks ? head - finalityBlocks : 0n;
  const fromBlock = sync ? BigInt(sync.last_finalized_block) + 1n : deploymentBlock;
  if (fromBlock > safeHead) {
    return {
      applied: false,
      caughtUp: true,
      fromBlock: fromBlock.toString(),
      throughBlock: sync ? String(sync.last_finalized_block) : (deploymentBlock - 1n).toString(),
      safeHeadBlock: safeHead.toString(),
      events: 0,
      circles: 0,
      bonds: 0,
      payouts: 0,
    };
  }

  const throughBlock = fromBlock + blockRange - 1n < safeHead ? fromBlock + blockRange - 1n : safeHead;
  const [hyperSyncLogs, targetBlock] = await Promise.all([
    getLogsFromHyperSync(fromBlock, throughBlock),
    client.getBlock({ blockNumber: throughBlock }),
  ]);
  const [factoryLogs, coreLogs] = hyperSyncLogs
    ? [
        hyperSyncLogs.filter((log) => log.address.toLowerCase() === CIRCLE_FACTORY_ADDRESS.toLowerCase()),
        hyperSyncLogs.filter((log) => log.address.toLowerCase() === CORE_ADDRESS.toLowerCase()),
      ]
    : await Promise.all([
        getLogsInRanges(client, CIRCLE_FACTORY_ADDRESS, fromBlock, throughBlock, logRange),
        getLogsInRanges(client, CORE_ADDRESS, fromBlock, throughBlock, logRange),
      ]);
  const decoded = [
    ...decodeLogs(factoryLogs, circleFactoryAbi),
    ...decodeLogs(coreLogs, coreAbi),
  ].sort((a, b) => Number(a.log.blockNumber - b.log.blockNumber) || Number((a.log.logIndex ?? 0) - (b.log.logIndex ?? 0)));

  const [indexedBonds, indexedPayouts] = await Promise.all([
    supabaseAdminRequest<IndexedEntityCircle[]>(`indexed_bonds?select=bond_id,circle_address&chain_id=eq.${activeChain.id}`),
    supabaseAdminRequest<IndexedPayoutCircle[]>(`indexed_payouts?select=payout_id,circle_address&chain_id=eq.${activeChain.id}`),
  ]);
  const bondCircles = new Map(indexedBonds.map((bond) => [String(bond.bond_id), bond.circle_address]));
  const payoutCircles = new Map(indexedPayouts.map((payout) => [String(payout.payout_id), payout.circle_address]));
  for (const { eventName, args } of decoded) {
    if (eventName === "BondOpened" && args.id !== undefined && typeof args.circle === "string") {
      bondCircles.set(String(args.id), args.circle.toLowerCase());
    }
    if (eventName === "PayoutProposed" && args.payoutId !== undefined && typeof args.circle === "string") {
      payoutCircles.set(String(args.payoutId), args.circle.toLowerCase());
    }
  }
  const blockNumbers = [...new Set(decoded.map(({ log }) => log.blockNumber.toString()))];
  const transactionHashes = [...new Set(decoded.flatMap(({ log }) => log.transactionHash ? [log.transactionHash] : []))];
  const [timestampRows, transactionRows] = await Promise.all([
    mapConcurrent(blockNumbers, 8, async (value) => {
      const block = await client.getBlock({ blockNumber: BigInt(value) });
      return [value, unixTime(block.timestamp)] as const;
    }),
    mapConcurrent(transactionHashes, 8, async (hash) => {
      const transaction = await client.getTransaction({ hash }).catch(() => undefined);
      return [hash.toLowerCase(), transaction?.from.toLowerCase()] as const;
    }),
  ]);
  const timestamps = new Map(timestampRows);
  const transactionSenders = new Map(transactionRows);

  const events = decoded.map(({ log, eventName, args }) => {
    if (log.logIndex === null || !log.transactionHash || !log.blockHash) throw new Error("RPC returned an incomplete finalized log.");
    const bondId = args.id === undefined ? null : String(args.id);
    const payoutId = args.payoutId === undefined ? null : String(args.payoutId);
    const directCircle = typeof args.circle === "string" && isAddress(args.circle) ? args.circle.toLowerCase() : null;
    const circleAddress = directCircle ?? (bondId ? bondCircles.get(bondId) : undefined) ?? (payoutId ? payoutCircles.get(payoutId) : undefined) ?? null;
    const actor = [args.creator, args.cosigner, args.objector, args.member].find((value) => typeof value === "string" && isAddress(value));
    return {
      chain_id: activeChain.id,
      tx_hash: log.transactionHash.toLowerCase(),
      log_index: log.logIndex,
      block_number: log.blockNumber.toString(),
      block_hash: log.blockHash.toLowerCase(),
      contract_address: log.address.toLowerCase(),
      event_name: eventName,
      circle_address: circleAddress,
      actor_address: typeof actor === "string" ? actor.toLowerCase() : transactionSenders.get(log.transactionHash.toLowerCase()) ?? null,
      bond_id: bondId,
      payout_id: payoutId,
      payload: jsonValue(args),
      block_timestamp: timestamps.get(log.blockNumber.toString()),
    };
  });

  const result = await supabaseAdminRequest<{
    applied: boolean;
    circleCount?: number;
    bondCount?: number;
    payoutCount?: number;
  }>("rpc/apply_chain_event_batch", {
    method: "POST",
    body: JSON.stringify({
      p_chain_id: activeChain.id,
      p_deployment_block: deploymentBlock.toString(),
      p_from_block: fromBlock.toString(),
      p_last_finalized_block: throughBlock.toString(),
      p_last_finalized_hash: targetBlock.hash.toLowerCase(),
      p_events: events,
    }),
  });

  return {
    applied: result.applied,
    caughtUp: throughBlock === safeHead,
    fromBlock: fromBlock.toString(),
    throughBlock: throughBlock.toString(),
    safeHeadBlock: safeHead.toString(),
    events: events.length,
    circles: result.circleCount ?? 0,
    bonds: result.bondCount ?? 0,
    payouts: result.payoutCount ?? 0,
  };
}
