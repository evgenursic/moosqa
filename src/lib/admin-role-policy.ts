import { UserRole } from "@/generated/prisma/enums";

export function roleAssignmentRequiresConfirmation(nextRole: UserRole) {
  return nextRole === UserRole.ADMIN || nextRole === UserRole.USER;
}

export function validateRoleAssignmentConfirmation({
  email,
  nextRole,
  confirmation,
  reason,
}: {
  email: string;
  nextRole: UserRole;
  confirmation: string | null | undefined;
  reason: string | null | undefined;
}) {
  if (!roleAssignmentRequiresConfirmation(nextRole)) {
    return true;
  }

  const normalizedEmail = email.trim().toLowerCase();
  const normalizedConfirmation = confirmation?.trim().toLowerCase() || "";
  const normalizedReason = reason?.trim() || "";

  return normalizedConfirmation === normalizedEmail && normalizedReason.length >= 6;
}
