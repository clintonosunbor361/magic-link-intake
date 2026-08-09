// The inherited delivery date, isolated as a pure function.
//
// The spec says an Accessory's delivery date follows the linked Look's due date and that accessories
// need no separate dates of their own. It does not say what a whole-Order Accessory inherits, which
// is the gap ticket 31 exists to close: the answer is the earliest dated live Look, because a
// whole-Order accessory has to be in hand by the first event it could be needed at.
//
// Nothing is stored. A Look moving, being archived, or gaining a date changes the answer on the next
// read, so an Accessory can never advertise a deadline its Look no longer has.

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

  const earliest = liveDated.reduce<(LookDateSource & { lookDate: string }) | null>(
    (best, look) => (best === null || look.lookDate < best.lookDate ? look : best),
    null,
  );

  return earliest
    ? { state: "inherited", date: earliest.lookDate, sourceLookId: earliest.id }
    : { state: "none" };
}
