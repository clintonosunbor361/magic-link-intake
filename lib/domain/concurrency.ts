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
