import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { getAddress, isAddress } from "viem";
import { isCircleMember } from "@/lib/server/membership";
import { getWalletSession } from "@/lib/server/session";
import { deleteMediaObject, publicMediaPath, uploadMediaObject } from "@/lib/server/supabase-admin";
import { ACTIVE_CHAIN_ID } from "@/lib/chain";

export const runtime = "nodejs";

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const EXTENSIONS: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif" };

async function authorize(kind: string, owner: string) {
  const session = await getWalletSession();
  if (!session) return { error: NextResponse.json({ error: "Wallet sign-in required." }, { status: 401 }) };
  if (kind === "avatar" && isAddress(owner) && getAddress(owner) === session.address) return { session };
  if (kind === "banner" && isAddress(owner) && await isCircleMember(owner, session.address)) return { session };
  return { error: NextResponse.json({ error: "You cannot change this image." }, { status: 403 }) };
}

export async function POST(request: Request) {
  try {
    const data = await request.formData();
    const kind = String(data.get("kind") ?? "");
    const owner = String(data.get("owner") ?? "");
    const file = data.get("file");
    const auth = await authorize(kind, owner);
    if (auth.error) return auth.error;
    if (!(file instanceof File)) return NextResponse.json({ error: "Image file is required." }, { status: 400 });
    const extension = EXTENSIONS[file.type];
    if (!extension) return NextResponse.json({ error: "Choose a JPEG, PNG, WebP, or GIF image." }, { status: 400 });
    if (file.size > MAX_IMAGE_BYTES) return NextResponse.json({ error: "Images must be 5 MB or smaller." }, { status: 400 });
    const folder = kind === "avatar" ? "avatars" : "banners";
    const path = kind === "avatar"
      ? `${folder}/${owner.toLowerCase()}/${Date.now()}-${randomBytes(6).toString("hex")}.${extension}`
      : `${folder}/${ACTIVE_CHAIN_ID}/${owner.toLowerCase()}/${Date.now()}-${randomBytes(6).toString("hex")}.${extension}`;
    return NextResponse.json({ url: await uploadMediaObject(path, file) }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Couldn’t upload this image." }, { status: 503 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { url } = (await request.json()) as { url?: string };
    const path = url ? publicMediaPath(url) : undefined;
    if (!path) return NextResponse.json({ error: "Invalid media URL." }, { status: 400 });
    const [folder, segment, circleOwner] = path.split("/");
    const kind = folder === "avatars" ? "avatar" : folder === "banners" ? "banner" : "";
    const owner = kind === "avatar" ? segment : Number(segment) === ACTIVE_CHAIN_ID ? circleOwner : "";
    const auth = await authorize(kind, owner ?? "");
    if (auth.error) return auth.error;
    await deleteMediaObject(path);
    return new NextResponse(null, { status: 204 });
  } catch {
    return NextResponse.json({ error: "Couldn’t remove this image." }, { status: 503 });
  }
}
