"use client";

import { useEffect, useRef } from "react";
import { useAccount, useConnect, useDisconnect, useSwitchChain } from "wagmi";
import { activeChain } from "@/lib/chain";
import { shortAddr } from "@/lib/format";

export function ConnectButton() {
  // useAccount().chainId reflects the wallet's *actual* network. useChainId()
  // reports the config's chain (only Celo is configured), so it can't detect
  // a wallet sitting on the wrong chain — that was why no switch prompt showed.
  const { address, isConnected, chainId } = useAccount();
  const { connect, connectors, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain, isPending: isSwitching } = useSwitchChain();

  const injected = connectors.find((c) => c.type === "injected") ?? connectors[0];
  const wrongChain = isConnected && chainId !== undefined && chainId !== activeChain.id;

  // As soon as we detect the wrong network, prompt the wallet to switch — the
  // user shouldn't have to notice the button and click it themselves. Guarded
  // so we only auto-prompt once per wrong-chain entry, not in a loop.
  const promptedFor = useRef<number | undefined>(undefined);
  useEffect(() => {
    if (wrongChain && chainId !== undefined && promptedFor.current !== chainId) {
      promptedFor.current = chainId;
      switchChain({ chainId: activeChain.id });
    }
    if (!wrongChain) promptedFor.current = undefined;
  }, [wrongChain, chainId, switchChain]);

  if (!isConnected) {
    return (
      <button
        onClick={() => injected && connect({ connector: injected })}
        disabled={isPending}
        className="rounded-lg bg-gold px-4 py-2 text-sm font-semibold text-ink transition hover:brightness-108 disabled:opacity-50"
      >
        {isPending ? "Connecting…" : "Connect wallet"}
      </button>
    );
  }

  if (wrongChain) {
    return (
      <button
        onClick={() => switchChain({ chainId: activeChain.id })}
        disabled={isSwitching}
        className="rounded-md border border-forfeit/50 bg-forfeit/10 px-4 py-2 text-sm font-medium text-forfeit transition hover:bg-forfeit/20 disabled:opacity-60"
      >
        {isSwitching ? "Switching…" : "Wrong network — switch to Celo"}
      </button>
    );
  }

  return (
    <button
      onClick={() => disconnect()}
      className="cursor-pointer tnum rounded-md border border-line bg-panel px-4 py-2 text-sm text-muted transition hover:border-gold/40 hover:text-gold"
      title="Disconnect"
    >
      {shortAddr(address)}
    </button>
  );
}
