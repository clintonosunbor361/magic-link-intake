import { InactiveLink } from "@/components/inactive-link";
import { IntakeForm } from "@/components/intake-form";
import { Wordmark } from "@/components/wordmark";
import { verifyToken } from "@/lib/magic-links";

export const dynamic = "force-dynamic";

type IntakePageProps = {
  params: Promise<{
    token: string;
  }>;
  searchParams?: Promise<{
    error?: string | string[];
  }>;
};

export default async function IntakePage({ params, searchParams }: IntakePageProps) {
  const { token } = await params;
  const query = await searchParams;
  const isValid = verifyToken(token);

  if (!isValid) {
    return <InactiveLink />;
  }

  const error = Array.isArray(query?.error) ? query?.error[0] : query?.error;

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-8 sm:px-6 lg:px-8">
      <section className="glass-panel w-full max-w-5xl rounded-[2rem] px-6 py-8 sm:px-10 sm:py-10 lg:px-12 lg:py-12">
        <Wordmark />
        <h1 className="mt-10 text-3xl font-extrabold leading-tight tracking-tight text-kuartz-navy sm:text-4xl">
          Please fill in your details.
        </h1>
        <IntakeForm token={token} error={error} />
      </section>
    </main>
  );
}