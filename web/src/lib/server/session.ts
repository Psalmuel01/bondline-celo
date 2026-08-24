import "server-only";

import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { getAddress, isAddress, verifyMessage } from "viem";
import { ACTIVE_CHAIN_ID } from "@/lib/chain";

const NONCE_COOKIE = "bondline_nonce";
const SESSION_COOKIE = "bondline_session";
const NONCE_TTL_SECONDS = 5 * 60;
const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60;

type NoncePayload = { address: `0x${string}`; nonce: string; origin: string; expiresAt: number };
export type WalletSession = { address: `0x${string}`; chainId: number; expiresAt: number };

function secret() {
  const value = process.env.BONDLINE_SESSION_SECRET;
  if (!value || value.length < 32) {
    throw new Error("BONDLINE_SESSION_SECRET must contain at least 32 characters.");
  }
  return value;
}

function encode(value: unknown) {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

function sign(payload: string) {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

function seal(value: unknown) {
  const payload = encode(value);
  return `${payload}.${sign(payload)}`;
}

function unseal<T>(value?: string): T | undefined {
  if (!value) return;
  const [payload, signature] = value.split(".");
  if (!payload || !signature) return;
  const expected = Buffer.from(sign(payload));
  const actual = Buffer.from(signature);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return;
  try {
    return JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as T;
  } catch {
    return;
  }
}

function messageFor(payload: NoncePayload) {
  return [
    "Bondline wants you to sign in with your wallet:",
    payload.address,
    "",
    "Authorize access to your private Circle features. This does not send a transaction or cost gas.",
    "",
    `URI: ${payload.origin}`,
    "Version: 1",
    `Chain ID: ${ACTIVE_CHAIN_ID}`,
    `Nonce: ${payload.nonce}`,
    `Expiration Time: ${new Date(payload.expiresAt).toISOString()}`,
  ].join("\n");
}

export async function createChallenge(address: string, origin: string) {
  if (!isAddress(address)) throw new Error("Invalid wallet address.");
  const payload: NoncePayload = {
    address: getAddress(address),
    nonce: randomBytes(16).toString("hex"),
    origin,
    expiresAt: Date.now() + NONCE_TTL_SECONDS * 1000,
  };
  const store = await cookies();
  store.set(NONCE_COOKIE, seal(payload), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: NONCE_TTL_SECONDS,
  });
  return messageFor(payload);
}

export async function verifyChallenge(address: string, message: string, signature: `0x${string}`) {
  const store = await cookies();
  const payload = unseal<NoncePayload>(store.get(NONCE_COOKIE)?.value);
  store.delete(NONCE_COOKIE);
  if (!payload || payload.expiresAt <= Date.now()) throw new Error("Sign-in request expired.");
  if (!isAddress(address) || getAddress(address) !== payload.address) throw new Error("Wallet address does not match.");
  if (message !== messageFor(payload)) throw new Error("Sign-in message does not match.");
  const valid = await verifyMessage({ address: payload.address, message, signature });
  if (!valid) throw new Error("Invalid wallet signature.");

  const session: WalletSession = {
    address: payload.address,
    chainId: ACTIVE_CHAIN_ID,
    expiresAt: Date.now() + SESSION_TTL_SECONDS * 1000,
  };
  store.set(SESSION_COOKIE, seal(session), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
  return session;
}

export async function getWalletSession() {
  const store = await cookies();
  const session = unseal<WalletSession>(store.get(SESSION_COOKIE)?.value);
  if (!session || session.expiresAt <= Date.now() || session.chainId !== ACTIVE_CHAIN_ID) return;
  return session;
}

export async function clearWalletSession() {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
  store.delete(NONCE_COOKIE);
}
