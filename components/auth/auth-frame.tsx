import Link from "next/link";
import { Wordmark } from "@/components/wordmark";

export function AuthFrame({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <main className="grid min-h-[100dvh] bg-kuartz-canvas px-5 py-8 sm:px-8 lg:grid-cols-[minmax(0,1fr)_minmax(28rem,0.92fr)] lg:px-0 lg:py-0">
      <section className="relative hidden overflow-hidden bg-kuartz-ink p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="absolute inset-x-0 top-0 h-px bg-white/20" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_28%_18%,rgba(210,255,103,0.16),transparent_34%),linear-gradient(180deg,rgba(255,255,255,0.06),transparent_48%)]" aria-hidden="true" />
        <div className="relative"><Wordmark inverse /></div>
        <div className="relative max-w-xl">
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-kuartz-lime">Kuartz operations</p>
          <p className="mt-6 text-5xl font-extrabold leading-[1.02] tracking-normal">
            Every detail, from first conversation to final fitting.
          </p>
          <div className="mt-10 h-1 w-16 rounded-full bg-kuartz-lime" />
        </div>
      </section>
      <section className="flex items-center lg:px-16">
        <div className="glass-panel mx-auto w-full max-w-md rounded-[2rem] px-6 py-8 sm:px-9 sm:py-10 lg:bg-white/[0.76]">
          <div className="lg:hidden"><Wordmark /></div>
          <p className="mt-10 font-mono text-xs font-bold uppercase tracking-[0.16em] text-kuartz-secondary lg:mt-0">{eyebrow}</p>
          <h1 className="mt-4 text-4xl font-extrabold leading-tight tracking-normal text-kuartz-ink">{title}</h1>
          <p className="mt-4 max-w-[48ch] leading-7 text-kuartz-secondary">{description}</p>
          <div className="mt-9">{children}</div>
          <p className="mt-8 text-sm text-kuartz-secondary">
            Need help? <Link className="font-semibold text-kuartz-ink underline-offset-4 hover:underline" href="mailto:operations@kuartz.com">Contact operations</Link>
          </p>
        </div>
      </section>
    </main>
  );
}

