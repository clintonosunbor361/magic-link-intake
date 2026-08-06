import Link from "next/link";
import { redirect } from "next/navigation";
import {
  archiveMeasurementRequirementAction,
  createMeasurementRequirementAction,
  restoreMeasurementRequirementAction,
} from "@/app/actions/item-type-measurement-requirements";
import { requireStaffSession } from "@/lib/auth/session";
import { canManageMeasurementRequirements } from "@/lib/domain/access-control";
import { listMeasurementFieldDefinitions } from "@/lib/measurement-field-definitions/repository";
import { listItemTypes } from "@/lib/item-types/repository";
import { listMeasurementRequirements } from "@/lib/item-type-measurement-requirements/repository";
import { Button } from "@/components/ui/button";

export default async function MeasurementRequirementsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await requireStaffSession();
  if (!canManageMeasurementRequirements(session.role)) redirect("/");
  const [itemTypes, fields, requirements, params] = await Promise.all([
    listItemTypes(session.organizationId),
    listMeasurementFieldDefinitions(session.organizationId),
    listMeasurementRequirements(session.organizationId, { includeArchived: true }),
    searchParams,
  ]);

  const requirementByPair = new Map(
    requirements.map((requirement) => [`${requirement.itemTypeId}:${requirement.fieldDefinitionId}`, requirement]),
  );

  return (
    <div>
      <header className="border-b border-[#d9d8d1] pb-8">
        <p className="eyebrow">Organization settings</p>
        <h1 className="page-title">Measurement requirements</h1>
        <p className="page-description">
          Choose which measurement fields are required for each item type. Staff see a warning on an Order when a
          required field is missing from the Client's measurement profile.
        </p>
      </header>

      <nav className="mt-6 flex gap-4 text-sm font-semibold">
        <Link href="/settings/team" className="text-[#50586c] hover:text-[#171b36]">
          Team
        </Link>
        <Link href="/settings/item-types" className="text-[#50586c] hover:text-[#171b36]">
          Item types
        </Link>
        <Link href="/settings/consultation-note-sources" className="text-[#50586c] hover:text-[#171b36]">
          Consultation note sources
        </Link>
        <Link href="/settings/measurement-fields" className="text-[#50586c] hover:text-[#171b36]">
          Measurement fields
        </Link>
        <Link href="/settings/measurement-requirements" className="text-[#171b36] underline">
          Measurement requirements
        </Link>
      </nav>

      {params.error ? (
        <p className="form-alert mt-6" role="alert">
          {params.error}
        </p>
      ) : null}

      {!itemTypes.length || !fields.length ? (
        <p className="mt-9 text-sm text-[#767b89]">
          Add at least one item type and one measurement field before configuring requirements.
        </p>
      ) : (
        <div className="mt-9 overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr>
                <th className="border-b border-[#d9d8d1] px-3 py-3 text-left font-semibold text-[#171b36]">
                  Field
                </th>
                {itemTypes.map((itemType) => (
                  <th
                    key={itemType.id}
                    className="border-b border-[#d9d8d1] px-3 py-3 text-center font-semibold text-[#171b36]"
                  >
                    {itemType.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {fields.map((field) => (
                <tr key={field.id} className="border-b border-[#d9d8d1]">
                  <th scope="row" className="px-3 py-3 text-left font-medium text-[#171b36]">
                    {field.name} <span className="font-normal text-[#767b89]">({field.unit})</span>
                  </th>
                  {itemTypes.map((itemType) => {
                    const requirement = requirementByPair.get(`${itemType.id}:${field.id}`);
                    const required = !!requirement && !requirement.archivedAt;
                    return (
                      <td key={itemType.id} className="px-3 py-3 text-center">
                        {required && requirement ? (
                          <form action={archiveMeasurementRequirementAction}>
                            <input type="hidden" name="requirementId" value={requirement.id} />
                            <input type="hidden" name="version" value={requirement.version} />
                            <Button
                              type="submit"
                              variant="outline"
                              aria-label={`Remove ${field.name} as required for ${itemType.name}`}
                            >
                              Required
                            </Button>
                          </form>
                        ) : requirement ? (
                          <form action={restoreMeasurementRequirementAction}>
                            <input type="hidden" name="requirementId" value={requirement.id} />
                            <input type="hidden" name="version" value={requirement.version} />
                            <Button
                              type="submit"
                              variant="outline"
                              aria-label={`Require ${field.name} for ${itemType.name}`}
                            >
                              Not required
                            </Button>
                          </form>
                        ) : (
                          <form action={createMeasurementRequirementAction}>
                            <input type="hidden" name="itemTypeId" value={itemType.id} />
                            <input type="hidden" name="fieldDefinitionId" value={field.id} />
                            <Button
                              type="submit"
                              variant="outline"
                              aria-label={`Require ${field.name} for ${itemType.name}`}
                            >
                              Not required
                            </Button>
                          </form>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
