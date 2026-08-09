/** Produce bytes before recording that they left the system. Rendering failure writes no metadata. */
export async function renderThenRecordExport(
  render: () => Promise<Buffer>,
  record: () => Promise<unknown>,
): Promise<Buffer> {
  const bytes = await render();
  await record();
  return bytes;
}
