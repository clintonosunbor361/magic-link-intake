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
    <main className="grid min-h-[100dvh] bg-kuartz-canvas lg:grid-cols-[minmax(0,1.08fr)_minmax(28rem,0.92fr)]">
      <section className="relative hidden overflow-hidden bg-kuartz-ink p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="absolute inset-x-0 top-0 h-px bg-white/20" />
        <Wordmark inverse />
        <div className="relative max-w-xl">
          <p className="font-mono text-xs uppercase tracking-[0.24em] text-kuartz-lime">Kuartz operations</p>
          <p className="mt-6 text-5xl font-semibold leading-[0.98] tracking-[-0.055em]">
            Every detail, from first conversation to final fitting.
          </p>
          <div className="mt-10 h-px w-24 bg-kuartz-lime" />
        </div>
      </section>
      <section className="flex items-center px-5 py-12 sm:px-10 lg:px-16">
        <div className="mx-auto w-full max-w-md">
          <div className="lg:hidden"><Wordmark /></div>
          <p className="mt-12 font-mono text-xs uppercase tracking-[0.2em] text-kuartz-secondary lg:mt-0">{eyebrow}</p>
          <h1 className="mt-4 text-4xl font-semibold tracking-[-0.045em] text-kuartz-ink">{title}</h1>
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
