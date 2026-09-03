"use client";

import { useEffect, useState } from "react";
import { useBondlineWrite } from "@/lib/useBondlineWrite";
import { explorerTx } from "@/lib/chain";
import type { Circle } from "@/lib/contracts";

const PRESETS = [
  { label: "1 day", hours: 24 },
  { label: "3 days", hours: 72 },
  { label: "1 week", hours: 168 },
  { label: "2 weeks", hours: 336 },
];

/// Stake CELO against a personal deadline inside a Circle. The stake is escrowed by
/// the Core; hit the deadline and get it back on a group vote, miss and it
/// funds the Circle's Pot.
export function OpenBond({
  circle,
  onCreated,
}: {
  circle: Circle;
  onCreated: () => void;
}) {
  const [open, setOpen] = useState(false);
  const write = useBondlineWrite(() => {
    onCreated();
    setOpen(false);
  });
  const [description, setDescription] = useState("");
  const [stake, setStake] = useState("");
  const [hours, setHours] = useState(72);

  const stakeNum = Number(stake);
  const canSubmit = description.trim().length > 0 && stakeNum > 0;
  const busy = write.isPending || write.isConfirming;

  useEffect(() => {
    if (!open) return;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busy) setOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = overflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [busy, open]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!canSubmit) return;
    const deadline = BigInt(Math.floor(Date.now() / 1000) + hours * 3600);
    await write.openBond(circle.address, description.trim(), deadline, stake);
    setDescription("");
    setStake("");
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-lg bg-gold px-4 py-2.5 text-sm font-semibold text-ink transition hover:brightness-108"
      >
        + New Bond
      </button>

      {open && <div className="fixed inset-0 z-50 flex items-end justify-center bg-bg/70 backdrop-blur-sm sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-labelledby="new-bond-title" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) setOpen(false); }}>
        <form onSubmit={submit} className="flex h-dvh w-full flex-col overflow-y-auto border-panel-hi bg-panel p-5 shadow-2xl shadow-black/40 sm:h-auto sm:max-w-lg sm:rounded-2xl sm:border sm:p-7">
          <div className="flex items-start justify-between gap-5">
            <div><p className="tnum text-[10px] uppercase tracking-[0.2em] text-gold">New commitment</p><h2 id="new-bond-title" className="font-display mt-1 text-2xl font-semibold text-bone">Put money on the Line</h2><p className="mt-2 text-sm leading-relaxed text-muted">Set the promise, deadline, and CELO you’re willing to stake on completing it.</p></div>
            <button type="button" onClick={() => setOpen(false)} disabled={busy} aria-label="Close new Bond" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-line text-lg text-muted hover:text-bone disabled:opacity-40">×</button>
          </div>

      <label className="mt-7 flex flex-col gap-1.5"><span className="text-xs uppercase tracking-widest text-faint">Your commitment</span><input
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Ship the landing page · Run the 10k · Send the invoices"
        autoFocus
        maxLength={160}
        className="rounded-md border border-line bg-bg px-3 py-2.5 text-sm text-bone outline-none focus:border-gold/50"
      /></label>

      <div className="mt-5 flex flex-col gap-2">
        <span className="text-xs uppercase tracking-widest text-faint">The Line</span>
        <div className="flex flex-wrap gap-2">
          {PRESETS.map((p) => (
            <button
              key={p.hours}
              type="button"
              onClick={() => setHours(p.hours)}
              className={`rounded-md border px-3 py-1.5 text-xs transition ${
                hours === p.hours
                  ? "border-gold/50 bg-gold/10 text-gold"
                  : "border-line text-muted hover:text-bone"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <label className="mt-5 flex flex-col gap-1.5">
        <span className="text-xs uppercase tracking-widest text-faint">Stake (CELO)</span>
        <input
          value={stake}
          onChange={(e) => setStake(e.target.value.replace(/[^0-9.]/g, ""))}
          inputMode="decimal"
          placeholder="0.5"
          className="tnum rounded-md border border-line bg-bg px-3 py-2 text-sm text-bone outline-none focus:border-gold/50"
        />
      </label>

      <div className="mt-auto pt-8 sm:mt-0 sm:pt-7">
      <button
        type="submit"
        disabled={!canSubmit || busy}
        className="w-full rounded-lg bg-gold px-3 py-2.5 text-sm font-semibold text-ink transition hover:brightness-108 disabled:opacity-40"
      >
        {busy ? "Staking on-chain…" : "Stake the Bond"}
      </button>

      {write.error && <p className="text-xs text-forfeit">{write.error}</p>}
      {write.hash && (
        <a
          href={explorerTx(write.hash)}
          target="_blank"
          rel="noreferrer"
          className="tnum text-xs text-gold underline decoration-dotted underline-offset-2"
        >
          {write.isConfirming ? "stake pending ↗" : "staked ↗"}
        </a>
      )}
      <p className="mt-3 text-center text-[10px] leading-relaxed text-faint">Your wallet will ask you to confirm the CELO stake. The funds remain governed by the Bond contract.</p>
      </div>
        </form>
      </div>}
    </>
  );
}
