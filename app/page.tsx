import { LinkGenerator } from "@/components/link-generator";
import { Wordmark } from "@/components/wordmark";
import { listMagicLinks, listSubmissions, type LinkStatus } from "@/lib/magic-links";

export const dynamic = "force-dynamic";

const dateFormatter = new Intl.DateTimeFormat("en-NG", {
  dateStyle: "medium",
  timeStyle: "short",
});

export default function AdminPage() {
  const links = listMagicLinks();
  const submissions = listSubmissions();

  return (
    <main className="min-h-screen px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <header className="glass-panel rounded-[2rem] p-7 sm:p-9">
          <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <Wordmark />
              <h1 className="mt-8 max-w-2xl text-4xl font-extrabold leading-tight tracking-tight text-kuartz-navy sm:text-5xl">
                Client intake links
              </h1>
            </div>
            <LinkGenerator />
          </div>
        </header>

        <section className="grid gap-6 lg:grid-cols-[0.92fr_1.08fr]">
          <div className="glass-panel rounded-[2rem] p-5 sm:p-6">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-xl font-extrabold text-kuartz-navy">Generated links</h2>
              <span className="rounded-full border border-kuartz-line bg-white/65 px-3 py-1 text-xs font-semibold text-kuartz-muted backdrop-blur-xl">
                {links.length}
              </span>
            </div>

            <div className="mt-5 overflow-hidden rounded-[1.5rem] border border-kuartz-line bg-white/55 backdrop-blur-xl">
              {links.length ? (
                <div className="divide-y divide-kuartz-line/80">
                  {links.map((link) => (
                    <div
                      key={link.id}
                      className="grid gap-3 px-4 py-4 text-sm sm:grid-cols-[1fr_auto] sm:items-center"
                    >
                      <div className="min-w-0">
                        <p className="font-mono text-xs text-kuartz-muted">
                          hash {link.hashPreview}
                        </p>
                        <p className="mt-1 font-medium text-kuartz-navy">
                          Expires {formatDate(link.expiresAt)}
                        </p>
                      </div>
                      <StatusPill status={link.status} />
                    </div>
                  ))}
                </div>
              ) : (
                <p className="px-4 py-8 text-center text-sm text-kuartz-muted">
                  No links generated yet.
                </p>
              )}
            </div>
          </div>

          <div className="glass-panel rounded-[2rem] p-5 sm:p-6">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-xl font-extrabold text-kuartz-navy">Submitted enquiries</h2>
              <span className="rounded-full border border-kuartz-line bg-white/65 px-3 py-1 text-xs font-semibold text-kuartz-muted backdrop-blur-xl">
                {submissions.length}
              </span>
            </div>

            <div className="mt-5 overflow-hidden rounded-[1.5rem] border border-kuartz-line bg-white/55 backdrop-blur-xl">
              {submissions.length ? (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[720px] text-left text-sm">
                    <thead className="bg-white/70 text-xs text-kuartz-muted">
                      <tr>
                        <th className="px-4 py-3 font-semibold">Client</th>
                        <th className="px-4 py-3 font-semibold">Contact</th>
                        <th className="px-4 py-3 font-semibold">Event</th>
                        <th className="px-4 py-3 font-semibold">Budget</th>
                        <th className="px-4 py-3 font-semibold">Submitted</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-kuartz-line/80">
                      {submissions.map((submission) => (
                        <tr key={submission.id} className="align-top">
                          <td className="px-4 py-4">
                            <p className="font-semibold text-kuartz-navy">
                              {submission.fullName}
                            </p>
                            {submission.brief ? (
                              <p className="mt-1 max-w-64 text-xs leading-5 text-kuartz-muted">
                                {submission.brief}
                              </p>
                            ) : null}
                          </td>
                          <td className="px-4 py-4 text-kuartz-muted">
                            <p>{submission.primaryPhone}</p>
                            {submission.email ? <p>{submission.email}</p> : null}
                            <p>{submission.preferredContactChannel}</p>
                          </td>
                          <td className="px-4 py-4 font-medium text-kuartz-navy">
                            {submission.eventType}
                          </td>
                          <td className="px-4 py-4 font-medium text-kuartz-navy">
                            {submission.budgetRange}
                          </td>
                          <td className="px-4 py-4 text-kuartz-muted">
                            {formatDate(submission.submittedAt)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="px-4 py-8 text-center text-sm text-kuartz-muted">
                  No enquiries submitted yet.
                </p>
              )}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

function StatusPill({ status }: { status: LinkStatus }) {
  const classes = {
    Active: "border-emerald-200 bg-emerald-50 text-emerald-700",
    Used: "border-slate-200 bg-slate-100 text-slate-600",
    Expired: "border-rose-200 bg-rose-50 text-rose-700",
  }[status];

  return (
    <span
      className={`inline-flex w-fit items-center rounded-full border px-3 py-1 text-xs font-semibold backdrop-blur-xl ${classes}`}
    >
      {status}
    </span>
  );
}

function formatDate(timestamp: number) {
  return dateFormatter.format(new Date(timestamp));
}