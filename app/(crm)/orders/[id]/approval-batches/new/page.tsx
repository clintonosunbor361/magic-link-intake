import Link from "next/link";
import { notFound } from "next/navigation";
import { createApprovalBatchAction } from "@/app/actions/style-direction-approvals";
import { requireStaffSession } from "@/lib/auth/session";
import { getOrder } from "@/lib/orders/repository";
import { listEligibleFilesForBatch, type EligibleApprovalFile } from "@/lib/style-direction-approvals/batch-service";
import { createStyleDirectionApprovalRepository } from "@/lib/style-direction-approvals/repository";
import { formatStyleDirectionLabel } from "@/lib/style-direction-files/file-service";
import { Button } from "@/components/ui/button";

export default async function NewApprovalBatchPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await requireStaffSession();
  const { id } = await params;
  const { error } = await searchParams;

  const order = await getOrder(session.organizationId, id);
  if (!order) notFound();

  const eligibleFiles = await listEligibleFilesForBatch(session.organizationId, id, createStyleDirectionApprovalRepository());
  const wholeOrderFiles = eligibleFiles.filter((file) => !file.lookId);
  const lookGroups: { lookId: string; lookName: string; files: EligibleApprovalFile[] }[] = [];
  for (const file of eligibleFiles) {
    if (!file.lookId) continue;
    let group = lookGroups.find((candidate) => candidate.lookId === file.lookId);
    if (!group) {
      group = { lookId: file.lookId, lookName: file.lookName ?? "Look", files: [] };
      lookGroups.push(group);
    }
    group.files.push(file);
  }

  return (
    <div>
      <header className="border-b border-[#d9d8d1] pb-8">
        <p className="eyebrow">Order</p>
        <h1 className="page-title">Create an approval batch</h1>
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

      {eligibleFiles.length === 0 ? (
        <p className="mt-6 text-sm text-[#767b89]">
          No files are currently eligible for a new approval batch. A file becomes eligible once it requires client
          approval and has a Pending status.
        </p>
      ) : (
        <form action={createApprovalBatchAction} className="mt-9 space-y-6">
          <input type="hidden" name="orderId" value={order.id} />

          {wholeOrderFiles.length ? (
            <div>
              <h2 className="section-title">Whole Order</h2>
              <div className="mt-3 space-y-2">
                {wholeOrderFiles.map((file) => (
                  <label key={file.fileId} className="flex items-center gap-2 text-sm text-[#171b36]">
                    <input type="checkbox" name="fileIds" value={file.fileId} />
                    {formatStyleDirectionLabel(file.category)}
                  </label>
                ))}
              </div>
            </div>
          ) : null}

          {lookGroups.map((group) => (
            <div key={group.lookId}>
              <h2 className="section-title">{group.lookName}</h2>
              <div className="mt-3 space-y-2">
                {group.files.map((file) => (
                  <label key={file.fileId} className="flex items-center gap-2 text-sm text-[#171b36]">
                    <input type="checkbox" name="fileIds" value={file.fileId} />
                    {formatStyleDirectionLabel(file.category)}
                  </label>
                ))}
              </div>
            </div>
          ))}

          <Button type="submit" variant="outline">
            Create approval batch
          </Button>
        </form>
      )}
    </div>
  );
}
