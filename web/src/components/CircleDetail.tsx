"use client";

import Link from "next/link";
import { useAccount } from "wagmi";
import { useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCircle, useBonds, usePayouts, useNow } from "@/lib/hooks";
import { useCircleSnapshot } from "@/lib/useSnapshots";
import { circleSnapshotKey, type CircleSnapshot } from "@/lib/snapshots";
import { Status } from "@/lib/contracts";
import { bpsPct, formatMon, shortAddr } from "@/lib/format";
import { ACTIVE_CHAIN_ID, explorerAddr } from "@/lib/chain";
import { Header } from "./Header";
import { Footer } from "./Footer";
import { Avatar } from "./Avatar";
import { BondCard } from "./BondCard";
import { OpenBond } from "./OpenBond";
import { PayoutPanel } from "./PayoutPanel";
import { PayoutList } from "./PayoutList";
import { CircleChat } from "./CircleChat";
import { ProfileName } from "./ProfileName";
import { useProfiles } from "@/lib/useProfiles";
import { CircleSettings } from "./CircleSettings";
import { CircleShare } from "./CircleShare";
import { ActivityTimeline } from "./ActivityTimeline";
import { getCircleMetadata, isSupabaseConfigured, type CircleMetadata } from "@/lib/supabase";

/// Full detail for one Circle: pooled balance, member roster, the shared-fund
/// controls, and every Bond tied to this Circle, live-sorted so the ones
/// needing attention float up.
export function CircleDetail({ address: circleAddress }: { address: `0x${string}` }) {
  const { address } = useAccount();
  const now = useNow();
  const snapshot = useCircleSnapshot(circleAddress);
  const { circle, isLoading, refresh } = useCircle(circleAddress);
  const { bonds, isLoading: bondsLoading, refresh: refreshBonds } = useBonds();
  const { payouts, isLoading: payoutsLoading, refresh: refreshPayouts } = usePayouts();
  const queryClient = useQueryClient();
  const metadataQuery = useQuery({
    queryKey: ["circle-metadata", ACTIVE_CHAIN_ID, circleAddress.toLowerCase()],
    queryFn: () => getCircleMetadata(circleAddress),
    enabled: isSupabaseConfigured,
    initialData: snapshot.data?.metadata,
  });
  const metadata = metadataQuery.data ?? snapshot.data?.metadata;
  const metadataLoading = metadataQuery.isLoading && !snapshot.data;
  const setCircleMetadata = useCallback((next: CircleMetadata | undefined) => {
    queryClient.setQueryData(["circle-metadata", ACTIVE_CHAIN_ID, circleAddress.toLowerCase()], next);
    queryClient.setQueryData<CircleSnapshot>(circleSnapshotKey(circleAddress), (current) => current ? { ...current, metadata: next } : current);
  }, [circleAddress, queryClient]);
  // Profile data is preloaded from the dashboard for this exact member list.
  // Bond authors are members, so this keeps the detail route cacheable without
  // pulling unrelated Circles' profiles into the request.
  const profileAddresses = circle?.members ?? [];
  const { names, profiles, save: saveProfile, enabled: profilesEnabled, isLoading: profilesLoading } = useProfiles(profileAddresses, snapshot.data?.profiles);
  const snapshotReady = Boolean(snapshot.data);
  const isPageLoading = snapshot.isLoading || isLoading || (bondsLoading && !snapshotReady) || (payoutsLoading && !snapshotReady) || profilesLoading || metadataLoading;

  function refreshAll() {
    refresh();
    refreshBonds();
    refreshPayouts();
    void queryClient.invalidateQueries({ queryKey: ["circle-activity", ACTIVE_CHAIN_ID, circleAddress.toLowerCase()] });
    void queryClient.invalidateQueries({ queryKey: circleSnapshotKey(circleAddress) });
  }

  const circleBonds = (bondsLoading && snapshot.data ? snapshot.data.bonds : bonds)
    .filter((b) => b.circle.toLowerCase() === circleAddress.toLowerCase())
    .sort((a, b) => {
      // voting first, then active by soonest deadline, then resolved
      const rank = (s: Status) =>
        s === Status.PendingCosign ? 0 : s === Status.Active ? 1 : 2;
      const r = rank(a.status) - rank(b.status);
      if (r !== 0) return r;
      return Number(a.deadline - b.deadline);
    });

  const circlePayouts = (payoutsLoading && snapshot.data ? snapshot.data.payouts : payouts).filter(
    (p) => p.circle.toLowerCase() === circleAddress.toLowerCase(),
  );

  const isMember =
    !!address && !!circle?.members.some((m) => m.toLowerCase() === address.toLowerCase());

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-5 py-6 sm:px-8">
      <Header />

      <Link href="/" className="mt-6 text-xs text-faint hover:text-muted">
        ← all Circles
      </Link>

      {isPageLoading && (
        <CircleDetailSkeleton />
      )}
      {!isPageLoading && !circle ? (
        <p className="mt-8 text-sm text-forfeit">Circle not found.</p>
      ) : !isPageLoading && circle ? (
        <>
          {/* circle header */}
          <section className="relative mt-4 flex flex-col gap-5 overflow-hidden rounded-2xl border border-line bg-panel/80 p-5 sm:p-7">
            {metadata?.banner_url && <img src={metadata.banner_url} alt="" onError={(event) => { event.currentTarget.style.display = "none"; }} className="absolute inset-0 h-full w-full object-cover opacity-20" />}
            <div className="absolute inset-0 bg-gradient-to-r from-panel via-panel/90 to-panel/55" />
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="relative">
                <h1 className="font-display text-3xl font-semibold tracking-tight text-bone">
                  {circle.name || "Untitled Circle"}
                </h1>
                <a
                  href={explorerAddr(circle.address)}
                  target="_blank"
                  rel="noreferrer"
                  className="tnum text-xs text-faint hover:text-muted"
                >
                  {shortAddr(circle.address)} ↗
                </a>
                {metadata?.mission && <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted">{metadata.mission}</p>}
              </div>
                <div className="relative text-right">
                  <div>
                    <div className="text-[10px] uppercase tracking-widest text-faint">
                      The Pot
                    </div>
                    <div className="tnum text-3xl font-semibold text-gold">
                      {formatMon(circle.balance)}
                      <span className="ml-1 text-base text-muted">CELO</span>
                    </div>
                    <p className="mt-1 text-xs text-faint">earned one crossed deadline at a time</p>
                    {metadata?.pot_goal && <p className="tnum mt-2 text-xs text-gold">goal · {metadata.pot_goal} CELO</p>}
                  </div>
                </div>
            </div>

            {/* roster */}
            <div className="relative flex flex-col gap-2">
              <span className="text-[10px] uppercase tracking-widest text-faint">
                {circle.members.length} members · {bpsPct(circle.cosignThresholdBps)} to cosign
              </span>
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex flex-wrap items-center gap-3">
                {circle.members.map((m) => (
                  <div key={m} className="flex items-center gap-1.5">
                    <Avatar
                      addr={m}
                      size={30}
                      you={m.toLowerCase() === address?.toLowerCase()}
                      imageUrl={profiles[m.toLowerCase()]?.avatar_url}
                      color={profiles[m.toLowerCase()]?.avatar_color}
                    />
                    <span className="text-xs text-muted">
                      <ProfileName
                        address={m}
                        profile={profiles[m.toLowerCase()]}
                        editable={profilesEnabled && m.toLowerCase() === address?.toLowerCase()}
                        onSave={(profile) => saveProfile(m, profile)}
                      />
                      {m.toLowerCase() === address?.toLowerCase() && " (you)"}
                    </span>
                  </div>
                ))}
                <CircleSettings circle={circle} metadata={metadata} onMetadata={setCircleMetadata} />
                </div>
                <div className="ml-auto flex items-center">
                  <CircleShare circle={circle} />
                </div>
              </div>
            </div>
          </section>

          <div className="mt-8 grid gap-8 xl:grid-cols-[minmax(0,1fr)_360px]">
            {/* bonds */}
            <div className="flex flex-col gap-4">
              <h2 className="font-display text-lg font-semibold tracking-tight text-bone">
                Bonds on the Line
              </h2>
              {circleBonds.length === 0 ? (
                <div className="rounded-xl border border-line bg-panel p-6 text-sm text-faint">
                  No Bonds yet. Be the first to put money on the Line.
                </div>
              ) : (
                circleBonds.map((b) => (
                  <BondCard
                    key={b.id.toString()}
                    b={b}
                    circle={circle}
                    now={now}
                    onResolved={refreshAll}
                    creatorName={names[b.creator.toLowerCase()]}
                  />
                ))
              )}
              <ActivityTimeline circle={circle} bonds={circleBonds} names={names} snapshotEvents={snapshot.data?.activity} />
            </div>

            {/* right rail: create + spend */}
            <div className="flex flex-col gap-6">
              {isMember ? (
                <OpenBond circle={circle} onCreated={refreshAll} />
              ) : (
                <div className="rounded-xl border border-line bg-panel p-5 text-xs text-faint">
                  You&apos;re not in this Circle, so you can watch but not stake.
                </div>
              )}
              <PayoutPanel circle={circle} onDone={refreshAll} />
              <PayoutList circle={circle} payouts={circlePayouts} onChange={refreshAll} />
              <CircleChat circle={circle} names={names} />
            </div>
          </div>
        </>
      ) : null}

      <Footer />
    </div>
  );
}

function CircleDetailSkeleton() {
  return (
    <div className="mt-4 animate-pulse" aria-label="Loading Circle">
      <section className="rounded-2xl border border-line bg-panel/80 p-5 sm:p-7">
        <div className="flex items-start justify-between gap-6"><div className="space-y-3"><div className="h-9 w-56 rounded bg-panel-hi" /><div className="h-3 w-24 rounded bg-panel-hi" /></div><div className="h-16 w-32 rounded bg-panel-hi" /></div>
        <div className="mt-7 h-4 w-48 rounded bg-panel-hi" /><div className="mt-3 flex gap-3"><div className="h-8 w-24 rounded bg-panel-hi" /><div className="h-8 w-24 rounded bg-panel-hi" /></div>
      </section>
      <div className="mt-8 grid gap-8 xl:grid-cols-[minmax(0,1fr)_360px]"><div className="space-y-4"><div className="h-6 w-40 rounded bg-panel-hi" /><div className="h-44 rounded-xl border border-line bg-panel" /><div className="h-44 rounded-xl border border-line bg-panel" /></div><div className="space-y-6"><div className="h-40 rounded-xl border border-line bg-panel" /><div className="h-40 rounded-xl border border-line bg-panel" /></div></div>
    </div>
  );
}
