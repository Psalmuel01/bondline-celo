"use client";

import { useState } from "react";
import { useAccount } from "wagmi";
import { keccak256, toBytes } from "viem";
import { type Bond, type Circle, Status } from "@/lib/contracts";
import { countdownParts, formatMon, shortAddr } from "@/lib/format";
import { explorerAddr, explorerTx } from "@/lib/chain";
import { useBondlineWrite } from "@/lib/useBondlineWrite";
import { CosignPanel } from "./CosignPanel";
import { ReceiptPreview } from "./ReceiptPreview";

const STATUS_META: Record<Status, { label: string; cls: string; dot: string }> = {
  [Status.Active]: { label: "ON THE LINE", cls: "text-gold border-gold/40 bg-gold/10", dot: "bg-gold" },
  [Status.PendingCosign]: {
    label: "COSIGNING",
    cls: "text-gold border-gold/40 bg-gold/10",
    dot: "bg-gold",
  },
  [Status.Met]: { label: "BEAT THE LINE", cls: "text-confirm border-confirm/40 bg-confirm/10", dot: "bg-confirm" },
  [Status.Crossed]: { label: "CROSSED THE LINE", cls: "text-forfeit border-forfeit/40 bg-forfeit/10", dot: "bg-forfeit" },
};

export function BondCard({
  b,
  circle,
  now,
  onResolved,
  creatorName,
}: {
  b: Bond;
  circle: Circle;
  now: number;
  onResolved: () => void;
  creatorName?: string;
}) {
  const { address } = useAccount();
  const write = useBondlineWrite(onResolved);
  const [declaring, setDeclaring] = useState(false);
  const [evidenceUri, setEvidenceUri] = useState("");

  const meta = STATUS_META[b.status];
  const cd = countdownParts(b.deadline, now);
  const voteCd = countdownParts(b.cosignClosesAt, now);
  const isCreator = address?.toLowerCase() === b.creator.toLowerCase();

  const active = b.status === Status.Active;
  const pending = b.status === Status.PendingCosign;
  const expired = active && cd.expired;

  const canDeclare = active && !cd.expired && isCreator;
  const canResolveExpired = pending && voteCd.expired;

  const busy = write.isPending || write.isConfirming;
  const receipt = evidenceUri.trim();
  const canOpenCosign = receipt.length > 0;

  async function submitDeclare() {
    if (!canOpenCosign) return;
    const hash = keccak256(toBytes(receipt));
    await write.declareDone(b.id, hash, receipt);
    setDeclaring(false);
  }

  return (
    <div
      className={`group relative flex flex-col gap-4 rounded-xl border bg-panel p-5 transition ${
        expired ? "border-gone/40" : pending ? "border-live/40" : "border-line hover:border-panel-hi"
      }`}
    >
      <div className="flex items-center justify-between">
        <span
          className={`tnum inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold tracking-wider ${meta.cls}`}
        >
          <span className={`h-1.5 w-1.5 rounded-full ${meta.dot} ${active || pending ? "pulse" : ""}`} />
          {expired ? "LINE CROSSED" : meta.label}
        </span>
          <span className="tnum text-xs text-faint">#{b.id.toString().padStart(3, "0")}</span>
      </div>

      <p className="text-[15px] leading-snug text-bone">{b.description}</p>

      <div className="flex items-end justify-between">
        <div>
          <div className="text-[10px] uppercase tracking-widest text-faint">
            {pending ? "Cosign closes in" : active ? (expired ? "Overdue" : "Left on the Line") : "Resolved"}
          </div>
          <div
            className={`tnum text-2xl font-semibold ${
              b.status === Status.Met
                ? "text-confirm"
                : b.status === Status.Crossed || expired
                  ? "text-forfeit"
                  : "text-gold"
            }`}
          >
            {pending ? voteCd.text : active ? cd.text : meta.label}
          </div>
        </div>
        <div className="text-right">
          <div className="text-[10px] uppercase tracking-widest text-faint">
            {b.status === Status.Met
              ? "Refunded"
              : b.status === Status.Crossed
                ? "Into the Pot"
                : "Staked"}
          </div>
          <div className="tnum text-2xl font-semibold text-gold">
            {formatMon(b.stake)}
            <span className="ml-1 text-sm text-muted">CELO</span>
          </div>
        </div>
      </div>

      <div className="tnum flex items-center justify-between border-t border-line pt-3 text-xs text-muted">
        <span>
          <span className="text-faint">by </span>
          <a href={explorerAddr(b.creator)} target="_blank" rel="noreferrer" className="hover:text-bone">
            {creatorName || shortAddr(b.creator)}
          </a>
          {isCreator && <span className="text-faint"> (you)</span>}
        </span>
        {b.status === Status.Crossed && <span className="text-forfeit">fed the Pot</span>}
        {b.status === Status.Met && <span className="text-confirm">shipped in time</span>}
      </div>

      {/* live voting */}
      {pending && !voteCd.expired && <CosignPanel b={b} circle={circle} onResolved={onResolved} />}

      {b.receiptsUri && <ReceiptPreview uri={b.receiptsUri} />}

      {/* creator: declare complete */}
      {canDeclare && !declaring && (
        <button
          onClick={() => setDeclaring(true)}
          className="w-full rounded-lg bg-gold px-3 py-2 text-sm font-semibold text-ink transition hover:brightness-108"
        >
          I shipped it → drop your Receipts
        </button>
      )}
      {canDeclare && declaring && (
        <div className="flex flex-col gap-2 rounded-lg border border-line bg-bg p-3">
          <span className="text-xs uppercase tracking-widest text-faint">Receipt required</span>
          <input
            value={evidenceUri}
            onChange={(e) => setEvidenceUri(e.target.value)}
            placeholder="https://… (PR, demo, screenshot)"
            className="rounded-md border border-line bg-panel px-3 py-2 text-sm text-bone outline-none focus:border-gold/50"
          />
          <span className="text-xs text-faint">
            Add a link before opening the cosign. It is hashed on-chain so it can&apos;t be swapped after the fact.
          </span>
          <div className="flex gap-2">
            <button
              onClick={submitDeclare}
              disabled={busy || !canOpenCosign}
              className="flex-1 rounded-lg bg-gold px-3 py-2 text-sm font-semibold text-ink transition hover:brightness-108 disabled:opacity-50"
            >
              {busy ? "Confirming…" : "Open the cosign"}
            </button>
            <button
              onClick={() => setDeclaring(false)}
              className="rounded-md border border-line px-3 py-2 text-sm text-muted transition hover:text-bone"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* anyone: resolve a lapsed cosign window */}
      {canResolveExpired && (
        <button
          onClick={() => write.resolveExpired(b.id)}
          disabled={busy}
          className="w-full rounded-md border border-line bg-panel px-3 py-2 text-sm font-medium text-bone transition hover:border-panel-hi disabled:opacity-50"
        >
          {busy ? "Confirming…" : "Cosign window closed → resolve"}
        </button>
      )}

      {/* creator crossed the Line without ever declaring — anyone can push
          the stake into the Pot. */}
      {expired && (
        <div className="flex flex-col gap-2">
          <p className="text-xs text-forfeit">
            The Line passed with no Receipts. This stake drops into the Pot.
          </p>
          <button
            onClick={() => write.crossMissed(b.id)}
            disabled={busy}
            className="w-full rounded-md border border-forfeit/50 bg-forfeit/10 px-3 py-2 text-sm font-medium text-forfeit transition hover:bg-forfeit/20 disabled:opacity-50"
          >
            {busy ? "Confirming…" : "Send the stake to the Pot"}
          </button>
        </div>
      )}

      {write.error && <p className="text-xs text-gone">{write.error}</p>}
      {write.hash && (
        <a
          href={explorerTx(write.hash)}
          target="_blank"
          rel="noreferrer"
          className="tnum text-xs text-live underline decoration-dotted underline-offset-2"
        >
          {write.isConfirming ? "tx pending — view on explorer ↗" : "tx confirmed — view on explorer ↗"}
        </a>
      )}
    </div>
  );
}
