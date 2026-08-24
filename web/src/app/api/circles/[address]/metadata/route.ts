import { NextResponse } from "next/server";
import { isAddress } from "viem";
import { isCircleMember } from "@/lib/server/membership";
import { getWalletSession } from "@/lib/server/session";
import { supabaseAdminRequest } from "@/lib/server/supabase-admin";
import type { CircleMetadata } from "@/lib/supabase";
import { ACTIVE_CHAIN_ID } from "@/lib/chain";

export const runtime = "nodejs";

export async function PATCH(request: Request, context: { params: Promise<{ address: string }> }) {
  try {
    const { address } = await context.params;
    const session = await getWalletSession();
    if (!session) return NextResponse.json({ error: "Wallet sign-in required." }, { status: 401 });
    if (!isAddress(address)) return NextResponse.json({ error: "Invalid Circle address." }, { status: 400 });
    if (!(await isCircleMember(address, session.address))) return NextResponse.json({ error: "Circle membership required." }, { status: 403 });
    const input = (await request.json()) as { mission?: string; potGoal?: string; bannerUrl?: string };
    const mission = input.mission?.trim() ?? "";
    if (mission.length > 120) return NextResponse.json({ error: "Mission must be 120 characters or fewer." }, { status: 400 });
    const potGoal = input.potGoal ? Number(input.potGoal) : null;
    if (potGoal !== null && (!Number.isFinite(potGoal) || potGoal <= 0)) return NextResponse.json({ error: "Pot goal must be greater than zero." }, { status: 400 });
    const rows = await supabaseAdminRequest<CircleMetadata[]>("circle_metadata", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=representation" },
      body: JSON.stringify({ chain_id: ACTIVE_CHAIN_ID, circle_address: address.toLowerCase(), mission: mission || null, pot_goal: potGoal, banner_url: input.bannerUrl?.trim() || null, updated_at: new Date().toISOString() }),
    });
    return NextResponse.json(rows[0]);
  } catch {
    return NextResponse.json({ error: "Couldn’t update Circle details." }, { status: 503 });
  }
}
