import Link from "next/link";
import { notFound } from "next/navigation";
import { markMeasurementConfirmationCopiedAction, sendMeasurementConfirmationEmailAction } from "@/app/actions/client-confirmations";
import { requireStaffSession } from "@/lib/auth/session";
import { getClient } from "@/lib/clients/repository";
import { getRequestOrigin } from "@/lib/request-origin";
import { CopyLinkButton } from "@/components/copy-link-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";

export default async function MeasurementConfirmationCreatedPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; confirmationId: string }>;
  searchParams: Promise<{ token?: string; error?: string; sent?: string; copied?: string }>;
}) {
  const session = await requireStaffSession();
  const { id, confirmationId } = await params;
  const { token, error, sent, copied } = await searchParams;

  const client = await getClient(session.organizationId, id);
  if (!client) notFound();

  const origin = await getRequestOrigin();
  const confirmationLink = token ? `${origin}/confirm/${encodeURIComponent(token)}` : null;

  return (
    <div>
      <Breadcrumbs items={[{ label: "Clients", href: "/clients" }, { label: client.fullName, href: `/clients/${client.id}` }, { label: "Share confirmation" }]} />
      <header className="border-b border-kuartz-line pb-8">
        <p className="eyebrow">Client</p>
        <h1 className="page-title">Measurement confirmation created</h1>
        <p className="page-description">
          <Link href={`/clients/${client.id}`} className="hover:underline">
            {client.fullName}
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
            <p className="eyebrow">Measurements · {client.fullName}</p><h2 className="section-title mt-2">Share another way</h2>
            <p className="mt-2 text-sm text-kuartz-muted">
              This link is shown only once — send it now or copy it. Sending another confirmation for this Client
              invalidates this link.
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <code className="w-full break-all rounded-[0.6rem] border border-kuartz-line bg-white/70 px-3 py-2 text-sm">{confirmationLink}</code>
              <form action={markMeasurementConfirmationCopiedAction}>
                <input type="hidden" name="clientId" value={client.id} />
                <input type="hidden" name="confirmationId" value={confirmationId} />
                <input type="hidden" name="token" value={token} />
                <CopyLinkButton url={confirmationLink} submitAfterCopy />
              </form>
            </div>
          </div>

          <form action={sendMeasurementConfirmationEmailAction} className="space-y-3 border border-kuartz-line bg-white/55 p-5">
            <input type="hidden" name="clientId" value={client.id} />
            <input type="hidden" name="confirmationId" value={confirmationId} />
            <input type="hidden" name="token" value={token} />
            <input type="hidden" name="clientName" value={client.fullName} />
            <p className="eyebrow">Expires after seven days</p><h3 className="section-title mt-2">Send by email</h3>
            <label className="form-group">
              <span>Recipient email</span>
              <Input type="email" name="recipientEmail" defaultValue={client.email ?? ""} required />
            </label>
            <Button type="submit" variant="outline">
              Send
            </Button>
          </form>
          <div className="lg:col-span-2"><Button asChild variant="ghost"><Link href={`/clients/${client.id}`}>Done</Link></Button></div>
        </section>
      ) : (
        <p className="mt-6 text-sm text-kuartz-muted">
          This link is no longer available to display. Check the Measurement confirmations list on the Client page, or
          send a new confirmation if the client still needs to confirm.
        </p>
      )}
    </div>
  );
}
