import { Wordmark } from "@/components/wordmark";

export default function SuccessPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-5 py-10">
      <section className="glass-panel w-full max-w-md rounded-[2.25rem] p-8 text-center sm:p-10">
        <Wordmark center />
        <h1 className="mx-auto mt-10 max-w-xs text-3xl font-extrabold leading-tight tracking-tight text-kuartz-navy">
          Thank you
        </h1>
        <p className="mx-auto mt-4 max-w-sm text-sm leading-6 text-kuartz-muted">
          Kuartz by Roti will be in touch shortly.
        </p>
      </section>
    </main>
  );
}