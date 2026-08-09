import Link from "next/link";
import { notFound } from "next/navigation";
import { markOrderConfirmationCopiedAction, sendOrderConfirmationEmailAction } from "@/app/actions/client-confirmations";
import { requireStaffSession } from "@/lib/auth/session";
import { getOrder } from "@/lib/orders/repository";
import { getRequestOrigin } from "@/lib/request-origin";
import { CopyLinkButton } from "@/components/copy-link-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default async function OrderConfirmationCreatedPage({
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
      <header className="border-b border-kuartz-line pb-8">
        <p className="eyebrow">Order</p>
        <h1 className="page-title">Order confirmation created</h1>
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

      {confirmationLink ? (
        <section className="mt-9 space-y-8">
          <div>
            <h2 className="section-title">Confirmation link</h2>
            <p className="mt-2 text-sm text-kuartz-muted">
              This link is shown only once — send it now or copy it. Sending another confirmation for this Order
              invalidates this link.
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <code className="rounded-[0.6rem] border border-kuartz-line bg-white/70 px-3 py-2 text-sm">{confirmationLink}</code>
              <CopyLinkButton url={confirmationLink} />
              <form action={markOrderConfirmationCopiedAction}>
                <input type="hidden" name="orderId" value={order.id} />
                <input type="hidden" name="confirmationId" value={confirmationId} />
                <input type="hidden" name="token" value={token} />
                <Button type="submit" variant="ghost">
                  Mark as copied for WhatsApp
                </Button>
              </form>
            </div>
          </div>

          <form action={sendOrderConfirmationEmailAction} className="space-y-3">
            <input type="hidden" name="orderId" value={order.id} />
            <input type="hidden" name="confirmationId" value={confirmationId} />
            <input type="hidden" name="token" value={token} />
            <input type="hidden" name="clientName" value={order.clientFullName} />
            <h3 className="section-title">Send via email</h3>
            <label className="form-group">
              <span>Recipient email</span>
              <Input type="email" name="recipientEmail" defaultValue={order.clientEmail ?? ""} required />
            </label>
            <Button type="submit" variant="outline">
              Send
            </Button>
          </form>
        </section>
      ) : (
        <p className="mt-6 text-sm text-kuartz-muted">
          This link is no longer available to display. Check the Order confirmations list on the Order page, or send a
          new confirmation if the client still needs to confirm.
        </p>
      )}
    </div>
  );
}
