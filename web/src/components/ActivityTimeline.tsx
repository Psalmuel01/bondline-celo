"use client";

import { useQuery } from "@tanstack/react-query";
import type { Bond, Circle } from "@/lib/contracts";
import { Status } from "@/lib/contracts";
import { ACTIVE_CHAIN_ID, explorerAddr, explorerTx } from "@/lib/chain";
import { formatMon, shortAddr } from "@/lib/format";
import { getActivity, isSupabaseConfigured, type Activity } from "@/lib/supabase";

function when(date: string | number) { return new Date(date).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }); }

export function ActivityTimeline({ circle, bonds, names, snapshotEvents = [] }: { circle: Circle; bonds: Bond[]; names: Record<string, string>; snapshotEvents?: Activity[] }) {
  const { data: recordedEvents = [] } = useQuery<Activity[]>({
    queryKey: ["circle-activity", ACTIVE_CHAIN_ID, circle.address.toLowerCase()],
    queryFn: () => getActivity(circle.address),
    enabled: isSupabaseConfigured,
  });
  const events = [...snapshotEvents, ...recordedEvents]
    // The optimistic app event and indexed contract event use different kind
    // labels, but share a transaction hash. Show that transaction only once.
    .filter((event, index, all) => all.findIndex((candidate) => event.tx_hash ? candidate.tx_hash === event.tx_hash : candidate.id === event.id) === index)
    .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
  const fallback = [...bonds].reverse().slice(0, 8).map((bond) => { const person = names[bond.creator.toLowerCase()] || shortAddr(bond.creator); const state = bond.status === Status.Met ? "cleared their Bond" : bond.status === Status.Crossed ? "crossed the Line" : bond.status === Status.PendingCosign ? "opened the cosign" : "put CELO on the Line"; const timestamp = bond.status === Status.PendingCosign ? Number(bond.cosignClosesAt - 86_400n) * 1000 : Number(bond.deadline) * 1000; return { id: bond.id.toString(), person, address: bond.creator, body: `${state} · ${formatMon(bond.stake)} CELO`, timestamp }; });
  return <section className="rounded-xl border border-line bg-panel"><div className="flex items-center justify-between border-b border-line px-5 py-4"><div><h2 className="font-display text-base font-semibold text-bone">Circle activity</h2><p className="mt-0.5 text-xs text-faint">On-chain state plus app-recorded moments.</p></div><span className="tnum text-[10px] uppercase tracking-widest text-faint">Timeline</span></div><div className="divide-y divide-line">{events.length > 0 ? events.map((event) => <div key={event.id} className="flex gap-3 px-5 py-4"><span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-gold" /><div className="min-w-0 flex-1"><p className="text-sm text-bone">{event.body}</p><p className="mt-1 text-xs text-faint">{when(event.created_at)}{event.actor_address && <> · <a className="hover:text-gold" href={explorerAddr(event.actor_address)} target="_blank" rel="noreferrer">{names[event.actor_address.toLowerCase()] || shortAddr(event.actor_address)}</a></>}{event.tx_hash && <> · <a className="text-gold hover:underline" href={explorerTx(event.tx_hash)} target="_blank" rel="noreferrer">transaction ↗</a></>}</p></div></div>) : fallback.length > 0 ? fallback.map((event) => <div key={event.id} className="flex gap-3 px-5 py-4"><span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-gold" /><div className="min-w-0 flex-1"><p className="text-sm text-bone">{event.person} {event.body}</p><p className="mt-1 text-xs text-faint">deadline / cosign window · {when(event.timestamp)} · <a className="text-gold hover:underline" href={explorerAddr(event.address)} target="_blank" rel="noreferrer">wallet ↗</a></p></div></div>) : <p className="px-5 py-9 text-center text-sm text-faint">Moments from this Circle will appear here.</p>}</div></section>;
}
