// Pure — no I/O. The whole "missing measurement" rule is: a required field is missing if it
// isn't in the present set. Kept dependency-free so it's trivially unit-tested with plain arrays.
export function computeMissingFieldIds(requiredFieldIds: string[], presentFieldIds: Iterable<string>): string[] {
  const present = new Set(presentFieldIds);
  return requiredFieldIds.filter((id) => !present.has(id));
}
