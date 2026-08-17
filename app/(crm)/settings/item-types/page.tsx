import Link from "next/link";
import { redirect } from "next/navigation";
import { archiveItemTypeAction, createItemTypeAction, restoreItemTypeAction } from "@/app/actions/item-types";
import { requireStaffSession } from "@/lib/auth/session";
import { canManageItemTypes } from "@/lib/domain/access-control";
import { listItemTypes } from "@/lib/item-types/repository";
import { Button } from "@/components/ui/button";
import { FormDisclosure } from "@/components/ui/form-disclosure";
import { Input } from "@/components/ui/input";

export default async function ItemTypesPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await requireStaffSession();
  if (!canManageItemTypes(session.role)) redirect("/");
  const [itemTypes, params] = await Promise.all([
    listItemTypes(session.organizationId, { includeArchived: true }),
    searchParams,
  ]);
  const nextSortOrder = itemTypes.length
    ? Math.max(...itemTypes.map((itemType) => itemType.sortOrder)) + 1
    : 0;

  return (
    <div>
      <header className="border-b border-kuartz-line pb-8">
        <p className="eyebrow">Organization settings</p>
        <h1 className="page-title">Item types</h1>
        <p className="page-description">
          Manage the list of garment types staff can select when adding an Item to a Look.
        </p>
      </header>

      <nav className="mt-6 flex gap-4 text-sm font-semibold">
        <Link href="/settings/team" className="text-kuartz-secondary hover:text-kuartz-ink">
          Team
        </Link>
        <Link href="/settings/item-types" className="text-kuartz-ink underline">
          Item types
        </Link>
        <Link href="/settings/consultation-note-sources" className="text-kuartz-secondary hover:text-kuartz-ink">
          Consultation note sources
        </Link>
        <Link href="/settings/measurement-fields" className="text-kuartz-secondary hover:text-kuartz-ink">
          Measurement fields
        </Link>
        <Link href="/settings/measurement-requirements" className="text-kuartz-secondary hover:text-kuartz-ink">
          Measurement requirements
        </Link>
      </nav>

      {params.error ? (
        <p className="form-alert mt-6" role="alert">
          {params.error}
        </p>
      ) : null}

      <section className="mt-9 grid gap-10 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <div>
          <h2 className="section-title">Configured types</h2>
          <div role="list" className="mt-4 divide-y divide-kuartz-line border-y border-kuartz-line">
            {itemTypes.map((itemType) => (
              <div
                key={itemType.id}
                role="listitem"
                aria-label={itemType.name}
                className="grid gap-4 py-5 md:grid-cols-[minmax(0,1fr)_auto] md:items-center"
              >
                <div>
                  <p className="font-semibold text-kuartz-ink">{itemType.name}</p>
                  {itemType.archivedAt ? <p className="mt-1 text-sm text-kuartz-muted">Archived</p> : null}
                </div>
                <form action={itemType.archivedAt ? restoreItemTypeAction : archiveItemTypeAction}>
                  <input type="hidden" name="itemTypeId" value={itemType.id} />
                  <input type="hidden" name="version" value={itemType.version} />
                  <Button
                    type="submit"
                    variant="outline"
                    aria-label={`${itemType.archivedAt ? "Restore" : "Archive"} ${itemType.name}`}
                  >
                    {itemType.archivedAt ? "Restore" : "Archive"}
                  </Button>
                </form>
              </div>
            ))}
          </div>
        </div>
        <aside>
          <FormDisclosure title="Item types" buttonLabel="Add item type">
          <form action={createItemTypeAction} className="space-y-4 border-t border-kuartz-line pt-5">
            <input type="hidden" name="sortOrder" value={nextSortOrder} />
            <label className="form-group">
              <span>Name</span>
              <Input name="name" required />
            </label>
            <Button className="w-full" type="submit">
              Add item type
            </Button>
          </form>
          </FormDisclosure>
        </aside>
      </section>
    </div>
  );
}
