import Link from "next/link";
import { notFound } from "next/navigation";
import { BriefBuilder } from "@/components/vendor-briefs/brief-builder";
import { requireStaffSession } from "@/lib/auth/session";
import { canOverrideBriefBlocker } from "@/lib/domain/access-control";
import { computeBriefBlocker } from "@/lib/vendor-briefs/document";
import { getVendorBriefContext } from "@/lib/vendor-briefs/repository";

export default async function VendorBriefPage({ params }: { params: Promise<{ assignmentId: string }> }) {
  const session = await requireStaffSession();
  const { assignmentId } = await params;

  const context = await getVendorBriefContext(session.organizationId, assignmentId);
  if (!context) notFound();

  // Computed here for the initial render; the export route recomputes it server-side, so a stale
  // page cannot talk its way past the block.
  const blocker = computeBriefBlocker(context.sources);

  return (
    <div>
      <Link
        href={`/production/${assignmentId}`}
        className="text-sm font-semibold text-kuartz-secondary underline-offset-4 transition-colors duration-200 hover:text-kuartz-ink hover:underline"
      >
        ← Assignment
      </Link>

      <header className="mt-4 border-b border-kuartz-line pb-8">
        <p className="eyebrow">Vendor Brief</p>
        <h1 className="page-title">Build the brief</h1>
        <p className="page-description">
          Pick what this Vendor sees, adjust anything for this PDF only, then export and send it on
          by WhatsApp or email. Nothing here changes the underlying records.
        </p>
      </header>

      <section className="mt-9">
        <BriefBuilder
          assignmentId={assignmentId}
          sources={context.sources}
          blocker={blocker ? { missingLabels: blocker.missingLabels } : null}
          canOverride={canOverrideBriefBlocker(session.role)}
        />
      </section>
    </div>
  );
}
