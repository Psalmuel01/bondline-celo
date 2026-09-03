"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAccount } from "wagmi";
import type { Circle } from "@/lib/contracts";
import { shortAddr } from "@/lib/format";
import { getMessages, isSupabaseConfigured, sendMessage, type ProfileRow } from "@/lib/supabase";
import { useWalletSession } from "@/lib/useWalletSession";
import { ACTIVE_CHAIN_ID } from "@/lib/chain";
import { Avatar } from "./Avatar";

type Props = { circle: Circle; names: Record<string, string>; profiles: Record<string, ProfileRow> };

export function CircleChat({ circle, names, profiles }: Props) {
  const { address } = useAccount();
  const session = useWalletSession();
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState("");
  const [isOnline, setIsOnline] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const feedRef = useRef<HTMLDivElement>(null);
  const latestId = useRef<string | null>(null);
  const positioned = useRef(false);
  const isMember = !!address && circle.members.some((member) => member.toLowerCase() === address.toLowerCase());
  const queryClient = useQueryClient();
  const queryKey = ["circle-messages", ACTIVE_CHAIN_ID, circle.address.toLowerCase()] as const;
  const { data: messages = [], isLoading, isError, isFetching, refetch } = useQuery({
    queryKey,
    queryFn: () => getMessages(circle.address),
    enabled: isSupabaseConfigured && isMember && session.isAuthenticated,
    refetchInterval: isMember && session.isAuthenticated ? 5_000 : false,
  });
  const ordered = useMemo(() => [...messages].reverse(), [messages]);

  function nearNewest() {
    const feed = feedRef.current;
    // A hidden browser tab or the hidden desktop room on mobile should accrue
    // unread messages instead of silently considering itself caught up.
    return !!feed && !document.hidden && feed.offsetParent !== null && feed.scrollHeight - feed.scrollTop - feed.clientHeight < 96;
  }

  function goToNewest(behavior: ScrollBehavior = "smooth") {
    const feed = feedRef.current;
    if (feed) feed.scrollTo({ top: feed.scrollHeight, behavior });
    setUnread(0);
  }

  useEffect(() => {
    const update = () => setIsOnline(navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => { window.removeEventListener("online", update); window.removeEventListener("offline", update); };
  }, []);

  useEffect(() => {
    if (!isMember) {
      queryClient.removeQueries({ queryKey });
      setBody("");
      setUnread(0);
    }
  }, [circle.address, isMember, queryClient]);

  useEffect(() => {
    if (!mobileOpen) return;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") setMobileOpen(false); };
    window.addEventListener("keydown", escape);
    return () => { document.body.style.overflow = overflow; window.removeEventListener("keydown", escape); };
  }, [mobileOpen]);

  useEffect(() => {
    const newest = messages[0];
    if (!newest) return;
    const previousLatest = latestId.current;
    const changed = previousLatest !== null && previousLatest !== newest.id;
    const addedCount = previousLatest ? Math.max(1, messages.findIndex((message) => message.id === previousLatest)) : 0;
    const mine = newest.sender_address.toLowerCase() === address?.toLowerCase();
    const follow = !positioned.current || nearNewest() || mine;
    latestId.current = newest.id;
    requestAnimationFrame(() => {
      if (follow) goToNewest(positioned.current ? "smooth" : "auto");
      else if (changed) setUnread((count) => count + addedCount);
      positioned.current = true;
    });
  }, [address, messages]);

  useEffect(() => {
    if (mobileOpen) requestAnimationFrame(() => goToNewest("auto"));
  }, [mobileOpen]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!address || !body.trim() || !isOnline) return;
    setSending(true);
    setSendError("");
    try {
      await sendMessage(circle.address, address, body);
      setBody("");
      await queryClient.invalidateQueries({ queryKey });
    } catch (cause) {
      setSendError(cause instanceof Error ? cause.message : "Couldn’t send message.");
    } finally { setSending(false); }
  }

  const room = (
    <section className={`relative flex min-h-0 flex-col overflow-hidden border border-line bg-panel shadow-[0_24px_80px_rgba(0,0,0,0.22)] ${mobileOpen ? "fixed inset-0 z-50 h-dvh rounded-none sm:hidden" : "h-[min(600px,72vh)] min-h-[500px] rounded-2xl"}`}>
      <ChatHeader circle={circle} names={names} profiles={profiles} isOnline={isOnline} mobileOpen={mobileOpen} onClose={() => setMobileOpen(false)} />
      {!isOnline && <div className="flex items-center justify-between border-b border-forfeit/30 bg-forfeit/10 px-4 py-2 text-xs text-forfeit"><span>You’re offline. Messages will refresh when you reconnect.</span><button type="button" onClick={() => void refetch()} className="ml-3 font-semibold underline">Retry</button></div>}
      {!isSupabaseConfigured ? <ChatGate title="Chat isn’t configured" body="Add the Supabase environment values to enable this Circle’s private room." /> : !isMember ? <ChatGate title="Member discussion" body="This conversation is private to on-chain Circle members." /> : !session.isAuthenticated ? <div className="flex flex-1 flex-col items-center justify-center px-6 text-center"><span className="mb-4 flex h-12 w-12 items-center justify-center rounded-full border border-gold/30 bg-gold/10 text-xl text-gold">◌</span><p className="font-display text-lg font-semibold text-bone">Unlock private discussion</p><p className="mt-2 max-w-sm text-sm leading-relaxed text-faint">Sign a gasless message so Bondline can verify this wallet against the Circle contract.</p><button type="button" onClick={() => void session.signIn()} disabled={session.isChecking || session.isSigningIn} className="mt-5 rounded-lg bg-gold px-5 py-2.5 text-sm font-semibold text-ink disabled:opacity-50">{session.isChecking ? "Checking…" : session.isSigningIn ? "Waiting for signature…" : "Unlock chat"}</button>{session.error && <p className="mt-3 text-xs text-forfeit">{session.error}</p>}</div> : <>
        <div ref={feedRef} onScroll={() => { if (nearNewest()) setUnread(0); }} className="flex flex-1 flex-col gap-4 overflow-y-auto bg-[radial-gradient(circle_at_50%_0%,rgba(217,164,65,0.035),transparent_42%)] px-4 py-6 sm:px-8">
          {isLoading ? <ChatLoading /> : isError ? <div className="m-auto text-center"><p className="font-display text-lg font-semibold text-bone">Messages couldn’t load.</p><p className="mt-1 text-sm text-faint">Check your connection, then try again.</p><button type="button" onClick={() => void refetch()} className="mt-4 rounded-lg border border-gold/40 px-4 py-2 text-sm font-semibold text-gold">Try again</button></div> : messages.length === 0 ? <div className="m-auto text-center"><p className="font-display text-lg font-semibold text-bone">The room is quiet.</p><p className="mt-1 text-sm text-faint">Start the conversation and set the tone.</p></div> : ordered.map((message, index) => {
            const mine = message.sender_address.toLowerCase() === address?.toLowerCase();
            const key = message.sender_address.toLowerCase();
            const sender = names[key] || shortAddr(message.sender_address);
            const profile = profiles[key];
            const date = new Date(message.created_at);
            const prior = ordered[index - 1];
            const showDate = !prior || new Date(prior.created_at).toDateString() !== date.toDateString();
            return <div key={message.id}>{showDate && <DateSeparator date={date} />}<div className={`flex max-w-[92%] items-end gap-2.5 sm:max-w-[72%] ${mine ? "ml-auto flex-row-reverse" : "mr-auto"}`}><Avatar addr={message.sender_address as `0x${string}`} size={36} title={sender} imageUrl={profile?.avatar_url} color={profile?.avatar_color} you={mine} /><div><div className={`mb-1 flex items-baseline gap-2 ${mine ? "justify-end" : ""}`}><span className="text-xs font-medium text-bone">{mine ? "You" : sender}</span><time dateTime={message.created_at} className="tnum text-[10px] text-faint">{date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</time></div><p className={`whitespace-pre-wrap break-words rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${mine ? "rounded-br-sm bg-gold text-ink" : "rounded-bl-sm border border-line bg-panel-hi text-bone"}`}>{message.body}</p></div></div></div>;
          })}
        </div>
        {unread > 0 && <button type="button" onClick={() => goToNewest()} className="absolute bottom-24 left-1/2 z-10 -translate-x-1/2 rounded-full border border-gold/40 bg-bg px-4 py-2 text-xs font-semibold text-gold shadow-xl">{unread} new {unread === 1 ? "message" : "messages"} ↓</button>}
        <form onSubmit={submit} className="sticky bottom-0 border-t border-line bg-panel p-3 sm:p-4"><div className="mx-auto flex max-w-4xl items-end gap-2"><textarea rows={1} maxLength={500} value={body} onChange={(event) => setBody(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); event.currentTarget.form?.requestSubmit(); } }} placeholder={isOnline ? "Message the Circle…" : "Reconnect to send a message"} disabled={!isOnline} className="max-h-32 min-h-11 min-w-0 flex-1 resize-none rounded-xl border border-line bg-bg px-4 py-3 text-sm text-bone outline-none focus:border-gold/50 disabled:opacity-60" /><button disabled={sending || !body.trim() || !isOnline} className="h-11 rounded-xl bg-gold px-5 text-sm font-semibold text-ink disabled:opacity-40">{sending ? "Sending…" : "Send"}</button></div><div className="mx-auto mt-2 flex max-w-4xl justify-between"><p className="text-[10px] text-faint">Enter to send · Shift + Enter for a new line</p><p className="tnum text-[10px] text-faint">{body.length}/500</p></div>{sendError && <p className="mx-auto mt-2 max-w-4xl text-xs text-forfeit">{sendError}</p>}</form>
      </>}
      {isFetching && !isLoading && <span className="pointer-events-none absolute right-4 top-[72px] text-[10px] text-faint">Refreshing…</span>}
    </section>
  );

  return <><div className="hidden sm:block">{room}</div><button type="button" onClick={() => setMobileOpen(true)} className="flex w-full items-center justify-between rounded-2xl border border-line bg-panel p-5 text-left shadow-[0_18px_50px_rgba(0,0,0,0.2)] sm:hidden"><span><span className="font-display text-lg font-semibold text-bone">Circle chat</span><span className="mt-1 block text-xs text-faint">Open the private member room</span></span><span className="flex items-center gap-2">{unread > 0 && <span className="tnum rounded-full bg-gold px-2 py-1 text-[10px] font-bold text-ink">{unread}</span>}<span className="text-xl text-gold">→</span></span></button>{mobileOpen && room}</>;
}

