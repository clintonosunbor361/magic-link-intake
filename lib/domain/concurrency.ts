export type VersionedUpdateResult<T> =
  | { ok: true; nextVersion: number }
  | {
      ok: false;
      conflict: "stale_version";
      currentVersion: number;
      submittedInput: T | undefined;
    };

export function resolveVersionedUpdate<T = unknown>(input: {
  expectedVersion: number;
  currentVersion: number;
  submittedInput?: T;
}): VersionedUpdateResult<T> {
  if (input.expectedVersion === input.currentVersion) {
    return { ok: true, nextVersion: input.currentVersion + 1 };
  }

  return {
    ok: false,
    conflict: "stale_version",
    currentVersion: input.currentVersion,
    submittedInput: input.submittedInput,
  };
}

// Shared shape behind every archive/restore-style service action: fetch the
// current version, reject if the record is gone or the caller's version is
// stale, then persist. Services vary in what "fetch" and "persist" mean
// (a plain UPDATE, an update guarded by a sibling-count invariant, etc.), so
// those are supplied by the caller rather than baked in here.
export async function resolveVersionedTransition(input: {
  expectedVersion: number;
  fetchCurrent: () => Promise<{ version: number } | null>;
  notFoundMessage: string;
  staleMessage: string;
  persist: (nextVersion: number) => Promise<void>;
}): Promise<{ ok: true; nextVersion: number }> {
  const current = await input.fetchCurrent();
  if (!current) throw new Error(input.notFoundMessage);

  const version = resolveVersionedUpdate({
    expectedVersion: input.expectedVersion,
    currentVersion: current.version,
  });
  if (!version.ok) throw new Error(input.staleMessage);

  await input.persist(version.nextVersion);

  return { ok: true, nextVersion: version.nextVersion };
}
