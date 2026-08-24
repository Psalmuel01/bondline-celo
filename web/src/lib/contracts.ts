// Bondline contract layer — addresses, ABIs, types, enums.
// Two singletons (CircleFactory + BondlineCore) plus per-Circle clones
// discovered at runtime.
//
// Set these in web/.env.local after deploying (see contracts/README):
//   NEXT_PUBLIC_CIRCLE_FACTORY_ADDRESS=0x…
//   NEXT_PUBLIC_CORE_ADDRESS=0x…
import { bondlineConfig } from "./chain";

const ZERO = "0x0000000000000000000000000000000000000000" as const;

export const CIRCLE_FACTORY_ADDRESS = (bondlineConfig.factoryAddress ?? ZERO) as `0x${string}`;
export const CORE_ADDRESS = (bondlineConfig.coreAddress ?? ZERO) as `0x${string}`;

export const isConfigured =
  CIRCLE_FACTORY_ADDRESS !== ZERO && CORE_ADDRESS !== ZERO;

// --- enums / types ---

export enum Status {
  Active = 0, // staked, deadline running
  PendingCosign = 1, // creator declared met, Circle is cosigning
  Met = 2, // cleared -> refunded
  Crossed = 3, // objected or lapsed -> funded the Pot
}

export type Bond = {
  id: bigint;
  creator: `0x${string}`;
  circle: `0x${string}`;
  stake: bigint;
  deadline: bigint;
  cosignClosesAt: bigint;
  status: Status;
  cosigns: number;
  objections: number;
  description: string;
  receiptsHash: `0x${string}`;
  receiptsUri: string;
};

export type Circle = {
  address: `0x${string}`;
  name: string;
  members: `0x${string}`[];
  cosignThresholdBps: number;
  balance: bigint;
};

export type Payout = {
  id: bigint;
  circle: `0x${string}`;
  to: `0x${string}`;
  amount: bigint;
  executed: boolean;
  cosigns: number;
  memo: string;
};

// --- ABIs ---

export const circleFactoryAbi = [
  {
    type: "function",
    name: "createCircle",
    stateMutability: "nonpayable",
    inputs: [
      { name: "name_", type: "string" },
      { name: "members_", type: "address[]" },
      { name: "cosignThresholdBps_", type: "uint16" },
    ],
    outputs: [{ name: "circle", type: "address" }],
  },
  {
    type: "function",
    name: "allCircles",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address[]" }],
  },
  {
    type: "function",
    name: "circleCount",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "isCircle",
    stateMutability: "view",
    inputs: [{ name: "", type: "address" }],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "event",
    name: "CircleCreated",
    inputs: [
      { name: "circle", type: "address", indexed: true },
      { name: "creator", type: "address", indexed: true },
      { name: "name", type: "string", indexed: false },
      { name: "members", type: "address[]", indexed: false },
      { name: "cosignThresholdBps", type: "uint16", indexed: false },
    ],
  },
] as const;

