import { generateToken, hashToken } from "@/lib/tokens";

const CONFIRMATION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export type ClientConfirmationSubjectType = "measurement_profile" | "order_detail" | "fitting_session";

export type ClientConfirmationForDelivery = { id: string; tokenHash: string };

export type ClientConfirmationRepository = {
  subjectExists(organizationId: string, subjectType: ClientConfirmationSubjectType, subjectId: string): Promise<boolean>;
  createConfirmationAndInvalidatePrior(input: {
    organizationId: string;
    subjectType: ClientConfirmationSubjectType;
    subjectId: string;
    createdByStaffId: string;
    tokenHash: string;
    expiresAt: Date;
  }): Promise<{ confirmationId: string }>;
  getConfirmationForDelivery(organizationId: string, confirmationId: string): Promise<ClientConfirmationForDelivery | null>;
  markDelivered(input: {
    organizationId: string;
    confirmationId: string;
    actorId: string;
    method: "email" | "copy_link";
    recipientEmail?: string;
  }): Promise<void>;
};

export type ConfirmationEmailSender = {
  sendConfirmationEmail(input: { to: string; confirmationUrl: string; subjectLabel: string; clientName: string }): Promise<void>;
};

export async function issueConfirmation(
  input: {
    actor: { organizationId: string; staffId: string };
    subjectType: ClientConfirmationSubjectType;
    subjectId: string;
  },
  repository: ClientConfirmationRepository,
) {
  const subjectOk = await repository.subjectExists(input.actor.organizationId, input.subjectType, input.subjectId);
  if (!subjectOk) throw new Error("The item to confirm was not found.");

  const token = generateToken();
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + CONFIRMATION_TTL_MS);

  const { confirmationId } = await repository.createConfirmationAndInvalidatePrior({
    organizationId: input.actor.organizationId,
    subjectType: input.subjectType,
    subjectId: input.subjectId,
    createdByStaffId: input.actor.staffId,
    tokenHash,
    expiresAt,
  });

  return { confirmationId, token, expiresAt };
}

async function requireConfirmationForDelivery(
  organizationId: string,
  confirmationId: string,
  token: string,
  repository: ClientConfirmationRepository,
) {
  const confirmation = await repository.getConfirmationForDelivery(organizationId, confirmationId);
  // Re-verifying the hash (not just the confirmation ID) proves the caller actually holds the
  // secret token, not just its database ID — the ID alone is guessable/enumerable by any staff member.
  if (!confirmation || confirmation.tokenHash !== hashToken(token)) throw new Error("This confirmation was not found.");
  return confirmation;
}

export async function sendConfirmationEmail(
  input: {
    organizationId: string;
    confirmationId: string;
    token: string;
    actorId: string;
    recipientEmail: string;
    confirmationUrl: string;
    subjectLabel: string;
    clientName: string;
  },
  repository: ClientConfirmationRepository,
  email: ConfirmationEmailSender,
) {
  await requireConfirmationForDelivery(input.organizationId, input.confirmationId, input.token, repository);

  await email.sendConfirmationEmail({
    to: input.recipientEmail,
    confirmationUrl: input.confirmationUrl,
    subjectLabel: input.subjectLabel,
    clientName: input.clientName,
  });

  await repository.markDelivered({
    organizationId: input.organizationId,
    confirmationId: input.confirmationId,
    actorId: input.actorId,
    method: "email",
    recipientEmail: input.recipientEmail,
  });
}

export async function markConfirmationCopied(
  input: { organizationId: string; confirmationId: string; token: string; actorId: string },
  repository: ClientConfirmationRepository,
) {
  await requireConfirmationForDelivery(input.organizationId, input.confirmationId, input.token, repository);

  await repository.markDelivered({
    organizationId: input.organizationId,
    confirmationId: input.confirmationId,
    actorId: input.actorId,
    method: "copy_link",
  });
}
