import Link from "next/link";
import { notFound } from "next/navigation";
import { markApprovalBatchCopiedAction, sendApprovalBatchEmailAction } from "@/app/actions/style-direction-approvals";
import { requireStaffSession } from "@/lib/auth/session";
import { getOrder } from "@/lib/orders/repository";
import { getRequestOrigin } from "@/lib/request-origin";
import { CopyLinkButton } from "@/components/copy-link-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";

export default async function ApprovalBatchCreatedPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; batchId: string }>;
  searchParams: Promise<{ token?: string; error?: string; sent?: string; copied?: string }>;
}) {
  const session = await requireStaffSession();
  const { id, batchId } = await params;
  const { token, error, sent, copied } = await searchParams;

  const order = await getOrder(session.organizationId, id);
  if (!order) notFound();

  const origin = await getRequestOrigin();
  const approvalLink = token ? `${origin}/approve/${encodeURIComponent(token)}` : null;

  return (
    <div>
      <Breadcrumbs items={[{ label: "Orders", href: "/orders" }, { label: order.title, href: `/orders/${order.id}` }, { label: "Share approval" }]} />
      <header className="border-b border-kuartz-line pb-8">
        <p className="eyebrow">Order</p>
        <h1 className="page-title">Approval batch created</h1>
        <p className="page-description">
          <Link href={`/orders/${order.id}`} className="hover:underline">
            {order.title}
          </Link>
        </p>
      </header>

      {error ? (
        <p className="form-alert mt-6" role="alert">
          {error}
        </p>
      ) : null}
      {sent ? <p className="form-success mt-6">Email sent.</p> : null}
      {copied ? <p className="form-success mt-6">Marked as copied.</p> : null}

      {approvalLink ? (
        <section className="mt-9 grid gap-6 lg:grid-cols-2">
          <div className="border border-kuartz-line bg-white/55 p-5">
            <p className="eyebrow">Style Direction approval · {order.clientFullName}</p><h2 className="section-title mt-2">Share another way</h2>
            <p className="mt-2 text-sm text-kuartz-muted">
              This link is shown only once. Send it now or copy it. Creating another batch for this order invalidates
              this link.
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <code className="w-full break-all rounded-[0.6rem] border border-kuartz-line bg-white/70 px-3 py-2 text-sm">{approvalLink}</code>
              <form action={markApprovalBatchCopiedAction}>
                <input type="hidden" name="orderId" value={order.id} />
                <input type="hidden" name="batchId" value={batchId} />
                <input type="hidden" name="token" value={token} />
                <CopyLinkButton url={approvalLink} submitAfterCopy />
              </form>
            </div>
          </div>

          <form action={sendApprovalBatchEmailAction} className="space-y-3 border border-kuartz-line bg-white/55 p-5">
            <input type="hidden" name="orderId" value={order.id} />
            <input type="hidden" name="batchId" value={batchId} />
            <input type="hidden" name="token" value={token} />
            <input type="hidden" name="orderTitle" value={order.title} />
            <input type="hidden" name="clientName" value={order.clientFullName} />
            <p className="eyebrow">Expires after seven days</p><h3 className="section-title mt-2">Send by email</h3>
            <label className="form-group">
              <span>Recipient email</span>
              <Input type="email" name="recipientEmail" defaultValue={order.clientEmail ?? ""} required />
            </label>
            <Button type="submit" variant="outline">
              Send
            </Button>
          </form>
          <div className="lg:col-span-2"><Button asChild variant="ghost"><Link href={`/orders/${order.id}`}>Done</Link></Button></div>
        </section>
      ) : (
        <p className="mt-6 text-sm text-kuartz-muted">
          This link is no longer available to display. Check the Approval batches list on the Order page, or create a
          new batch if the client still needs to decide.
        </p>
      )}
    </div>
  );
}