function ChatHeader({ circle, names, profiles, isOnline, mobileOpen, onClose }: Props & { isOnline: boolean; mobileOpen: boolean; onClose: () => void }) {
  return <div className="flex items-center justify-between border-b border-line bg-panel-hi/35 px-4 py-3 sm:px-6 sm:py-4"><div><div className="flex items-center gap-2"><span className={`h-2 w-2 rounded-full ${isOnline ? "bg-confirm" : "bg-forfeit"}`} /><h2 className="font-display text-lg font-semibold text-bone">Circle chat</h2></div><p className="mt-1 hidden text-xs text-faint sm:block">Private to verified members · keep the Line honest.</p></div><div className="flex items-center gap-3"><div className="hidden -space-x-2 sm:flex">{circle.members.slice(0, 5).map((member) => { const profile = profiles[member.toLowerCase()]; return <div key={member} className="rounded-full ring-2 ring-panel"><Avatar addr={member} size={30} title={names[member.toLowerCase()] || shortAddr(member)} imageUrl={profile?.avatar_url} color={profile?.avatar_color} /></div>; })}</div><span className="tnum rounded-full border border-line bg-bg/40 px-2.5 py-1 text-[10px] text-faint">{circle.members.length} members</span>{mobileOpen && <button type="button" onClick={onClose} aria-label="Close chat" className="flex h-9 w-9 items-center justify-center rounded-full border border-line text-lg text-muted">×</button>}</div></div>;
}

