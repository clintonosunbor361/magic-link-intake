import { Wordmark } from "@/components/wordmark";

export default function ApprovalCompletedPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-8 sm:px-6 lg:px-8">
      <section className="glass-panel w-full max-w-xl rounded-[2rem] px-6 py-8 sm:px-10 sm:py-10">
        <Wordmark />
        <h1 className="mt-10 text-3xl font-extrabold leading-tight tracking-tight text-kuartz-navy">
          Your decisions were recorded
        </h1>
        <p className="mt-3 text-sm leading-6 text-kuartz-muted">
          Thank you. This approval link is now inactive.
        </p>
      </section>
    </main>
  );
}
