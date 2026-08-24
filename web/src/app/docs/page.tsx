import Link from "next/link";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";

export const metadata: Metadata = {
  title: "How Bondline works",
  description:
    "The mechanic, the vocabulary, and the on-chain guarantees behind Bondline — a group commitment protocol on Celo.",
};

/// Static docs page. Plain, a little wry, matches the brand voice. Explains the
/// mechanic and defines the product vocabulary so the words on the buttons make
/// sense the first time someone lands here.
export default function DocsPage() {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-5 py-6 sm:px-8">
      <Header />

      <article className="py-10 sm:py-14">
        <div className="relative overflow-hidden rounded-2xl border border-line bg-panel px-6 py-10 sm:px-10 sm:py-14">
          <div className="absolute -right-24 -top-24 h-64 w-64 rounded-full bg-gold/10 blur-3xl" />
          <p className="tnum relative text-xs uppercase tracking-widest text-gold">The Bondline field guide</p>
          <h1 className="font-display relative mt-3 text-4xl font-semibold leading-[1.05] tracking-tight sm:text-6xl">
            Put your money where
            <br />
            your deadline is.
          </h1>
          <p className="relative mt-5 max-w-xl text-[15px] leading-relaxed text-muted">
            Missing your own deadline costs exactly zero. Bondline makes it cost
            something, then hands the decision to your crew. The whole mechanic,
            in a minute.
          </p>
          <div className="relative mt-8 grid max-w-2xl gap-3 sm:grid-cols-3">
            <QuickFact label="You stake" value="CELO on a deadline" />
            <QuickFact label="They decide" value="with a cosign" />
            <QuickFact label="The outcome" value="refund or Pot" />
          </div>
        </div>

        <Section title="The one-minute version">
          <p>
            You and your friends form a <Term>Circle</Term>. Each of you stakes
            CELO against a personal deadline — that&apos;s a <Term>Bond</Term>.
            When you&apos;re done, you declare it and drop your{" "}
            <Term>Receipts</Term>. Your Circle gets a window to{" "}
            <Term>cosign</Term> whether it actually happened. Clear the bar your
            group set and you&apos;re refunded. Miss your deadline, or fail the
            cosign, and your stake drops into the <Term>Pot</Term> — the shared
            fund your Circle spends together.
          </p>
        </Section>

        <Section title="The flow, step by step">
          <ol className="grid gap-4 md:grid-cols-2">
            <Step n={1} title="Form a Circle">
              Add your crew by wallet address and set one rule: the cosign
              threshold. Maybe half the Circle has to agree, maybe less. Every
              Circle deploys its own fund contract at its own address — this
              Circle&apos;s money, for this Circle only, never pooled with anyone
              else&apos;s.
            </Step>
            <Step n={2} title="Stake a Bond">
              Put CELO on a deadline you care about — ship the feature, run the
              10k, send the invoices. The stake is escrowed on-chain the moment
              you sign. The clock is now public.
            </Step>
            <Step n={3} title="Beat the Line">
              Any time before your deadline — even ten minutes before — hit
              declare and attach your Receipts (a PR, a demo, a screenshot). That
              freezes your clock instantly and opens the cosign.
            </Step>
            <Step n={4} title="Your Circle cosigns">
              Members vote on-chain. Avatars light up green as each cosign lands,
              in real time, no refresh. The second the threshold clears, it
              resolves live and your stake is back in your wallet.
            </Step>
            <Step n={5} title="Or cross the Line">
              Miss the deadline with no Receipts, or fail the cosign, and the
              stake moves straight into the Pot. Nobody has to chase you. The
              window just closes.
            </Step>
            <Step n={6} title="Spend the Pot together">
              Forfeited stakes collect in the Circle&apos;s fund. Anyone can
              propose a payout — a group dinner, a trip, a refund — and it pays
              out once enough of the Circle cosigns it.
            </Step>
          </ol>
        </Section>

        <Section title="The vocabulary">
          <dl className="flex flex-col divide-y divide-line">
            <Define term="Circle" desc="Your friend group, and your shared fund." />
            <Define term="Bond" desc="One staked commitment against your own deadline." />
            <Define
              term="The Line"
              desc="Your deadline. Beat the Line, or cross it — there's no middle."
            />
            <Define
              term="Cosign"
              desc="A Circle member's on-chain vote confirming a Bond was met. Carries the weight of a friend vouching for you."
            />
            <Define
              term="The Pot"
              desc="The shared fund built from crossed Bonds. The money your misses hand back to the group."
            />
            <Define
              term="Receipts"
              desc="The evidence you attach when you declare a Bond done. Hashed on-chain so it can't be swapped later."
            />
          </dl>
        </Section>

        <Section title="What the chain guarantees">
          <ul className="flex list-disc flex-col gap-2 pl-5 marker:text-gold">
            <li>Your deadline is on-chain. Nobody can move the Line after the fact.</li>
            <li>
              Every cosign is a transaction. The tally is public and can&apos;t be
              faked.
            </li>
            <li>
              The Pot is a contract at its own address — anyone can watch the
              balance, nobody can quietly drain it. Payouts need a cosigned
              proposal.
            </li>
            <li>
              Your Receipts are hashed at declaration, so the evidence your Circle
              votes on is the evidence you submitted.
            </li>
          </ul>
        </Section>

        <Section title="Make a Circle feel like yours">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-line bg-panel p-5">
              <h3 className="font-display font-semibold text-bone">Profiles &amp; Circle identity</h3>
              <p className="mt-2 text-sm text-muted">
                Click your own name in a Circle to set a display name, avatar,
                and color. Circle members can also add a mission, a Pot goal,
                and a banner image. These are display details only — funds and
                membership remain on-chain.
              </p>
            </div>
            <div className="rounded-xl border border-line bg-panel p-5">
              <h3 className="font-display font-semibold text-bone">Chat, activity &amp; receipts</h3>
              <p className="mt-2 text-sm text-muted">
                Each Circle has its own chat and activity timeline. Add a GitHub
                PR, Loom, YouTube link, or image as a receipt when declaring a
                Bond done; Bondline gives it a compact preview for the crew.
              </p>
            </div>
          </div>
        </Section>

        <Section title="Things that need you">
          <p>
            The notification button in the header surfaces two high-signal
            moments: a Circle asking for your cosign, and one of your own Bonds
            with less than 24 hours left. These notifications are in-app, so
            they work immediately without asking for browser permissions.
          </p>
        </Section>

        <div className="mt-6 rounded-xl border border-gold/25 bg-gold/5 p-5 text-sm text-muted">
          <p className="text-bone">A note on the build.</p>
          <p className="mt-1.5">
            Bondline runs on Celo Sepolia with test CELO. Its verified Core and
            Factory were deployed at block 34271637. It hasn&apos;t been
            audited — treat it as a hackathon build, not a place for money you
            can&apos;t afford to lose to a bug.
          </p>
          <p className="mt-3">
            Profiles, chat, Circle missions, banners, and app-recorded activity
            are optional testnet metadata stored separately from the contracts.
            They never control the Pot or change Circle membership.
          </p>
        </div>

        <div className="mt-10 flex flex-wrap gap-3">
          <Link
            href="/"
            className="rounded-lg bg-gold px-5 py-2.5 text-sm font-semibold text-ink transition hover:brightness-108"
          >
            Start a Circle
          </Link>
          <a
            href="https://faucet.celo.org/celo-sepolia"
            target="_blank"
            rel="noreferrer"
            className="rounded-lg border border-line px-5 py-2.5 text-sm font-medium text-bone transition hover:border-panel-hi"
          >
            Grab testnet CELO ↗
          </a>
          <a
            href="https://sepolia.celoscan.io/address/0x111004038f8e918a02cd760e2e2630e0c9e789d6"
            target="_blank"
            rel="noreferrer"
            className="rounded-lg border border-line px-5 py-2.5 text-sm font-medium text-bone transition hover:border-panel-hi"
          >
            Verified Core ↗
          </a>
        </div>
      </article>

      <Footer />
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-12 border-t border-line pt-8">
      <h2 className="font-display text-xl font-semibold tracking-tight text-bone">
        {title}
      </h2>
      <div className="mt-4 text-[15px] leading-relaxed text-muted">{children}</div>
    </section>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  return (
    <li className="flex gap-4 rounded-xl border border-line bg-panel p-4">
      <span className="tnum flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-gold/40 bg-gold/10 text-sm font-semibold text-gold">
        {n}
      </span>
      <div>
        <h3 className="font-display font-semibold text-bone">{title}</h3>
        <p className="mt-1 text-muted">{children}</p>
      </div>
    </li>
  );
}

function QuickFact({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg border border-line bg-bg/40 px-4 py-3"><p className="tnum text-[10px] uppercase tracking-widest text-faint">{label}</p><p className="mt-1 text-sm font-medium text-bone">{value}</p></div>;
}

function Define({ term, desc }: { term: string; desc: string }) {
  return (
    <div className="flex flex-col gap-1 py-3 sm:flex-row sm:gap-6">
      <dt className="font-display w-32 shrink-0 font-semibold text-gold">{term}</dt>
      <dd className="text-muted">{desc}</dd>
    </div>
  );
}

function Term({ children }: { children: ReactNode }) {
  return <span className="font-medium text-bone">{children}</span>;
}
