"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireStaffSession } from "@/lib/auth/session";
import { readFormString } from "@/lib/forms/read-string";
import { safeReturnPath, withReturnError } from "@/lib/forms/return-path";
import { createStyleDirectionFileRepository, createStyleDirectionStorage } from "@/lib/style-direction-files/repository";
import {
  addStyleDirectionFileRevision,
  archiveStyleDirectionFile,
  createStyleDirectionFile,
  restoreStyleDirectionFile,
  STYLE_DIRECTION_FILE_CATEGORIES,
  type StyleDirectionFileCategory,
} from "@/lib/style-direction-files/file-service";

function categoryValue(formData: FormData): StyleDirectionFileCategory {
  const candidate = readFormString(formData, "category");
  if (!STYLE_DIRECTION_FILE_CATEGORIES.includes(candidate as StyleDirectionFileCategory)) {
    throw new Error("Select a valid category.");
  }
  return candidate as StyleDirectionFileCategory;
}

async function readUploadedFile(formData: FormData): Promise<{ buffer: Buffer; declaredMimeType: string }> {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) throw new Error("Choose a file to upload.");
  return { buffer: Buffer.from(await file.arrayBuffer()), declaredMimeType: file.type };
}

export async function uploadStyleDirectionFileAction(formData: FormData) {
  const session = await requireStaffSession();
  const orderId = readFormString(formData, "orderId");
  const returnTo = safeReturnPath(readFormString(formData, "returnTo"), `/orders/${orderId}?tab=style`);

  try {
    const upload = await readUploadedFile(formData);
    await createStyleDirectionFile(
      {
        organizationId: session.organizationId,
        orderId,
        lookId: readFormString(formData, "lookId") || null,
        category: categoryValue(formData),
        requiresClientApproval: formData.get("requiresClientApproval") === "on",
        uploadedByStaffId: session.userId,
      },
      upload,
      createStyleDirectionFileRepository(),
      createStyleDirectionStorage(),
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "The Style Direction File could not be uploaded.";
    redirect(withReturnError(returnTo, message));
  }

  revalidatePath(`/orders/${orderId}`);
  redirect(returnTo);
}

export async function reviseStyleDirectionFileAction(formData: FormData) {
  const session = await requireStaffSession();
  const orderId = readFormString(formData, "orderId");
  const fileId = readFormString(formData, "fileId");
  const expectedVersion = Number(readFormString(formData, "version"));
  const returnTo = safeReturnPath(readFormString(formData, "returnTo"), `/orders/${orderId}?tab=style`);

  try {
    const upload = await readUploadedFile(formData);
    await addStyleDirectionFileRevision(
      { organizationId: session.organizationId, fileId, expectedVersion, uploadedByStaffId: session.userId },
      upload,
      createStyleDirectionFileRepository(),
      createStyleDirectionStorage(),
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "The Style Direction File could not be revised.";
    redirect(withReturnError(returnTo, message));
  }

  revalidatePath(`/orders/${orderId}`);
  redirect(returnTo);
}

export async function archiveStyleDirectionFileAction(formData: FormData) {
  const session = await requireStaffSession();
  const orderId = readFormString(formData, "orderId");
  const fileId = readFormString(formData, "fileId");
  const expectedVersion = Number(readFormString(formData, "version"));
  const returnTo = safeReturnPath(readFormString(formData, "returnTo"), `/orders/${orderId}?tab=style`);

  try {
    await archiveStyleDirectionFile(
      { actor: { organizationId: session.organizationId, role: session.role }, fileId, expectedVersion },
      createStyleDirectionFileRepository(),
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "The Style Direction File could not be updated.";
    redirect(withReturnError(returnTo, message));
  }

  revalidatePath(`/orders/${orderId}`);
  redirect(returnTo);
}

export async function restoreStyleDirectionFileAction(formData: FormData) {
  const session = await requireStaffSession();
  const orderId = readFormString(formData, "orderId");
  const fileId = readFormString(formData, "fileId");
  const expectedVersion = Number(readFormString(formData, "version"));
  const returnTo = safeReturnPath(readFormString(formData, "returnTo"), `/orders/${orderId}?tab=style`);

  try {
    await restoreStyleDirectionFile(
      { actor: { organizationId: session.organizationId, role: session.role }, fileId, expectedVersion },
      createStyleDirectionFileRepository(),
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "The Style Direction File could not be updated.";
    redirect(withReturnError(returnTo, message));
  }

  revalidatePath(`/orders/${orderId}`);
  redirect(returnTo);
}