export const circleAbi = [
  {
    type: "function",
    name: "name",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "string" }],
  },
  {
    type: "function",
    name: "cosignThresholdBps",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint16" }],
  },
  {
    type: "function",
    name: "members",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address[]" }],
  },
  {
    type: "function",
    name: "memberCount",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "balance",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "isMember",
    stateMutability: "view",
    inputs: [{ name: "", type: "address" }],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "function",
    name: "requiredCosigns",
    stateMutability: "view",
    inputs: [{ name: "eligibleCosigners", type: "uint256" }],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

export const coreAbi = [
  {
    type: "function",
    name: "openBond",
    stateMutability: "payable",
    inputs: [
      { name: "circle", type: "address" },
      { name: "description", type: "string" },
      { name: "deadline", type: "uint64" },
    ],
    outputs: [{ name: "id", type: "uint256" }],
  },
  {
    type: "function",
    name: "declareDone",
    stateMutability: "nonpayable",
    inputs: [
      { name: "id", type: "uint256" },
      { name: "receiptsHash", type: "bytes32" },
      { name: "receiptsUri", type: "string" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "cosign",
    stateMutability: "nonpayable",
    inputs: [{ name: "id", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "object",
    stateMutability: "nonpayable",
    inputs: [{ name: "id", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "resolveExpired",
    stateMutability: "nonpayable",
    inputs: [{ name: "id", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "crossMissed",
    stateMutability: "nonpayable",
    inputs: [{ name: "id", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "proposePayout",
    stateMutability: "nonpayable",
    inputs: [
      { name: "circle", type: "address" },
      { name: "to", type: "address" },
      { name: "amount", type: "uint96" },
      { name: "memo", type: "string" },
    ],
    outputs: [{ name: "payoutId", type: "uint256" }],
  },
  {
    type: "function",
    name: "cosignPayout",
    stateMutability: "nonpayable",
    inputs: [{ name: "payoutId", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "bondCount",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "bonds",
    stateMutability: "view",
    inputs: [{ name: "id", type: "uint256" }],
    outputs: [
      { name: "creator", type: "address" },
      { name: "circle", type: "address" },
      { name: "stake", type: "uint96" },
      { name: "deadline", type: "uint64" },
      { name: "cosignClosesAt", type: "uint64" },
      { name: "status", type: "uint8" },
      { name: "cosigns", type: "uint32" },
      { name: "objections", type: "uint32" },
      { name: "description", type: "string" },
      { name: "receiptsHash", type: "bytes32" },
      { name: "receiptsUri", type: "string" },
    ],
  },
  {
    type: "function",
    name: "cosignState",
    stateMutability: "view",
    inputs: [{ name: "id", type: "uint256" }],
    outputs: [
      { name: "eligible", type: "uint256" },
      { name: "required", type: "uint256" },
      { name: "confirms", type: "uint32" },
      { name: "objections", type: "uint32" },
      { name: "clearedNow", type: "bool" },
      { name: "crossableNow", type: "bool" },
    ],
  },
  {
    type: "function",
    name: "hasResponded",
    stateMutability: "view",
    inputs: [
      { name: "", type: "uint256" },
      { name: "", type: "address" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "function",
    name: "payoutCount",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "payouts",
    stateMutability: "view",
    inputs: [{ name: "id", type: "uint256" }],
    outputs: [
      { name: "circle", type: "address" },
      { name: "to", type: "address" },
      { name: "amount", type: "uint96" },
      { name: "executed", type: "bool" },
      { name: "cosigns", type: "uint32" },
      { name: "memo", type: "string" },
    ],
  },
  {
    type: "function",
    name: "hasCosignedPayout",
    stateMutability: "view",
    inputs: [
      { name: "", type: "uint256" },
      { name: "", type: "address" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "function",
    name: "COSIGN_WINDOW",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint64" }],
  },
  {
    type: "event",
    name: "BondOpened",
    inputs: [
      { name: "id", type: "uint256", indexed: true },
      { name: "creator", type: "address", indexed: true },
      { name: "circle", type: "address", indexed: true },
      { name: "stake", type: "uint256", indexed: false },
      { name: "deadline", type: "uint64", indexed: false },
      { name: "description", type: "string", indexed: false },
    ],
  },
  {
    type: "event",
    name: "BondDeclared",
    inputs: [
      { name: "id", type: "uint256", indexed: true },
      { name: "creator", type: "address", indexed: true },
      { name: "cosignClosesAt", type: "uint64", indexed: false },
      { name: "receiptsHash", type: "bytes32", indexed: false },
      { name: "receiptsUri", type: "string", indexed: false },
    ],
  },
  {
    type: "event",
    name: "Cosigned",
    inputs: [
      { name: "id", type: "uint256", indexed: true },
      { name: "cosigner", type: "address", indexed: true },
      { name: "cosigns", type: "uint32", indexed: false },
    ],
  },
  {
    type: "event",
    name: "Objected",
    inputs: [
      { name: "id", type: "uint256", indexed: true },
      { name: "objector", type: "address", indexed: true },
      { name: "objections", type: "uint32", indexed: false },
    ],
  },
  {
    type: "event",
    name: "BondResolved",
    inputs: [
      { name: "id", type: "uint256", indexed: true },
      { name: "status", type: "uint8", indexed: false },
      { name: "stake", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "PayoutProposed",
    inputs: [
      { name: "payoutId", type: "uint256", indexed: true },
      { name: "circle", type: "address", indexed: true },
      { name: "to", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
      { name: "memo", type: "string", indexed: false },
    ],
  },
  {
    type: "event",
    name: "PayoutCosigned",
    inputs: [
      { name: "payoutId", type: "uint256", indexed: true },
      { name: "member", type: "address", indexed: true },
      { name: "cosigns", type: "uint32", indexed: false },
    ],
  },
  {
    type: "event",
    name: "PayoutExecuted",
    inputs: [
      { name: "payoutId", type: "uint256", indexed: true },
      { name: "circle", type: "address", indexed: true },
      { name: "to", type: "address", indexed: false },
      { name: "amount", type: "uint256", indexed: false },
    ],
  },
] as const;
