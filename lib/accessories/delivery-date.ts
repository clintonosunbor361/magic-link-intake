// Only a linked active Look supplies a deadline. Whole-Order accessories have no inferred date.

export type LookDateSource = { id: string; lookDate: string | null; archivedAt: Date | null };

export type AccessoryDeliveryDate =
  | { state: "none" }
  | { state: "inherited"; date: string; sourceLookId: string };

export function resolveAccessoryDeliveryDate(input: {
  lookId: string | null;
  looks: readonly LookDateSource[];
}): AccessoryDeliveryDate {
  const liveDated = input.looks.filter(
    (look): look is LookDateSource & { lookDate: string } => !look.archivedAt && look.lookDate !== null,
  );

  if (input.lookId) {
    // A Look-scoped Accessory takes its own Look's date and nothing else. If that Look is archived
    // or has no date, the Accessory simply has no date — it does not silently fall back to a
    // different Look's deadline, which would attach the accessory to an event it is not for.
    const linked = liveDated.find((look) => look.id === input.lookId);
    return linked ? { state: "inherited", date: linked.lookDate, sourceLookId: linked.id } : { state: "none" };
  }

  return { state: "none" };
}
