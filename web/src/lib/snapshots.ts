import { isAddress } from "viem";
import { Status, type Bond, type Circle, type Payout } from "./contracts";
import type { Activity, CircleMetadata, ProfileRow } from "./supabase";
import { ACTIVE_CHAIN_ID } from "./chain";

type Numeric = string | number;

type IndexedCircleRow = {
  circle_address: string;
  name: string;
  members: string[];
  cosign_threshold_bps: number;
  balance: Numeric;
};

type IndexedBondRow = {
  bond_id: Numeric;
  creator_address: string;
  circle_address: string;
  stake: Numeric;
  deadline: string;
  cosign_closes_at: string | null;
  status: number;
  cosigns: number;
  objections: number;
  description: string;
  receipts_hash: string | null;
  receipts_uri: string | null;
};

type IndexedPayoutRow = {
  payout_id: Numeric;
  circle_address: string;
  recipient_address: string;
  amount: Numeric;
  executed: boolean;
  cosigns: number;
  memo: string;
};

export type ChainActivityRow = {
  chain_id: number;
  tx_hash: string;
  log_index: number;
  event_name: string;
  circle_address: string | null;
  actor_address: string | null;
  bond_id: Numeric | null;
  payout_id: Numeric | null;
  payload: Record<string, unknown> | null;
  block_timestamp: string;
};

type RawDashboardSnapshot = {
  circles: IndexedCircleRow[];
  bonds: IndexedBondRow[];
  payouts: IndexedPayoutRow[];
  indexedThroughBlock: Numeric;
};

type RawCircleSnapshot = {
  circle: IndexedCircleRow;
  metadata: CircleMetadata | null;
  profiles: ProfileRow[];
  bonds: IndexedBondRow[];
  payouts: IndexedPayoutRow[];
  activity: ChainActivityRow[];
  indexedThroughBlock: Numeric;
};

export type DashboardSnapshot = {
  circles: Circle[];
  bonds: Bond[];
  payouts: Payout[];
  indexedThroughBlock: bigint;
};

export type CircleSnapshot = DashboardSnapshot & {
  circle: Circle;
  metadata?: CircleMetadata;
  profiles: ProfileRow[];
  activity: Activity[];
};

export const dashboardSnapshotKey = ["indexed-dashboard-snapshot", ACTIVE_CHAIN_ID] as const;
export const circleSnapshotKey = (address: string) => ["indexed-circle-snapshot", ACTIVE_CHAIN_ID, address.toLowerCase()] as const;

function asAddress(value: unknown): `0x${string}` {
  if (typeof value !== "string" || !isAddress(value)) throw new Error("The indexed snapshot contains an invalid address.");
  return value.toLowerCase() as `0x${string}`;
}

function asBigInt(value: unknown): bigint {
  if (typeof value !== "string" && typeof value !== "number") throw new Error("The indexed snapshot contains an invalid number.");
  return BigInt(value);
}

function unixSeconds(value: string | null): bigint {
  if (!value) return 0n;
  const milliseconds = Date.parse(value);
  if (!Number.isFinite(milliseconds)) throw new Error("The indexed snapshot contains an invalid timestamp.");
  return BigInt(Math.floor(milliseconds / 1000));
}

function toCircle(row: IndexedCircleRow): Circle {
  const members = row.members.map(asAddress);
  if (!members.length || !Number.isInteger(row.cosign_threshold_bps)) throw new Error("The indexed Circle is incomplete.");
  return {
    address: asAddress(row.circle_address),
    name: row.name,
    members,
    cosignThresholdBps: row.cosign_threshold_bps,
    balance: asBigInt(row.balance),
  };
}

function toBond(row: IndexedBondRow): Bond {
  if (!Number.isInteger(row.status) || row.status < Status.Active || row.status > Status.Crossed) throw new Error("The indexed Bond has an invalid status.");
  return {
    id: asBigInt(row.bond_id),
    creator: asAddress(row.creator_address),
    circle: asAddress(row.circle_address),
    stake: asBigInt(row.stake),
    deadline: unixSeconds(row.deadline),
    cosignClosesAt: unixSeconds(row.cosign_closes_at),
    status: row.status as Status,
    cosigns: row.cosigns,
    objections: row.objections,
    description: row.description,
    receiptsHash: (row.receipts_hash ?? "0x0000000000000000000000000000000000000000000000000000000000000000") as `0x${string}`,
    receiptsUri: row.receipts_uri ?? "",
  };
}

