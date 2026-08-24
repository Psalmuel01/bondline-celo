import { ACTIVE_CHAIN_ID } from "./chain";

// Tiny Supabase REST client. Keeping this dependency-free makes the optional
// social layer easy to turn on: set the two public values in .env.local.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(url && key);
const CIRCLE_MEDIA_BUCKET = "circle-media";
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

export type ProfileRow = { address: string; display_name: string; avatar_url: string | null; avatar_color: string; updated_at: string };
export type ChatMessage = { id: string; chain_id: number; circle_address: string; sender_address: string; body: string; created_at: string };
export type CircleMetadata = { chain_id: number; circle_address: string; mission: string | null; pot_goal: string | null; banner_url: string | null; updated_at: string };
export type Activity = { id: string; chain_id: number; circle_address: string; actor_address: string | null; kind: string; body: string; tx_hash: string | null; created_at: string };

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  if (!url || !key) throw new Error("Supabase is not configured.");
  const response = await fetch(`${url}/rest/v1/${path}`, {
    ...init,
    headers: { apikey: key, "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  if (!response.ok) throw new Error("Couldn’t reach the Circle social layer.");
  return response.json() as Promise<T>;
}

/** Uploads display media through the wallet-authenticated server boundary. */
export async function uploadCircleImage(file: File, kind: "avatar" | "banner", owner: string) {
  if (!IMAGE_TYPES.has(file.type)) throw new Error("Choose a JPEG, PNG, WebP, or GIF image.");
  if (file.size > MAX_IMAGE_BYTES) throw new Error("Images must be 5 MB or smaller.");
  const form = new FormData();
  form.set("file", file);
  form.set("kind", kind);
  form.set("owner", owner);
  const response = await fetch("/api/media", {
    method: "POST",
    credentials: "same-origin",
    body: form,
  });
  const value = await response.json().catch(() => ({})) as { url?: string; error?: string };
  if (!response.ok || !value.url) throw new Error(value.error ?? "Couldn’t upload this image.");
  return value.url;
}

/** Removes a previously saved Circle-media object. External image URLs are left alone. */
export async function deleteCircleImage(mediaUrl: string) {
  const prefix = url ? `${url}/storage/v1/object/public/${CIRCLE_MEDIA_BUCKET}/` : "";
  if (!prefix || !mediaUrl.startsWith(prefix)) return;
  const response = await fetch("/api/media", {
    method: "DELETE",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url: mediaUrl }),
  });
  // The image may already have been deleted in Storage. Clearing its saved URL
  // is still the important part, so treat that state as successfully removed.
  if (!response.ok && response.status !== 404) throw new Error("Couldn’t remove this image from storage.");
}

export async function getProfiles(addresses: readonly string[]) {
  if (!addresses.length || !isSupabaseConfigured) return [] as ProfileRow[];
  const list = addresses.map((address) => address.toLowerCase()).join(",");
  return request<ProfileRow[]>(`profiles?select=address,display_name,avatar_url,avatar_color,updated_at&address=in.(${list})`);
}

export async function saveProfile(address: string, profile: { displayName: string; avatarUrl?: string; avatarColor: string }) {
  const response = await fetch(`/api/profiles/${address}`, {
    method: "PATCH",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(profile),
  });
  if (!response.ok) { const value = await response.json().catch(() => ({})) as { error?: string }; throw new Error(value.error ?? "Couldn’t save your profile."); }
}

export async function getCircleMetadata(circleAddress: string) {
  const rows = await request<CircleMetadata[]>(`circle_metadata?select=*&chain_id=eq.${ACTIVE_CHAIN_ID}&circle_address=eq.${circleAddress.toLowerCase()}&limit=1`);
  return rows[0];
}

export async function saveCircleMetadata(circleAddress: string, metadata: { mission: string; potGoal: string; bannerUrl: string }) {
  const response = await fetch(`/api/circles/${circleAddress}/metadata`, { method: "PATCH", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify(metadata) });
  if (!response.ok) { const value = await response.json().catch(() => ({})) as { error?: string }; throw new Error(value.error ?? "Couldn’t save Circle details."); }
}

export async function getActivity(circleAddress: string) {
  return request<Activity[]>(`circle_activity?select=*&chain_id=eq.${ACTIVE_CHAIN_ID}&circle_address=eq.${circleAddress.toLowerCase()}&order=created_at.desc&limit=50`);
}

export async function recordActivity(activity: { circleAddress: string; actorAddress?: string; kind: string; body: string; txHash: string }) {
  if (!isSupabaseConfigured) return;
  await request<Activity[]>("circle_activity", { method: "POST", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ chain_id: ACTIVE_CHAIN_ID, circle_address: activity.circleAddress.toLowerCase(), actor_address: activity.actorAddress?.toLowerCase() || null, kind: activity.kind, body: activity.body, tx_hash: activity.txHash }) });
}

export async function getMessages(circleAddress: string) {
  const response = await fetch(`/api/circles/${circleAddress}/messages`, { credentials: "same-origin" });
  if (!response.ok) throw new Error(response.status === 401 ? "Wallet sign-in required." : "Chat is temporarily unavailable.");
  return response.json() as Promise<ChatMessage[]>;
}

export async function sendMessage(circleAddress: string, _senderAddress: string, body: string) {
  const response = await fetch(`/api/circles/${circleAddress}/messages`, {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ body: body.trim() }),
  });
  if (!response.ok) {
    const value = await response.json().catch(() => ({})) as { error?: string };
    throw new Error(value.error ?? "Couldn’t send message.");
  }
}
