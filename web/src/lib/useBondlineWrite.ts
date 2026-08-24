"use client";

import { useEffect, useRef, useState } from "react";
import { parseEther } from "viem";
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useChainId, useSwitchChain } from "wagmi";
import {
  CIRCLE_FACTORY_ADDRESS,
  CORE_ADDRESS,
  circleFactoryAbi,
  coreAbi,
} from "./contracts";
import { activeChain } from "./chain";
import { recordActivity } from "./supabase";

/// Wraps every Bondline write with pending/confirming/tx-hash state so the UI
/// can show each step happening on-chain (no fake optimistic updates). One hook
/// instance per action surface; pass a callback to refresh reads on confirm.
export function useBondlineWrite(onConfirmed?: () => void) {
  const { address } = useAccount();
  const chainId = useChainId();
  const { switchChainAsync } = useSwitchChain();
  const { writeContractAsync, isPending } = useWriteContract();
  const [hash, setHash] = useState<`0x${string}` | undefined>();
  const [error, setError] = useState<string | undefined>();

  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
    query: { enabled: !!hash },
  });

  const firedFor = useRef<`0x${string}` | undefined>(undefined);
  useEffect(() => {
    if (isSuccess && hash && firedFor.current !== hash) {
      firedFor.current = hash;
      onConfirmed?.();
    }
  }, [isSuccess, hash, onConfirmed]);

  const reset = () => {
    setHash(undefined);
    setError(undefined);
  };

  async function run(
    fn: () => Promise<`0x${string}`>,
    activity?: { circle: `0x${string}`; kind: string; body: string },
  ): Promise<`0x${string}` | undefined> {
    setError(undefined);
    try {
      // Make sure the wallet is on Celo before firing. Otherwise the tx goes
      // to whatever chain the wallet is on and fails with a cryptic error the
      // user can't connect to "wrong network".
      if (chainId !== activeChain.id) {
        await switchChainAsync({ chainId: activeChain.id });
      }
      const h = await fn();
      setHash(h);
      if (activity) recordActivity({ circleAddress: activity.circle, actorAddress: address, kind: activity.kind, body: activity.body, txHash: h }).catch(() => undefined);
      return h;
    } catch (e) {
      setError(friendly(e));
    }
  }

  const createCircle = (name: string, members: `0x${string}`[], bps: number) =>
    run(() =>
      writeContractAsync({
        address: CIRCLE_FACTORY_ADDRESS,
        abi: circleFactoryAbi,
        functionName: "createCircle",
        args: [name, members, bps],
      }),
    );

  const openBond = (
    circle: `0x${string}`,
    description: string,
    deadlineSec: bigint,
    stakeMon: string,
  ) =>
    run(() =>
      writeContractAsync({
        address: CORE_ADDRESS,
        abi: coreAbi,
        functionName: "openBond",
        args: [circle, description, deadlineSec],
        value: parseEther(stakeMon),
      }), { circle, kind: "bond_opened", body: `Opened a Bond: ${description}` },
    );

  const declareDone = (
    id: bigint,
    receiptsHash: `0x${string}`,
    receiptsUri: string,
  ) =>
    run(() =>
      writeContractAsync({
        address: CORE_ADDRESS,
        abi: coreAbi,
        functionName: "declareDone",
        args: [id, receiptsHash, receiptsUri],
      }),
    );

  const cosign = (id: bigint) =>
    run(() =>
      writeContractAsync({
        address: CORE_ADDRESS,
        abi: coreAbi,
        functionName: "cosign",
        args: [id],
      }),
    );

  const object = (id: bigint) =>
    run(() =>
      writeContractAsync({
        address: CORE_ADDRESS,
        abi: coreAbi,
        functionName: "object",
        args: [id],
      }),
    );

  const resolveExpired = (id: bigint) =>
    run(() =>
      writeContractAsync({
        address: CORE_ADDRESS,
        abi: coreAbi,
        functionName: "resolveExpired",
        args: [id],
      }),
    );

  const crossMissed = (id: bigint) =>
    run(() =>
      writeContractAsync({
        address: CORE_ADDRESS,
        abi: coreAbi,
        functionName: "crossMissed",
        args: [id],
      }),
    );

  const proposePayout = (
    circle: `0x${string}`,
    to: `0x${string}`,
    amountMon: string,
    memo: string,
  ) =>
    run(() =>
      writeContractAsync({
        address: CORE_ADDRESS,
        abi: coreAbi,
        functionName: "proposePayout",
        args: [circle, to, parseEther(amountMon), memo],
      }), { circle, kind: "payout_proposed", body: `Proposed a payout: ${memo}` },
    );

  const cosignPayout = (payoutId: bigint) =>
    run(() =>
      writeContractAsync({
        address: CORE_ADDRESS,
        abi: coreAbi,
        functionName: "cosignPayout",
        args: [payoutId],
      }),
    );

  return {
    createCircle,
    openBond,
    declareDone,
    cosign,
    object,
    resolveExpired,
    crossMissed,
    proposePayout,
    cosignPayout,
    hash,
    error,
    isPending,
    isConfirming,
    isSuccess,
    reset,
  };
}

function friendly(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e);
  if (/user rejected|denied/i.test(msg)) return "Transaction rejected.";
  const m = msg.match(
    /(StakeRequired|StakeTooLarge|DeadlineInPast|UnknownCircle|NotCircleMember|NotCreator|NotActive|DeadlinePassed|NotPending|CreatorCannotCosign|AlreadyCosigned|CosignClosed|CosignStillOpen|TransferFailed|InsufficientPotBalance|AlreadyExecuted|CircleTooSmall|ZeroMember|DuplicateMember|ThresholdOutOfRange|NoSuch\w+)/,
  );
  if (m) return m[1].replace(/([A-Z])/g, " $1").trim();
  return msg.split("\n")[0].slice(0, 140);
}
