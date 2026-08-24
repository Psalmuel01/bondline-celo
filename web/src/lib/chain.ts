import type { Address } from "viem";
import { celo, celoSepolia } from "viem/chains";

export type BondlineNetwork = "celo-sepolia" | "celo-mainnet";
export const celoSepoliaChain = {
  ...celoSepolia,
  nativeCurrency: { name: "CELO", symbol: "CELO", decimals: 18 },
  rpcUrls: { default: { http: ["https://forno.celo-sepolia.celo-testnet.org"] } },
} as const;
export const celoMainnetChain = celo;
const network = process.env.NEXT_PUBLIC_BONDLINE_NETWORK ?? "celo-sepolia";
if (network !== "celo-sepolia" && network !== "celo-mainnet") {
  throw new Error("NEXT_PUBLIC_BONDLINE_NETWORK must be celo-sepolia or celo-mainnet.");
}

const deployments = {
  "celo-sepolia": {
    chain: celoSepoliaChain,
    coreAddress: process.env.NEXT_PUBLIC_CORE_ADDRESS as Address | undefined,
    factoryAddress: process.env.NEXT_PUBLIC_CIRCLE_FACTORY_ADDRESS as Address | undefined,
    deploymentBlock: process.env.BONDLINE_DEPLOYMENT_BLOCK ?? "0",
    finalityBlocks: 12,
    indexer: { mode: "rpc" as const, hyperSyncUrl: undefined },
  },
  "celo-mainnet": {
    chain: celoMainnetChain,
    coreAddress: process.env.NEXT_PUBLIC_CORE_ADDRESS as Address | undefined,
    factoryAddress: process.env.NEXT_PUBLIC_CIRCLE_FACTORY_ADDRESS as Address | undefined,
    deploymentBlock: process.env.BONDLINE_DEPLOYMENT_BLOCK ?? "0",
    finalityBlocks: 12,
    indexer: { mode: "hypersync" as const, hyperSyncUrl: "https://celo.hypersync.xyz" },
  },
} as const;

export const bondlineConfig = { network, ...deployments[network] };
export const activeChain = bondlineConfig.chain;
export const ACTIVE_CHAIN_ID = activeChain.id;
export const NATIVE_SYMBOL = activeChain.nativeCurrency.symbol;
export const explorerTx = (hash: string) => `${activeChain.blockExplorers.default.url}/tx/${hash}`;
export const explorerAddr = (address: string) => `${activeChain.blockExplorers.default.url}/address/${address}`;
