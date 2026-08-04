import { LinkGenerator } from "@/components/link-generator";
import { EmptyState } from "@/components/ui/empty-state";
import { listMagicLinks, listSubmissions, type LinkStatus } from "@/lib/magic-links";

export const dynamic = "force-dynamic";

const dateFormatter = new Intl.DateTimeFormat("en-NG", {
  dateStyle: "medium",
  timeStyle: "short",
});

export default async function LegacyIntakeLinksPage() {
  const [links, submissions] = await Promise.all([listMagicLinks(), listSubmissions()]);
  return (
    <div>
      <header className="grid gap-8 border-b border-[#d9d8d1] pb-8 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
        <div>
          <div className="flex items-center gap-3"><p className="eyebrow">Enquiry intake</p><span className="rounded-full border border-[#c9c8c1] px-2 py-1 font-mono text-[0.62rem] uppercase tracking-[0.14em] text-[#50586c]">Legacy</span></div>
          <h1 className="page-title">Intake links</h1>
          <p className="page-description">Keep the existing one-use Redis intake flow running until Milestone 1 migrates submissions into Postgres Enquiries.</p>
        </div>
        <LinkGenerator />
      </header>

      <section className="mt-9 grid gap-10 xl:grid-cols-[0.8fr_1.2fr]">
        <div>
          <div className="flex items-center justify-between"><h2 className="section-title">Generated links</h2><span className="font-mono text-xs text-[#7a7f8c]">{links.length}</span></div>
          {links.length ? <div className="mt-4 divide-y divide-[#d9d8d1] border-y border-[#d9d8d1]">{links.map((link) => <div key={link.id} className="grid gap-2 py-4 sm:grid-cols-[1fr_auto] sm:items-center"><div><p className="font-mono text-xs text-[#7a7f8c]">hash {link.hashPreview}</p><p className="mt-1 text-sm font-medium text-[#171b36]">Expires {dateFormatter.format(new Date(link.expiresAt))}</p></div><StatusPill status={link.status} /></div>)}</div> : <EmptyState className="mt-4" title="No links generated" description="Generate a one-use link when a prospective Client is ready to complete intake." />}
        </div>

        <div>
          <div className="flex items-center justify-between"><h2 className="section-title">Submitted Enquiries</h2><span className="font-mono text-xs text-[#7a7f8c]">{submissions.length}</span></div>
          {submissions.length ? <div className="mt-4 overflow-x-auto border-y border-[#d9d8d1]"><table className="w-full min-w-[680px] text-left text-sm"><thead className="text-xs text-[#777d8d]"><tr><th className="py-3 pr-4 font-semibold">Person</th><th className="px-4 py-3 font-semibold">Contact</th><th className="px-4 py-3 font-semibold">Event</th><th className="pl-4 py-3 font-semibold">Submitted</th></tr></thead><tbody className="divide-y divide-[#d9d8d1]">{submissions.map((submission) => <tr key={submission.id}><td className="py-4 pr-4 font-semibold text-[#171b36]">{submission.fullName}</td><td className="px-4 py-4 text-[#6e7482]">{submission.primaryPhone}</td><td className="px-4 py-4 text-[#171b36]">{submission.eventType}</td><td className="pl-4 py-4 text-[#6e7482]">{dateFormatter.format(new Date(submission.submittedAt))}</td></tr>)}</tbody></table></div> : <EmptyState className="mt-4" title="No submitted Enquiries" description="Completed intake forms will remain visible here during the Postgres migration." />}
        </div>
      </section>
    </div>
  );
}

function StatusPill({ status }: { status: LinkStatus }) {
  const styles = {
    Active: "border-[#afc67d] bg-[#eaf5cf] text-[#4f6528]",
    Used: "border-[#d2d1ca] bg-white/55 text-[#6f7480]",
    Expired: "border-[#d9aaa7] bg-[#f7e5e3] text-[#7e403d]",
  }[status];
  return <span className={`w-fit rounded-full border px-3 py-1 text-xs font-bold ${styles}`}>{status}</span>;
}
