import { NextResponse } from "next/server";
import { supabaseAdminExactJson } from "@/lib/server/supabase-admin";
import { ACTIVE_CHAIN_ID } from "@/lib/chain";

export const runtime = "nodejs";

export async function GET() {
  try {
    const [circles, bonds, payouts, sync] = await Promise.all([
      supabaseAdminExactJson<unknown[]>(`indexed_circles?select=*&chain_id=eq.${ACTIVE_CHAIN_ID}&order=created_block.asc`),
      supabaseAdminExactJson<unknown[]>(`indexed_bonds?select=*&chain_id=eq.${ACTIVE_CHAIN_ID}&order=bond_id.asc`),
      supabaseAdminExactJson<unknown[]>(`indexed_payouts?select=*&chain_id=eq.${ACTIVE_CHAIN_ID}&order=payout_id.asc`),
      supabaseAdminExactJson<Array<{ last_finalized_block: string }>>(`chain_sync_state?select=last_finalized_block&chain_id=eq.${ACTIVE_CHAIN_ID}&limit=1`),
    ]);
    if (!sync[0]) return NextResponse.json({ error: "The indexed dashboard snapshot is not ready." }, { status: 404 });
    return NextResponse.json(
      { circles, bonds, payouts, indexedThroughBlock: sync[0].last_finalized_block },
      { headers: { "Cache-Control": "public, s-maxage=15, stale-while-revalidate=60" } },
    );
  } catch {
    return NextResponse.json({ error: "The dashboard snapshot is temporarily unavailable." }, { status: 503 });
  }
}
