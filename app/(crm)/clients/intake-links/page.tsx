import Link from "next/link";
import { requireStaffSession } from "@/lib/auth/session";
import { listMagicLinks, type LinkStatus } from "@/lib/magic-links";
import { LinkGenerator } from "@/components/link-generator";

export const dynamic = "force-dynamic";

const dateFormatter = new Intl.DateTimeFormat("en-NG", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Africa/Lagos",
});

export default async function GeneratedIntakeLinksPage() {
  const session = await requireStaffSession();
  const links = await listMagicLinks(session.organizationId);

  return (
    <div>
      <header className="grid min-w-0 gap-8 border-b border-kuartz-line pb-8 xl:grid-cols-[minmax(0,1fr)_18rem] xl:items-start">
        <div className="min-w-0">
          <p className="eyebrow">Clients</p>
          <h1 className="page-title">Generated intake links</h1>
          <p className="page-description">Track links sent to prospective clients and their submissions.</p>
        </div>
        <LinkGenerator />
      </header>

      <section className="mt-7">
        <div className="overflow-hidden rounded-[0.8rem] border border-kuartz-line">
          {links.length ? (
            links.map((link) => (
              <div
                key={link.id}
                className="grid gap-3 border-b border-kuartz-line bg-white/75 px-4 py-4 text-sm last:border-b-0 lg:grid-cols-[minmax(0,1fr)_10rem_14rem] lg:items-center"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold text-kuartz-ink">Generated {dateFormatter.format(new Date(link.createdAt))}</p>
                    <StatusPill status={link.status} />
                  </div>
                  <p className="mt-1 text-kuartz-secondary">
                    {link.generatedByName ? `Created by ${link.generatedByName}` : "Creator unavailable"} - Expires{" "}
                    {dateFormatter.format(new Date(link.expiresAt))}
                  </p>
                  <p className="mt-1 text-xs text-kuartz-muted">Token {link.hashPreview}</p>
                </div>
                <div>
                  {link.clientId && link.clientName ? (
                    <Link href={`/clients/${link.clientId}`} className="font-semibold text-kuartz-ink underline-offset-4 hover:underline">
                      {link.clientName}
                    </Link>
                  ) : (
                    <span className="text-kuartz-muted">No submission</span>
                  )}
                </div>
                <p className="text-kuartz-secondary lg:text-right">
                  {link.usedAt ? `Used ${dateFormatter.format(new Date(link.usedAt))}` : "Not used yet"}
                </p>
              </div>
            ))
          ) : (
            <p className="px-4 py-12 text-center text-sm text-kuartz-muted">No intake links generated yet.</p>
          )}
        </div>
      </section>
    </div>
  );
}

function StatusPill({ status }: { status: LinkStatus }) {
  const className =
    status === "Active"
      ? "border-[#b8ff45] bg-[#f4ffd7] text-kuartz-ink"
      : status === "Used"
        ? "border-kuartz-line bg-white text-kuartz-secondary"
        : "border-[#ead4c6] bg-[#fff4ec] text-[#9a4b21]";

  return <span className={`rounded-full border px-2.5 py-1 text-xs font-extrabold ${className}`}>{status}</span>;
}
