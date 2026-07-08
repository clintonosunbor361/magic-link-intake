import { Wordmark } from "@/components/wordmark";

export function InactiveLink() {
  return (
    <main className="flex min-h-screen items-center justify-center px-5 py-10">
      <section className="glass-panel w-full max-w-md rounded-[2.25rem] p-8 text-center sm:p-10">
        <Wordmark center />
        <h1 className="mx-auto mt-10 max-w-xs text-3xl font-extrabold leading-tight tracking-tight text-kuartz-navy">
          This link is no longer active
        </h1>
        <p className="mx-auto mt-4 max-w-sm text-sm leading-6 text-kuartz-muted">
          Please ask Kuartz by Roti for a fresh intake link so we can collect
          your details securely.
        </p>
      </section>
    </main>
  );
}