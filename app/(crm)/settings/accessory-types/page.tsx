import { redirect } from "next/navigation";
import {
  archiveAccessoryTypeAction,
  createAccessoryTypeAction,
  restoreAccessoryTypeAction,
} from "@/app/actions/accessory-types";
import { SettingsNav } from "@/components/settings-nav";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { listAccessoryTypes } from "@/lib/accessory-types/repository";
import { requireStaffSession } from "@/lib/auth/session";
import { canManageAccessoryTypes } from "@/lib/domain/access-control";

export default async function AccessoryTypesPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await requireStaffSession();
  if (!canManageAccessoryTypes(session.role)) redirect("/");

  const [types, params] = await Promise.all([
    listAccessoryTypes(session.organizationId, { includeArchived: true }),
    searchParams,
  ]);
  const nextSortOrder = types.length ? Math.max(...types.map((type) => type.sortOrder)) + 1 : 0;

  return (
    <div>
      <header className="border-b border-[#d9d8d1] pb-8">
        <p className="eyebrow">Organization settings</p>
        <h1 className="page-title">Accessory types</h1>
        <p className="page-description">
          The list staff choose from when sourcing an Accessory. Any Accessory can also carry its own
          label, which is how one-off items are recorded without adding a type for each.
        </p>
      </header>

      <SettingsNav current="/settings/accessory-types" />

      {params.error ? (
        <p className="form-alert mt-6" role="alert">
          {params.error}
        </p>
      ) : null}

      <section className="mt-9 grid gap-10 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <div>
          <h2 className="section-title">Configured types</h2>
          {types.length ? (
            <div role="list" className="mt-4 divide-y divide-[#d9d8d1] border-y border-[#d9d8d1]">
              {types.map((type) => (
                <div
                  key={type.id}
                  role="listitem"
                  aria-label={type.name}
                  className="grid gap-4 py-5 md:grid-cols-[minmax(0,1fr)_auto] md:items-center"
                >
                  <div>
                    <p className="font-semibold text-[#171b36]">{type.name}</p>
                    {type.archivedAt ? <p className="mt-1 text-sm text-[#767b89]">Archived</p> : null}
                  </div>
                  <form action={type.archivedAt ? restoreAccessoryTypeAction : archiveAccessoryTypeAction}>
                    <input type="hidden" name="accessoryTypeId" value={type.id} />
                    <input type="hidden" name="version" value={type.version} />
                    <Button
                      type="submit"
                      variant="outline"
                      aria-label={`${type.archivedAt ? "Restore" : "Archive"} ${type.name}`}
                    >
                      {type.archivedAt ? "Restore" : "Archive"}
                    </Button>
                  </form>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              className="mt-4"
              title="No accessory types yet"
              description="Add the first type so staff can start sourcing accessories."
            />
          )}
        </div>

        <aside>
          <h2 className="section-title">Add a type</h2>
          <form action={createAccessoryTypeAction} className="mt-4 space-y-4 border-t border-[#d9d8d1] pt-5">
            <input type="hidden" name="sortOrder" value={nextSortOrder} />
            <label className="form-group">
              <span>Name</span>
              <Input name="name" required />
            </label>
            <Button className="w-full" type="submit">
              Add accessory type
            </Button>
          </form>
        </aside>
      </section>
    </div>
  );
}
