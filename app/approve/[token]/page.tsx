import { InactiveLink } from "@/components/inactive-link";
import { Wordmark } from "@/components/wordmark";
import { getApprovalBatchForToken, type ApprovalBatchViewItem } from "@/lib/style-direction-approvals/repository";
import { getSignedStyleDirectionViewUrl } from "@/lib/storage/r2";
import { formatStyleDirectionLabel } from "@/lib/style-direction-files/file-service";
import { APPROVAL_DECISIONS } from "@/lib/style-direction-approvals/decision-service";

export const dynamic = "force-dynamic";

type ApprovalPageProps = {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ error?: string; itemId?: string }>;
};

export default async function ApprovalPage({ params, searchParams }: ApprovalPageProps) {
  const { token } = await params;
  const { error, itemId } = await searchParams;

  const batch = await getApprovalBatchForToken(token);
  if (!batch || batch.status === "Superseded" || batch.status === "Expired") {
    return (
      <InactiveLink
        title="This approval link is no longer active"
        message="Please contact Kuartz by Roti for a new link."
      />
    );
  }

  const isCompleted = batch.status === "Completed";
  const signedUrlEntries = await Promise.all(
    batch.items.map(async (item) => [item.id, await getSignedStyleDirectionViewUrl(item.r2ObjectKey)] as const),
  );
  const signedUrlByItemId = new Map(signedUrlEntries);

  const groups: { lookId: string | null; lookName: string; items: ApprovalBatchViewItem[] }[] = [
    { lookId: null, lookName: "Whole Order", items: batch.items.filter((item) => !item.lookId) },
  ];
  for (const item of batch.items) {
    if (!item.lookId) continue;
    let group = groups.find((candidate) => candidate.lookId === item.lookId);
    if (!group) {
      group = { lookId: item.lookId, lookName: item.lookName ?? "Look", items: [] };
      groups.push(group);
    }
    group.items.push(item);
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-8 sm:px-6 lg:px-8">
      <section className="glass-panel w-full max-w-5xl rounded-[2rem] px-6 py-8 sm:px-10 sm:py-10 lg:px-12 lg:py-12">
        <Wordmark />
        <h1 className="mt-10 text-3xl font-extrabold leading-tight tracking-tight text-kuartz-navy sm:text-4xl">
          {isCompleted ? "Your decisions" : "Style direction for your review"}
        </h1>
        <p className="mt-2 text-sm text-kuartz-muted">
          {batch.orderTitle} — {batch.clientFullName}
        </p>

        {error ? (
          <div className="mt-6 rounded-2xl border border-kuartz-line bg-white/70 px-4 py-3 text-sm font-semibold text-kuartz-navy shadow-sm">
            {error}
          </div>
        ) : null}

        <div className="mt-8 space-y-10">
          {groups
            .filter((group) => group.items.length)
            .map((group) => (
              <div key={group.lookId ?? "whole-order"}>
                <h2 className="text-xs font-semibold uppercase tracking-wide text-kuartz-muted">{group.lookName}</h2>
                <div className="mt-4 space-y-8">
                  {group.items.map((item) => {
                    const signedUrl = signedUrlByItemId.get(item.id);
                    const isHighlighted = Boolean(error) && itemId === item.id;
                    return (
                      <div
                        key={item.id}
                        className={isHighlighted ? "rounded-[1rem] p-3 ring-2 ring-red-400" : ""}
                      >
                        <p className="font-semibold text-kuartz-navy">{formatStyleDirectionLabel(item.category)}</p>
                        {signedUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element -- private, signed R2 URL.
                          <img
                            src={signedUrl}
                            alt={formatStyleDirectionLabel(item.category)}
                            className="mt-3 max-h-80 rounded-[1rem] border border-kuartz-line object-contain"
                          />
                        ) : null}

                        {isCompleted || item.decisionStatus !== "pending" ? (
                          <p className="mt-3 text-sm text-kuartz-muted">
                            Decision: {formatStyleDirectionLabel(item.decisionStatus)}
                            {item.decisionComment ? ` — "${item.decisionComment}"` : ""}
                          </p>
                        ) : (
                          <form
                            action={`/approve/${encodeURIComponent(token)}/decide`}
                            method="post"
                            className="mt-4 flex flex-wrap items-end gap-4"
                          >
                            <input type="hidden" name="batchItemId" value={item.id} />
                            <label className="block space-y-2">
                              <span className="label">Decision</span>
                              <select name="decision" className="field" defaultValue="approved">
                                {APPROVAL_DECISIONS.map((decision) => (
                                  <option key={decision} value={decision}>
                                    {formatStyleDirectionLabel(decision)}
                                  </option>
                                ))}
                              </select>
                            </label>
                            <label className="block flex-1 space-y-2">
                              <span className="label">
                                Comment <span className="font-normal">(required for With Revisions / Rejected)</span>
                              </span>
                              <input type="text" name="comment" className="field" />
                            </label>
                            <button type="submit" className="primary-action">
                              Submit
                            </button>
                          </form>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
        </div>
      </section>
    </main>
  );
}