function toPayout(row: IndexedPayoutRow): Payout {
  return {
    id: asBigInt(row.payout_id),
    circle: asAddress(row.circle_address),
    to: asAddress(row.recipient_address),
    amount: asBigInt(row.amount),
    executed: row.executed,
    cosigns: row.cosigns,
    memo: row.memo,
  };
}

function eventBody(event: ChainActivityRow) {
  const payload = event.payload ?? {};
  if (event.event_name === "BondOpened") return typeof payload.description === "string" ? `Opened a Bond · ${payload.description}` : "Opened a Bond";
  if (event.event_name === "BondDeclared") return "Submitted a receipt and opened the cosign";
  if (event.event_name === "BondResolved") return Number(payload.status) === Status.Met ? "Cleared a Bond" : "Crossed the Line";
  if (event.event_name === "PayoutProposed") return typeof payload.memo === "string" ? `Proposed a Circle payout · ${payload.memo}` : "Proposed a Circle payout";
  const label: Record<string, string> = {
    CircleCreated: "Created the Circle",
    Cosigned: "Cosigned a Bond",
    Objected: "Objected to a Bond",
    PayoutCosigned: "Cosigned a Circle payout",
    PayoutExecuted: "Executed a Circle payout",
  };
  return label[event.event_name] ?? event.event_name.replace(/([a-z])([A-Z])/g, "$1 $2");
}

function toActivity(event: ChainActivityRow): Activity {
  return {
    id: `${event.tx_hash}:${event.log_index}`,
    chain_id: event.chain_id,
    circle_address: event.circle_address ?? "",
    actor_address: event.actor_address,
    kind: event.event_name,
    body: eventBody(event),
    tx_hash: event.tx_hash,
    created_at: event.block_timestamp,
  };
}

function assertRawDashboard(value: unknown): RawDashboardSnapshot {
  if (!value || typeof value !== "object") throw new Error("The indexed dashboard snapshot is unavailable.");
  const raw = value as Partial<RawDashboardSnapshot>;
  if (!Array.isArray(raw.circles) || !Array.isArray(raw.bonds) || !Array.isArray(raw.payouts) || raw.indexedThroughBlock === undefined) {
    throw new Error("The indexed dashboard snapshot is incomplete.");
  }
  return raw as RawDashboardSnapshot;
}

export function parseDashboardSnapshot(value: unknown): DashboardSnapshot {
  const raw = assertRawDashboard(value);
  return {
    circles: raw.circles.map(toCircle),
    bonds: raw.bonds.map(toBond),
    payouts: raw.payouts.map(toPayout),
    indexedThroughBlock: asBigInt(raw.indexedThroughBlock),
  };
}

export function parseCircleSnapshot(value: unknown): CircleSnapshot {
  if (!value || typeof value !== "object") throw new Error("The indexed Circle snapshot is unavailable.");
  const raw = value as Partial<RawCircleSnapshot>;
  if (!raw.circle || !Array.isArray(raw.profiles) || !Array.isArray(raw.activity)) throw new Error("The indexed Circle snapshot is incomplete.");
  const dashboard = parseDashboardSnapshot({
    circles: [raw.circle],
    bonds: raw.bonds,
    payouts: raw.payouts,
    indexedThroughBlock: raw.indexedThroughBlock,
  });
  return {
    ...dashboard,
    circle: dashboard.circles[0],
    metadata: raw.metadata ?? undefined,
    profiles: raw.profiles,
    activity: raw.activity.map(toActivity),
  };
}

async function fetchJson(path: string) {
  const response = await fetch(path, { credentials: "same-origin" });
  if (!response.ok) throw new Error(response.status === 404 ? "The indexed snapshot is not ready." : "The indexed snapshot is temporarily unavailable.");
  return response.json() as Promise<unknown>;
}

export async function getDashboardSnapshot() {
  return parseDashboardSnapshot(await fetchJson("/api/dashboard/snapshot"));
}

export async function getCircleSnapshot(address: string) {
  return parseCircleSnapshot(await fetchJson(`/api/circles/${address}/snapshot`));
}
