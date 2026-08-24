import { NextResponse } from "next/server";
import { isAddress } from "viem";
import { isCircleMember } from "@/lib/server/membership";
import { getWalletSession } from "@/lib/server/session";
import { supabaseAdminRequest } from "@/lib/server/supabase-admin";
import type { ChatMessage } from "@/lib/supabase";
import { ACTIVE_CHAIN_ID } from "@/lib/chain";

export const runtime = "nodejs";

async function authorize(circleAddress: string) {
  const session = await getWalletSession();
  if (!session) return { error: NextResponse.json({ error: "Wallet sign-in required." }, { status: 401 }) };
  if (!isAddress(circleAddress)) return { error: NextResponse.json({ error: "Invalid Circle address." }, { status: 400 }) };
  if (!(await isCircleMember(circleAddress, session.address))) {
    return { error: NextResponse.json({ error: "Circle membership required." }, { status: 403 }) };
  }
  return { session };
}

export async function GET(_request: Request, context: { params: Promise<{ address: string }> }) {
  try {
    const { address } = await context.params;
    const auth = await authorize(address);
    if (auth.error) return auth.error;
    const rows = await supabaseAdminRequest<ChatMessage[]>(`circle_messages?select=*&chain_id=eq.${ACTIVE_CHAIN_ID}&circle_address=eq.${address.toLowerCase()}&order=created_at.desc&limit=50`);
    return NextResponse.json(rows);
  } catch {
    return NextResponse.json({ error: "Private chat is temporarily unavailable." }, { status: 503 });
  }
}

export async function POST(request: Request, context: { params: Promise<{ address: string }> }) {
  try {
    const { address } = await context.params;
    const auth = await authorize(address);
    if (auth.error || !auth.session) return auth.error;
    const { body } = (await request.json()) as { body?: string };
    const message = body?.trim() ?? "";
    if (!message || message.length > 500) return NextResponse.json({ error: "Message must be between 1 and 500 characters." }, { status: 400 });
    const rows = await supabaseAdminRequest<ChatMessage[]>("circle_messages", {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({ chain_id: ACTIVE_CHAIN_ID, circle_address: address.toLowerCase(), sender_address: auth.session.address.toLowerCase(), body: message }),
    });
    return NextResponse.json(rows[0], { status: 201 });
  } catch {
    return NextResponse.json({ error: "Couldn’t send this message." }, { status: 503 });
  }
}
