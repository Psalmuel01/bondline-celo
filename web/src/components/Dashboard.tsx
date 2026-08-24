"use client";

import { useEffect, useMemo, useState } from "react";
import { useAccount } from "wagmi";
import { useQueryClient } from "@tanstack/react-query";
import { useCircles, useBonds } from "@/lib/hooks";
import { isConfigured } from "@/lib/contracts";
import { getMessages, isSupabaseConfigured } from "@/lib/supabase";
import { circleSnapshotKey, getCircleSnapshot } from "@/lib/snapshots";
import { CircleCard } from "./CircleCard";
import { CreateCircle } from "./CreateCircle";
import { useWalletSession } from "@/lib/useWalletSession";
import { ACTIVE_CHAIN_ID } from "@/lib/chain";

/// Multi-group dashboard: every Circle you're in, plus a toggle to spin up a new
/// one. Circles you're not a member of are shown dimmed under "other Circles" so
/// the registry is visible without cluttering your crews.
export function Dashboard() {
  const { address } = useAccount();
  const queryClient = useQueryClient();
  const { isAuthenticated } = useWalletSession();
  const { circles, isLoading: circlesLoading, error, refresh } = useCircles();
  const { bonds, isLoading: bondsLoading, refresh: refreshBonds } = useBonds();
  const isLoading = circlesLoading || bondsLoading;
  const [creating, setCreating] = useState(false);

  const { mine, others } = useMemo(() => {
    const mine = [];
    const others = [];
    for (const c of circles) {
      if (address && c.members.some((m) => m.toLowerCase() === address.toLowerCase())) {
        mine.push(c);
      } else {
        others.push(c);
      }
    }
    return { mine, others };
  }, [circles, address]);

  function refreshAll() {
    refresh();
    refreshBonds();
    setCreating(false);
  }

  // Warm every detail route while the dashboard is open. Navigation then reads
  // from memory instead of starting a new chain/Supabase waterfall.
  useEffect(() => {
    if (!isSupabaseConfigured || isLoading) return;
    for (const circle of circles) {
      const circleKey = circle.address.toLowerCase();
      void queryClient.prefetchQuery({ queryKey: circleSnapshotKey(circle.address), queryFn: () => getCircleSnapshot(circle.address) });
      if (isAuthenticated && address && circle.members.some((member) => member.toLowerCase() === address.toLowerCase())) {
        void queryClient.prefetchQuery({ queryKey: ["circle-messages", ACTIVE_CHAIN_ID, circleKey], queryFn: () => getMessages(circle.address) });
      }
    }
  }, [address, circles, isAuthenticated, isLoading, queryClient]);

  if (!isConfigured) {
    return (
      <div className="rounded-xl border border-forfeit/30 bg-forfeit/5 p-6 text-sm text-forfeit">
        Contracts aren&apos;t configured yet. Set NEXT_PUBLIC_CIRCLE_FACTORY_ADDRESS
        and NEXT_PUBLIC_CORE_ADDRESS in web/.env.local after deploying.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg font-semibold tracking-tight text-bone">
          Your Circles
        </h2>
        <button
          onClick={() => setCreating((v) => !v)}
          className="rounded-lg bg-gold px-4 py-2 text-sm font-semibold text-ink transition hover:brightness-108"
        >
          {creating ? "Close" : "+ New Circle"}
        </button>
      </div>

      {creating && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-bg/65 p-4 backdrop-blur-sm sm:items-center" role="dialog" aria-modal="true" aria-label="Create a Circle">
          <div className="relative w-full max-w-3xl rounded-2xl border border-panel-hi bg-panel shadow-2xl shadow-black/30">
            <button onClick={() => setCreating(false)} className="absolute right-5 top-4 z-10 text-xl text-muted transition hover:text-bone" aria-label="Close">×</button>
            <CreateCircle onCreated={refreshAll} />
          </div>
        </div>
      )}

      {isLoading && circles.length === 0 ? (
        <p className="text-sm text-faint">Loading Circles…</p>
      ) : error ? (
        <div className="rounded-xl border border-forfeit/30 bg-forfeit/5 p-6 text-sm text-forfeit">
          Couldn&apos;t load Circles right now. Please refresh and try again.
        </div>
      ) : mine.length === 0 ? (
        <div className="rounded-xl border border-line bg-panel p-6">
          <p className="text-sm text-muted">
            You&apos;re not in a Circle yet. Start one with your crew and put a
            deadline on the Line.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {mine.map((c) => (
            <CircleCard key={c.address} circle={c} bonds={bonds} />
          ))}
        </div>
      )}

      {others.length > 0 && (
        <div className="flex flex-col gap-4">
          <h2 className="font-display text-sm font-semibold uppercase tracking-widest text-faint">
            Other Circles
          </h2>
          <div className="grid gap-4 opacity-60 sm:grid-cols-2 lg:grid-cols-3">
            {others.map((c) => (
              <CircleCard key={c.address} circle={c} bonds={bonds} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
