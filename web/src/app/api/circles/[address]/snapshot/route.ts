import { NextResponse } from "next/server";
import { isAddress } from "viem";
import { supabaseAdminExactJson } from "@/lib/server/supabase-admin";
import { ACTIVE_CHAIN_ID } from "@/lib/chain";

export const runtime = "nodejs";

export async function GET(_request: Request, context: { params: Promise<{ address: string }> }) {
  try {
    const { address } = await context.params;
    if (!isAddress(address)) return NextResponse.json({ error: "Invalid Circle address." }, { status: 400 });
    const value = await supabaseAdminExactJson<unknown>("rpc/get_circle_snapshot", {
      method: "POST",
      body: JSON.stringify({ p_chain_id: ACTIVE_CHAIN_ID, p_circle_address: address.toLowerCase() }),
    });
    if (!value) return NextResponse.json({ error: "Indexed snapshot is not ready for this Circle." }, { status: 404 });
    return NextResponse.json(value, {
      headers: { "Cache-Control": "public, s-maxage=15, stale-while-revalidate=60" },
    });
  } catch {
    return NextResponse.json({ error: "Circle snapshot is temporarily unavailable." }, { status: 503 });
  }
}
