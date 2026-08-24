import "server-only";

import { createPublicClient, http, isAddress } from "viem";
import { circleAbi } from "@/lib/contracts";
import { activeChain } from "@/lib/chain";

const client = createPublicClient({
  chain: activeChain,
  transport: http(process.env.CELO_RPC_URL),
});

export async function isCircleMember(circleAddress: string, walletAddress: `0x${string}`) {
  if (!isAddress(circleAddress)) return false;
  return client.readContract({
    address: circleAddress,
    abi: circleAbi,
    functionName: "isMember",
    args: [walletAddress],
  });
}
