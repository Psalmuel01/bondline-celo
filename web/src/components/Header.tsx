import Link from "next/link";
import { ConnectButton } from "./ConnectButton";
import { Wordmark } from "./Logo";
import { NotificationCenter } from "./NotificationCenter";
import { activeChain } from "@/lib/chain";

export function Header() {
  return (
    <header className="flex items-center justify-between gap-4">
      <div className="flex items-center gap-5">
        <Link href="/" className="transition-opacity hover:opacity-80">
          <Wordmark size={30} />
        </Link>
        <span className="tnum hidden items-center gap-1.5 rounded border border-gold/30 bg-gold/5 px-1.5 py-0.5 text-[10px] tracking-wide text-gold/90 sm:inline-flex">
          <span className="h-1 w-1 rounded-full bg-gold" />
          {activeChain.name.toUpperCase()}
        </span>
      </div>
      <div className="flex items-center gap-1.5 sm:gap-4">
        <Link
          href="/docs"
          className="hidden px-2 text-sm text-muted transition-colors hover:text-gold sm:inline"
        >
          How it works
        </Link>
        <NotificationCenter />
        <ConnectButton />
      </div>
    </header>
  );
}
