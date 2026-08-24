"use client";

import { useState } from "react";
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
  const write = useBondlineWrite(onCreated);
  const [description, setDescription] = useState("");
  const [stake, setStake] = useState("");
  const [hours, setHours] = useState(72);

  const stakeNum = Number(stake);
  const canSubmit = description.trim().length > 0 && stakeNum > 0;
  const busy = write.isPending || write.isConfirming;

  async function submit() {
    if (!canSubmit) return;
    const deadline = BigInt(Math.floor(Date.now() / 1000) + hours * 3600);
    await write.openBond(circle.address, description.trim(), deadline, stake);
    setDescription("");
    setStake("");
  }

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-line bg-panel p-5">
      <span className="font-display text-sm font-semibold uppercase tracking-widest text-bone">
        Put money on the Line
      </span>

      <input
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Ship the landing page · Run the 10k · Send the invoices"
        className="rounded-md border border-line bg-bg px-3 py-2 text-sm text-bone outline-none focus:border-gold/50"
      />

      <div className="flex flex-col gap-2">
        <span className="text-xs uppercase tracking-widest text-faint">The Line</span>
        <div className="flex flex-wrap gap-2">
          {PRESETS.map((p) => (
            <button
              key={p.hours}
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

      <label className="flex flex-col gap-1.5">
        <span className="text-xs uppercase tracking-widest text-faint">Stake (CELO)</span>
        <input
          value={stake}
          onChange={(e) => setStake(e.target.value.replace(/[^0-9.]/g, ""))}
          inputMode="decimal"
          placeholder="0.5"
          className="tnum rounded-md border border-line bg-bg px-3 py-2 text-sm text-bone outline-none focus:border-gold/50"
        />
      </label>

      <button
        onClick={submit}
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
    </div>
  );
}
