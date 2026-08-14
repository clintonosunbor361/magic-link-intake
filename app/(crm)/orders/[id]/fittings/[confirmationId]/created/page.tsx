import Link from "next/link";
import { notFound } from "next/navigation";
import {
  markFittingConfirmationCopiedAction,
  sendFittingConfirmationEmailAction,
} from "@/app/actions/client-confirmations";
import { CopyLinkButton } from "@/components/copy-link-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { requireStaffSession } from "@/lib/auth/session";
import { getOrder } from "@/lib/orders/repository";
import { getRequestOrigin } from "@/lib/request-origin";

export default async function FittingConfirmationCreatedPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; confirmationId: string }>;
  searchParams: Promise<{ token?: string; error?: string; sent?: string; copied?: string }>;
}) {
  const session = await requireStaffSession();
  const { id, confirmationId } = await params;
  const { token, error, sent, copied } = await searchParams;

  const order = await getOrder(session.organizationId, id);
  if (!order) notFound();

  const origin = await getRequestOrigin();
  const confirmationLink = token ? `${origin}/confirm/${encodeURIComponent(token)}` : null;

  return (
    <div>
      <Breadcrumbs items={[{ label: "Orders", href: "/orders" }, { label: order.title, href: `/orders/${order.id}` }, { label: "Fittings", href: `/orders/${order.id}/fittings` }, { label: "Share confirmation" }]} />
      <header className="border-b border-kuartz-line pb-8">
        <p className="eyebrow">Fittings</p>
        <h1 className="page-title">Fitting confirmation created</h1>
        <p className="page-description">
          <Link href={`/orders/${order.id}/fittings`} className="hover:underline">
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

      {confirmationLink ? (
        <section className="mt-9 grid gap-6 lg:grid-cols-2">
          <div className="border border-kuartz-line bg-white/55 p-5">
            <p className="eyebrow">Fitting outcome · {order.clientFullName}</p><h2 className="section-title mt-2">Share another way</h2>
            <p className="mt-2 text-sm text-kuartz-muted">
              This link is shown only once — send it now or copy it. Sending another confirmation for
              this Fitting invalidates this link, and it expires after seven days.
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <code className="w-full break-all rounded-[0.6rem] border border-kuartz-line bg-white/70 px-3 py-2 text-sm">
                {confirmationLink}
              </code>
              <form action={markFittingConfirmationCopiedAction}>
                <input type="hidden" name="orderId" value={order.id} />
                <input type="hidden" name="confirmationId" value={confirmationId} />
                <input type="hidden" name="token" value={token} />
                <CopyLinkButton url={confirmationLink} submitAfterCopy />
              </form>
            </div>
          </div>

          <form action={sendFittingConfirmationEmailAction} className="space-y-3 border border-kuartz-line bg-white/55 p-5">
            <input type="hidden" name="orderId" value={order.id} />
            <input type="hidden" name="confirmationId" value={confirmationId} />
            <input type="hidden" name="token" value={token} />
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
          <div className="lg:col-span-2"><Button asChild variant="ghost"><Link href={`/orders/${order.id}/fittings`}>Done</Link></Button></div>
        </section>
      ) : (
        <p className="mt-6 text-sm text-kuartz-muted">
          This link is no longer available to display. Send a new confirmation from the Fittings page
          if the client still needs to confirm.
        </p>
      )}
    </div>
  );
}
