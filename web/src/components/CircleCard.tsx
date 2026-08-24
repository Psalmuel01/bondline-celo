"use client";

import Link from "next/link";
import { useAccount } from "wagmi";
import { useQueryClient } from "@tanstack/react-query";
import type { Bond, Circle } from "@/lib/contracts";
import { Status } from "@/lib/contracts";
import { bpsPct, formatMon } from "@/lib/format";
import { getMessages, isSupabaseConfigured } from "@/lib/supabase";
import { circleSnapshotKey, getCircleSnapshot } from "@/lib/snapshots";
import { Avatar } from "./Avatar";
import { useWalletSession } from "@/lib/useWalletSession";
import { ACTIVE_CHAIN_ID } from "@/lib/chain";

/// One Circle tile on the dashboard. Surfaces the numbers that matter at a
/// glance: the Pot balance, live/cosigning count, and whether it's your turn to
/// cosign.
export function CircleCard({
  circle,
  bonds,
}: {
  circle: Circle;
  bonds: Bond[];
}) {
  const { address } = useAccount();
  const queryClient = useQueryClient();
  const { isAuthenticated } = useWalletSession();
  const mine = bonds.filter(
    (b) => b.circle.toLowerCase() === circle.address.toLowerCase(),
  );
  const live = mine.filter((b) => b.status === Status.Active).length;
  const cosigning = mine.filter((b) => b.status === Status.PendingCosign);

  const needsYou =
    !!address &&
    cosigning.some(
      (b) =>
        b.creator.toLowerCase() !== address.toLowerCase() &&
        circle.members.some((m) => m.toLowerCase() === address.toLowerCase()),
    );
  const isMember = !!address && circle.members.some((member) => member.toLowerCase() === address.toLowerCase());

  function prefetchCircle() {
    if (!isSupabaseConfigured) return;
    const circleKey = circle.address.toLowerCase();
    void queryClient.prefetchQuery({ queryKey: circleSnapshotKey(circle.address), queryFn: () => getCircleSnapshot(circle.address) });
    if (isMember && isAuthenticated) void queryClient.prefetchQuery({ queryKey: ["circle-messages", ACTIVE_CHAIN_ID, circleKey], queryFn: () => getMessages(circle.address) });
  }

  return (
    <Link
      href={`/circle/${circle.address}`}
      onMouseEnter={prefetchCircle}
      onFocus={prefetchCircle}
      className="group flex flex-col gap-4 rounded-xl border border-line bg-panel p-5 transition hover:border-panel-hi"
    >
      <div className="flex items-start justify-between">
        <div>
          <h3 className="font-display text-base font-semibold tracking-tight text-bone">
            {circle.name || "Untitled Circle"}
          </h3>
          <p className="tnum mt-0.5 text-xs text-faint">
            {circle.members.length} members · {bpsPct(circle.cosignThresholdBps)} to cosign
          </p>
        </div>
        {needsYou && (
          <span className="tnum rounded-full border border-gold/40 bg-gold/10 px-2 py-0.5 text-[10px] font-semibold text-gold pulse">
            COSIGN NOW
          </span>
        )}
      </div>

      <div className="flex items-end justify-between">
        <div>
          <div className="text-[10px] uppercase tracking-widest text-faint">The Pot</div>
          <div className="tnum text-2xl font-semibold text-bone">
            {formatMon(circle.balance)}
            <span className="ml-1 text-sm text-muted">CELO</span>
          </div>
        </div>
        <div className="flex -space-x-2">
          {circle.members.slice(0, 5).map((m) => (
            <Avatar key={m} addr={m} size={26} />
          ))}
          {circle.members.length > 5 && (
            <div className="tnum flex h-[26px] w-[26px] items-center justify-center rounded-full border border-line bg-bg text-[10px] text-muted">
              +{circle.members.length - 5}
            </div>
          )}
        </div>
      </div>

      <div className="tnum flex gap-3 border-t border-line pt-3 text-xs text-muted">
        {live > 0 && (
          <span className="flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-gold pulse" />
            {live} on the Line
          </span>
        )}
        {cosigning.length > 0 && <span className="text-gold">{cosigning.length} in cosign</span>}
        {live === 0 && cosigning.length === 0 && <span className="text-faint">no live Bonds</span>}
      </div>
    </Link>
  );
}
