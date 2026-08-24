"use client";

import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAccount } from "wagmi";
import type { Circle } from "@/lib/contracts";
import { shortAddr } from "@/lib/format";
import { getMessages, isSupabaseConfigured, sendMessage } from "@/lib/supabase";
import { useWalletSession } from "@/lib/useWalletSession";
import { ACTIVE_CHAIN_ID } from "@/lib/chain";

export function CircleChat({ circle, names }: { circle: Circle; names: Record<string, string> }) {
  const { address } = useAccount();
  const { isAuthenticated, isChecking, isSigningIn, error: sessionError, signIn } = useWalletSession();
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const isMember = !!address && circle.members.some((member) => member.toLowerCase() === address.toLowerCase());
  const queryClient = useQueryClient();
  const { data: messages = [], isLoading } = useQuery({
    queryKey: ["circle-messages", ACTIVE_CHAIN_ID, circle.address.toLowerCase()],
    queryFn: () => getMessages(circle.address),
    // Do not request or retain a Circle's discussion for a visitor who is not
    // a member. The locked state below deliberately contains no message data.
    enabled: isSupabaseConfigured && isMember && isAuthenticated,
    refetchInterval: isMember && isAuthenticated ? 5_000 : false,
  });

  useEffect(() => {
    if (!isMember) {
      queryClient.removeQueries({ queryKey: ["circle-messages", ACTIVE_CHAIN_ID, circle.address.toLowerCase()] });
      setBody("");
    }
  }, [circle.address, isMember, queryClient]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!address || !body.trim()) return;
    setSending(true); setError("");
    try {
      await sendMessage(circle.address, address, body);
      setBody("");
      await queryClient.invalidateQueries({ queryKey: ["circle-messages", ACTIVE_CHAIN_ID, circle.address.toLowerCase()] });
    }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Couldn’t send message."); }
    finally { setSending(false); }
  }

  return <section className="flex min-h-[360px] flex-col rounded-xl border border-line bg-panel">
    <div className="flex items-center justify-between border-b border-line px-4 py-3"><div><p className="font-display text-sm font-semibold text-bone">Circle chat</p><p className="text-[11px] text-faint">Keep the Line honest.</p></div><span className="tnum rounded-full border border-line px-2 py-0.5 text-[10px] text-faint">{circle.members.length} members</span></div>
    {!isSupabaseConfigured ? <div className="m-4 rounded-lg border border-dashed border-line p-4 text-xs leading-relaxed text-faint">Add Supabase env values to turn this into your Circle&apos;s group chat.</div> : !isMember ? <div className="m-4 flex flex-1 flex-col items-center justify-center rounded-lg border border-dashed border-line p-6 text-center"><span className="mb-2 text-lg text-gold">◌</span><p className="text-sm font-medium text-bone">Member discussion</p><p className="mt-1 max-w-xs text-xs leading-relaxed text-faint">The conversation is private to Circle members. Join the Circle to read and reply.</p></div> : !isAuthenticated ? <div className="m-4 flex flex-1 flex-col items-center justify-center rounded-lg border border-dashed border-line p-6 text-center"><p className="text-sm font-medium text-bone">Unlock private discussion</p><p className="mt-1 max-w-xs text-xs leading-relaxed text-faint">Sign once with your wallet so Bondline can verify your Circle membership. It costs no gas.</p><button type="button" onClick={() => void signIn()} disabled={isChecking || isSigningIn} className="mt-4 rounded-md bg-gold px-3 py-2 text-xs font-semibold text-ink disabled:opacity-50">{isChecking ? "Checking…" : isSigningIn ? "Waiting for signature…" : "Unlock chat"}</button>{sessionError && <p className="mt-2 text-xs text-forfeit">{sessionError}</p>}</div> : <>
      <div className="flex flex-1 flex-col-reverse gap-3 overflow-y-auto p-4">{isLoading ? <div className="space-y-4" aria-label="Loading private discussion"><div className="h-10 w-3/4 animate-pulse rounded bg-panel-hi" /><div className="h-10 w-2/3 animate-pulse rounded bg-panel-hi" /><div className="h-10 w-4/5 animate-pulse rounded bg-panel-hi" /></div> : messages.length === 0 ? <p className="m-auto text-center text-xs text-faint">No messages yet. Set the tone.</p> : messages.map((message) => <div key={message.id} className="flex gap-2"><div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-panel-hi text-[10px] text-gold">{(names[message.sender_address] || shortAddr(message.sender_address)).slice(0, 1).toUpperCase()}</div><div><p className="text-xs font-medium text-bone">{names[message.sender_address] || shortAddr(message.sender_address)} <span className="ml-1 font-normal text-faint">{new Date(message.created_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</span></p><p className="mt-0.5 text-sm leading-relaxed text-muted">{message.body}</p></div></div>)}</div>
      <form onSubmit={submit} className="border-t border-line p-3"><div className="flex gap-2"><input maxLength={500} value={body} onChange={(event) => setBody(event.target.value)} placeholder="Reply to the Circle…" className="min-w-0 flex-1 rounded-md border border-line bg-bg px-3 py-2 text-sm text-bone outline-none focus:border-gold/50" /><button disabled={sending || !body.trim()} className="rounded-md bg-gold px-3 text-sm font-semibold text-ink disabled:opacity-40">{sending ? "…" : "Send"}</button></div>{error && <p className="mt-2 text-xs text-forfeit">{error}</p>}</form></>}
  </section>;
}
