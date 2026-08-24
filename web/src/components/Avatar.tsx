"use client";

import { useState } from "react";
import { addrHue, addrInitials, shortAddr } from "@/lib/format";

type Vote = "yes" | "no" | "pending";

/// A member's identity chip. In the cosign UI its ring lights green/red the
/// instant that member's Cosigned event lands; elsewhere it's a neutral face.
export function Avatar({
  addr,
  size = 40,
  vote = "pending",
  you = false,
  title,
  imageUrl,
  color,
}: {
  addr: `0x${string}`;
  size?: number;
  vote?: Vote;
  you?: boolean;
  title?: string;
  imageUrl?: string | null;
  color?: string;
}) {
  const [failedImageUrl, setFailedImageUrl] = useState<string | null>(null);
  const showImage = Boolean(imageUrl && failedImageUrl !== imageUrl);
  const hue = addrHue(addr);
  const cosigned = vote === "yes" || vote === "no";
  const ring =
    vote === "yes"
      ? "0 0 0 2px var(--confirm), 0 0 12px rgba(63,166,108,0.45)"
      : vote === "no"
        ? "0 0 0 2px var(--forfeit), 0 0 12px rgba(193,80,63,0.4)"
        : you
          ? "0 0 0 1.5px var(--gold)"
          : "0 0 0 1px var(--line)";

  return (
    <div
      className={`tnum flex items-center justify-center rounded-full font-semibold transition-all duration-500 ${
        cosigned ? "cosign-in" : ""
      }`}
      style={{
        width: size,
        height: size,
        fontSize: size * 0.34,
        backgroundColor: showImage
          ? undefined
          : cosigned
            ? `hsl(${hue} 22% 16%)`
            : color ?? `hsl(${hue} 30% 20%)`,
        color: `hsl(${hue} 55% 74%)`,
        boxShadow: ring,
      }}
      title={title ?? `${shortAddr(addr)}${you ? " (you)" : ""}`}
    >
      {showImage ? <img src={imageUrl ?? undefined} alt="" onError={() => setFailedImageUrl(imageUrl ?? null)} className="h-full w-full rounded-full object-cover" /> : addrInitials(addr)}
    </div>
  );
}
