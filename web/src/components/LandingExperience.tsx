"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { isConfigured, Status } from "@/lib/contracts";
import { formatMon, shortAddr } from "@/lib/format";
import type { Bond } from "@/lib/contracts";
import { useBonds, useCircles } from "@/lib/hooks";
import { useProfiles } from "@/lib/useProfiles";

function ChatDrama() {
  return (
    <div className="relative isolate min-h-[270px] overflow-hidden rounded-2xl border border-line bg-panel p-5 shadow-2xl shadow-black/20 sm:min-h-[310px]">
      <div className="mb-5 flex items-center gap-2 border-b border-line pb-3">
        <span className="h-2 w-2 rounded-full bg-confirm" />
        <span className="tnum text-[10px] uppercase tracking-[0.18em] text-faint">the group chat</span>
      </div>
      <div className="flex flex-col items-start gap-3 text-sm">
        <p className="chat-bubble chat-one rounded-2xl rounded-tl-sm bg-panel-hi px-3.5 py-2.5 text-bone">
          finally shipping my project this week
        </p>
        <p className="chat-bubble chat-two self-end rounded-2xl rounded-tr-sm bg-gold/15 px-3.5 py-2.5 text-gold">
          let&apos;s gooo
        </p>
        <p className="chat-bubble chat-three rounded-2xl rounded-tl-sm bg-panel-hi px-3.5 py-2.5 text-bone">
          same, i&apos;m locked in
        </p>
        <p className="chat-bubble chat-four mt-2 rounded-2xl rounded-tl-sm border border-forfeit/25 bg-forfeit/10 px-3.5 py-2.5 text-bone">
          so about that project...
        </p>
      </div>
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-panel via-panel/80 to-transparent" />
    </div>
  );
}

function CosignDemo() {
  const [cosigned, setCosigned] = useState(false);

  return (
    <section className="relative overflow-hidden rounded-2xl border border-gold/30 bg-gradient-to-br from-gold/10 via-panel to-panel p-5 sm:p-7">
      <div className="absolute -right-14 -top-14 h-40 w-40 rounded-full bg-gold/10 blur-3xl" />
      <div className="relative grid gap-6 lg:grid-cols-[1fr_auto] lg:items-center">
        <div>
          <p className="tnum text-[10px] font-semibold uppercase tracking-[0.18em] text-gold">Try the mechanic</p>
          <h2 className="font-display mt-2 text-2xl font-semibold tracking-tight text-bone">Cosign Sam&apos;s Bond.</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted">Sam staked <span className="tnum text-bone">50 CELO</span> to ship by Friday. The crew decides if it counts.</p>
        </div>
        <div className="flex flex-col gap-4 rounded-xl border border-line bg-bg/60 p-4 sm:min-w-[320px]">
          <div className="flex items-center justify-between">
            <div className="flex -space-x-2">
              {[
                ["P", "bg-[#514332] text-gold", "Priya"],
                ["D", "bg-[#332e48] text-[#c0b0ff]", "Dele"],
                ["Y", cosigned ? "bg-confirm text-ink cosign-in" : "bg-panel-hi text-muted", "You"],
              ].map(([initials, color, name]) => (
                <div key={name} title={name} className={`flex h-10 w-10 items-center justify-center rounded-full border-2 border-bg text-xs font-semibold ${color}`}>
                  {initials}
                </div>
              ))}
            </div>
            <span className={`tnum text-xs ${cosigned ? "text-confirm" : "text-muted"}`}>
              {cosigned ? "2/3 cosigns" : "1/3 cosigns"}
            </span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-line">
            <div className={`h-full bg-confirm transition-all duration-500 ${cosigned ? "w-2/3" : "w-1/3"}`} />
          </div>
          <button onClick={() => setCosigned(true)} disabled={cosigned} className="rounded-lg border border-confirm/50 bg-confirm/10 px-4 py-2.5 text-sm font-semibold text-confirm transition hover:bg-confirm/20 disabled:cursor-default disabled:border-confirm/20 disabled:bg-transparent">
            {cosigned ? "Cosigned — 1 more to clear" : "Cosign Sam's Bond"}
          </button>
        </div>
      </div>
    </section>
  );
}