function DateSeparator({ date }: { date: Date }) {
  const today = new Date();
  const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
  const label = date.toDateString() === today.toDateString() ? "Today" : date.toDateString() === yesterday.toDateString() ? "Yesterday" : date.toLocaleDateString([], { month: "short", day: "numeric", year: date.getFullYear() === today.getFullYear() ? undefined : "numeric" });
  return <div className="my-3 flex items-center gap-3" role="separator"><span className="h-px flex-1 bg-line" /><time className="text-[10px] uppercase tracking-widest text-faint">{label}</time><span className="h-px flex-1 bg-line" /></div>;
}

function ChatLoading() { return <div className="space-y-5" aria-label="Loading private discussion"><div className="h-16 w-3/5 animate-pulse rounded-2xl bg-panel-hi" /><div className="ml-auto h-14 w-2/5 animate-pulse rounded-2xl bg-gold/10" /><div className="h-20 w-1/2 animate-pulse rounded-2xl bg-panel-hi" /></div>; }

function ChatGate({ title, body }: { title: string; body: string }) { return <div className="m-5 flex flex-1 flex-col items-center justify-center rounded-xl border border-dashed border-line px-6 text-center"><span className="mb-3 text-2xl text-gold">◌</span><p className="font-display text-lg font-semibold text-bone">{title}</p><p className="mt-2 max-w-sm text-sm leading-relaxed text-faint">{body}</p></div>; }
