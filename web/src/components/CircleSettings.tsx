"use client";

import { useState } from "react";
import { useAccount } from "wagmi";
import type { Circle } from "@/lib/contracts";
import {
  deleteCircleImage,
  getCircleMetadata,
  isSupabaseConfigured,
  saveCircleMetadata,
  uploadCircleImage,
  type CircleMetadata,
} from "@/lib/supabase";
import { useWalletSession } from "@/lib/useWalletSession";

export function CircleSettings({ circle, metadata, onMetadata }: {
  circle: Circle;
  metadata?: CircleMetadata;
  onMetadata: (metadata: CircleMetadata | undefined) => void;
}) {
  const { address } = useAccount();
  const { isAuthenticated, isSigningIn, signIn } = useWalletSession();
  const [open, setOpen] = useState(false);
  const [mission, setMission] = useState("");
  const [potGoal, setPotGoal] = useState("");
  const [bannerUrl, setBannerUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const isMember = !!address && circle.members.some((member) => member.toLowerCase() === address.toLowerCase());

  if (!isSupabaseConfigured || !isMember) return null;

  function openSettings() {
    setMission(metadata?.mission || "");
    setPotGoal(metadata?.pot_goal || "");
    setBannerUrl(metadata?.banner_url || "");
    setError("");
    setOpen(true);
  }

  async function uploadBanner(file?: File) {
    if (!file) return;
    setUploading(true);
    setError("");
    try {
      if (!isAuthenticated) await signIn();
      setBannerUrl(await uploadCircleImage(file, "banner", circle.address));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Couldn’t upload this image.");
    } finally {
      setUploading(false);
    }
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (uploading) return;
    setSaving(true);
    setError("");
    try {
      if (!isAuthenticated) await signIn();
      const previousUrl = metadata?.banner_url ?? "";
      await saveCircleMetadata(circle.address, { mission, potGoal, bannerUrl });
      if (previousUrl && previousUrl !== bannerUrl) await deleteCircleImage(previousUrl);
      onMetadata(await getCircleMetadata(circle.address));
      setOpen(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Couldn’t save Circle details.");
    } finally {
      setSaving(false);
    }
  }

  return <>
    <button onClick={openSettings} className="rounded-md border border-line bg-bg/50 px-3 py-1.5 text-xs text-muted transition hover:border-gold/40 hover:text-gold">Customize Circle</button>
    {open && <div className="fixed inset-0 z-50 flex items-end justify-center bg-bg/65 p-4 backdrop-blur-sm sm:items-center" role="dialog" aria-modal="true" aria-label="Customize Circle">
      <form onSubmit={submit} className="w-full max-w-xl rounded-2xl border border-panel-hi bg-panel p-6 shadow-2xl shadow-black/30 sm:p-7">
        <div className="flex justify-between"><div><p className="tnum text-[10px] uppercase tracking-widest text-gold">Circle identity</p><h2 className="font-display mt-1 text-xl font-semibold text-bone">Give the Pot a reason.</h2></div><button type="button" onClick={() => setOpen(false)} className="text-muted hover:text-bone">×</button></div>
        <p className="mt-2 text-sm text-muted">Any Circle member can update this wallet-authenticated display metadata.</p>
        <label className="mt-5 flex flex-col gap-1.5"><span className="text-xs uppercase tracking-widest text-faint">Mission</span><input maxLength={120} value={mission} onChange={(event) => setMission(event.target.value)} placeholder="Cabo 2026, paid for by missed deadlines" className="rounded-md border border-line bg-bg px-3 py-2.5 text-sm text-bone outline-none focus:border-gold/50" /></label>
        <label className="mt-4 flex flex-col gap-1.5"><span className="text-xs uppercase tracking-widest text-faint">Pot goal <span className="normal-case tracking-normal">(CELO)</span></span><input inputMode="decimal" value={potGoal} onChange={(event) => setPotGoal(event.target.value.replace(/[^0-9.]/g, ""))} placeholder="300" className="tnum rounded-md border border-line bg-bg px-3 py-2.5 text-sm text-bone outline-none focus:border-gold/50" /></label>
        <label className="mt-4 flex flex-col gap-1.5"><span className="text-xs uppercase tracking-widest text-faint">Banner image <span className="normal-case tracking-normal">(optional, 5 MB max)</span></span><input type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={(event) => void uploadBanner(event.target.files?.[0])} className="block w-full cursor-pointer rounded-md border border-line bg-bg px-3 py-2 text-xs text-muted file:mr-3 file:rounded file:border-0 file:bg-panel-hi file:px-2.5 file:py-1.5 file:text-xs file:font-medium file:text-bone hover:file:bg-line" /></label>
        {bannerUrl && <div className="mt-2 flex items-center justify-between gap-3"><p className="text-xs text-confirm">Banner image ready to save.</p><button type="button" onClick={() => setBannerUrl("")} className="rounded-md border border-forfeit/30 px-2.5 py-1.5 text-xs text-forfeit transition hover:bg-forfeit/10">Remove current banner</button></div>}
        {error && <p className="mt-3 text-xs text-forfeit">{error}</p>}
        <button disabled={saving || uploading || isSigningIn} className="mt-6 w-full rounded-lg bg-gold px-4 py-2.5 text-sm font-semibold text-ink disabled:opacity-40">{isSigningIn ? "Waiting for signature…" : uploading ? "Uploading image…" : saving ? "Saving…" : "Save Circle details"}</button>
      </form>
    </div>}
  </>;
}