function GlobalTicker() {
  const { circles, refresh: refreshCircles } = useCircles();
  const { bonds, refresh: refreshBonds } = useBonds();
  const { names } = useProfiles(bonds.map((bond) => bond.creator));
  const staked = bonds.reduce((total, bond) =>
    bond.status === Status.Active || bond.status === Status.PendingCosign ? total + bond.stake : total, 0n);
  const pots = circles.reduce((total, circle) => total + circle.balance, 0n);

  useEffect(() => {
    if (!isConfigured) return;
    const poll = window.setInterval(() => {
      refreshCircles();
      refreshBonds();
    }, 10_000);
    return () => window.clearInterval(poll);
  }, [refreshBonds, refreshCircles]);

  return (
    <section className="border-y border-line py-4">
      <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-center text-xs text-muted sm:text-sm">
        <span className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-gold pulse" /><span className="tnum text-bone">{formatMon(staked)} CELO</span> staked across <span className="tnum text-bone">{circles.length}</span> Circles</span>
        <span className="hidden text-faint sm:inline">·</span>
        <span><span className="tnum text-bone">{formatMon(pots)} CELO</span> sitting in Circle Pots</span>
      </div>
      <div className="mt-4"><ActivityFeed bonds={bonds} names={names} /></div>
    </section>
  );
}

function ActivityFeed({ bonds, names }: { bonds: Bond[]; names: Record<string, string> }) {
  const items = [...bonds].reverse().slice(0, 3).map((bond) => {
    const person = names[bond.creator.toLowerCase()] || shortAddr(bond.creator);
    if (bond.status === Status.Met) return { text: `${person} cleared a Bond`, note: `${formatMon(bond.stake)} CELO refunded`, tone: "text-confirm" };
    if (bond.status === Status.Crossed) return { text: `${person} crossed the Line`, note: `${formatMon(bond.stake)} CELO into the Pot`, tone: "text-forfeit" };
    if (bond.status === Status.PendingCosign) return { text: `${person} asked the Circle`, note: "Bond is cosigning now", tone: "text-gold" };
    return { text: `${person} opened a Bond`, note: `${formatMon(bond.stake)} CELO on the Line`, tone: "text-gold" };
  });
  return (
    <section className="overflow-hidden rounded-xl border border-line bg-panel">
      <div className="flex items-center gap-2 border-b border-line px-4 py-3">
        <span className="h-1.5 w-1.5 rounded-full bg-confirm pulse" />
        <p className="tnum text-[10px] font-semibold uppercase tracking-[0.18em] text-faint">Circle activity</p>
      </div>
      <div className="grid divide-y divide-line sm:grid-cols-3 sm:divide-x sm:divide-y-0">
        {items.length === 0 ? <div className="px-4 py-4 text-xs text-faint sm:col-span-3">The first Bond opened by a Circle will show up here.</div> : items.map((item) => (
          <div key={`${item.text}-${item.note}`} className="flex items-center gap-3 px-4 py-3.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-panel-hi text-xs font-semibold text-gold">↗</div>
            <p className="text-xs leading-relaxed text-muted"><span className="text-bone">{item.text}</span><br /><span className={item.tone}>{item.note}</span></p>
          </div>
        ))}
      </div>
    </section>
  );
}

export function LandingExperience() {
  return (
    <>
      <section className="grid items-center gap-10 py-14 sm:py-20 lg:grid-cols-[1.08fr_0.92fr]">
        <div>
          <span className="tnum inline-flex items-center gap-2 rounded-full border border-line px-3 py-1 text-[11px] tracking-wide text-muted"><span className="h-1.5 w-1.5 rounded-full bg-gold pulse" />CELOEY ON THE LINE · YOUR CREW DECIDES</span>
          <h1 className="font-display mt-6 max-w-3xl text-4xl font-semibold leading-[1.05] tracking-tight sm:text-6xl">Ship together,<br /><span className="text-gold">or fund the group chat.</span></h1>
          <p className="mt-6 max-w-xl text-[15px] leading-relaxed text-muted sm:text-base">Start a Circle with your friends. Stake CELO on your deadline. Your crew cosigns whether you actually shipped. Beat the Line → your money back. Cross it → your money buys the group dinner.</p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <a href="#circles" className="rounded-lg bg-gold px-5 py-2.5 text-sm font-semibold text-ink transition hover:brightness-108">Start a Circle</a>
            <Link href="/docs" className="rounded-lg border border-line px-5 py-2.5 text-sm font-medium text-bone transition hover:border-panel-hi">How it works</Link>
          </div>
        </div>
        <ChatDrama />
      </section>

      <CosignDemo />
      <div className="mt-10"><GlobalTicker /></div>

      <section className="grid gap-4 py-14 sm:grid-cols-3">
        {[
          ["01", "Make a Circle", "Pick your crew and agree on the cosign bar."],
          ["02", "Put CELO on the Line", "Stake against a deadline that actually matters."],
          ["03", "Let the crew decide", "Cosigns refund you. Misses build the Pot."],
        ].map(([number, title, copy]) => (
          <div key={number} className="rounded-xl border border-line bg-panel p-5"><span className="tnum text-xs text-gold">{number}</span><h2 className="font-display mt-5 text-lg font-semibold text-bone">{title}</h2><p className="mt-2 text-sm leading-relaxed text-muted">{copy}</p></div>
        ))}
      </section>
    </>
  );
}
