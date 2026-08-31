import { InactiveLink } from "@/components/inactive-link";
import { Wordmark } from "@/components/wordmark";
import { getConfirmationForToken } from "@/lib/client-confirmations/repository";
import {
  getFittingSessionConfirmationContent,
  getMeasurementProfileConfirmationContent,
  getOrderDetailConfirmationContent,
} from "@/lib/client-confirmations/content";
import { CLIENT_CONFIRMATION_DECISIONS } from "@/lib/client-confirmations/decision-service";
import { formatMinorUnits } from "@/lib/forms/money";

export const dynamic = "force-dynamic";

type ConfirmPageProps = {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ error?: string }>;
};

function formatDecisionLabel(decision: string): string {
  if (decision === "correction_requested") return "Correction requested";
  return decision.charAt(0).toUpperCase() + decision.slice(1);
}

const INACTIVE_PROPS = {
  title: "This confirmation link is no longer active",
  message: "Please contact Kuartz by Roti for a new link.",
};

export default async function ConfirmPage({ params, searchParams }: ConfirmPageProps) {
  const { token } = await params;
  const { error } = await searchParams;

  const confirmation = await getConfirmationForToken(token);
  if (!confirmation || confirmation.status === "Superseded" || confirmation.status === "Expired") {
    return <InactiveLink {...INACTIVE_PROPS} />;
  }

  const content =
    confirmation.subjectType === "measurement_profile"
      ? await getMeasurementProfileConfirmationContent(confirmation.organizationId, confirmation.subjectId)
      : confirmation.subjectType === "fitting_session"
        ? await getFittingSessionConfirmationContent(confirmation.organizationId, confirmation.subjectId)
        : await getOrderDetailConfirmationContent(confirmation.organizationId, confirmation.subjectId);
  if (!content) return <InactiveLink {...INACTIVE_PROPS} />;

  const isCompleted = confirmation.status === "Completed";

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-8 sm:px-6 lg:px-8">
      <section className="glass-panel w-full max-w-3xl rounded-[2rem] px-6 py-8 sm:px-10 sm:py-10 lg:px-12 lg:py-12">
        <Wordmark />
        <h1 className="mt-10 text-3xl font-extrabold leading-tight tracking-tight text-kuartz-navy sm:text-4xl">
          {confirmation.subjectType === "measurement_profile"
            ? "Confirm your measurements"
            : confirmation.subjectType === "fitting_session"
              ? "Confirm your fitting"
              : "Confirm your order details"}
        </h1>
        <p className="mt-2 text-sm text-kuartz-muted">{content.clientFullName}</p>

        {error ? (
          <div className="mt-6 rounded-2xl border border-kuartz-line bg-white/70 px-4 py-3 text-sm font-semibold text-kuartz-navy shadow-sm">
            {error}
          </div>
        ) : null}

        <div className="mt-8">
          {"clientSummary" in content ? (
            <div className="space-y-4">
              <p className="font-semibold text-kuartz-navy">{content.orderTitle}</p>
              <p className="text-sm text-kuartz-muted">
                Fitting on {content.scheduledAt.toISOString().slice(0, 10)}
                {content.lookName ? ` · ${content.lookName}` : ""}
              </p>
              {content.clientSummary ? (
                <p className="whitespace-pre-line text-sm leading-6 text-kuartz-navy">{content.clientSummary}</p>
              ) : (
                <p className="text-sm text-kuartz-muted">No summary was recorded for this fitting.</p>
              )}
            </div>
          ) : "fields" in content ? (
            <div className="space-y-3">
              {content.fields.length ? (
                content.fields.map((field) => (
                  <div key={field.fieldId} className="flex items-baseline justify-between border-b border-kuartz-line pb-2">
                    <span className="font-semibold text-kuartz-navy">{field.fieldName}</span>
                    <span className="text-kuartz-muted">
                      {field.value} {field.unit}
                    </span>
                  </div>
                ))
              ) : (
                <p className="text-sm text-kuartz-muted">No measurements have been recorded yet.</p>
              )}
            </div>
          ) : (
            <div className="space-y-6">
              <p className="font-semibold text-kuartz-navy">{content.orderTitle}</p>
              {content.looks.map((look) => (
                <div key={look.id}>
                  <h2 className="text-xs font-semibold uppercase tracking-wide text-kuartz-muted">{look.name}</h2>
                  {look.notes ? <p className="mt-1 text-sm text-kuartz-muted">{look.notes}</p> : null}
                  <ul className="mt-2 space-y-1 text-sm text-kuartz-navy">
                    {look.items.map((item) => (
                      <li key={item.id}>
                        {item.label} × {item.quantity}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
              <p className="font-semibold text-kuartz-navy">Final agreed price: ₦{formatMinorUnits(content.finalAgreedPriceMinor)}</p>
            </div>
          )}
        </div>

        <div className="mt-8">
          {isCompleted ? (
            <p className="text-sm text-kuartz-muted">
              Decision: {formatDecisionLabel(confirmation.decisionStatus)}
              {confirmation.decisionComment ? `. Comment: "${confirmation.decisionComment}"` : ""}
            </p>
          ) : (
            <form action={`/confirm/${encodeURIComponent(token)}/decide`} method="post" className="flex flex-wrap items-end gap-4">
              <label className="block space-y-2">
                <span className="label">Decision</span>
                <select name="decision" className="field" defaultValue="confirmed">
                  {CLIENT_CONFIRMATION_DECISIONS.map((decision) => (
                    <option key={decision} value={decision}>
                      {formatDecisionLabel(decision)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block flex-1 space-y-2">
                <span className="label">
                  Comment <span className="font-normal">(required if requesting a correction)</span>
                </span>
                <input type="text" name="comment" className="field" />
              </label>
              <button type="submit" className="primary-action">
                Submit
              </button>
            </form>
          )}
        </div>
      </section>
    </main>
  );
}
