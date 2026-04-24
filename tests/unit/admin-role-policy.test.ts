import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { UserRole } from "@/generated/prisma/enums";
import {
  roleAssignmentRequiresConfirmation,
  validateRoleAssignmentConfirmation,
} from "@/lib/admin-role-policy";

describe("admin role assignment policy", () => {
  it("allows editor grants without extra confirmation", () => {
    assert.equal(roleAssignmentRequiresConfirmation(UserRole.EDITOR), false);
    assert.equal(
      validateRoleAssignmentConfirmation({
        email: "editor@example.com",
        nextRole: UserRole.EDITOR,
        confirmation: "",
        reason: "",
      }),
      true,
    );
  });

  it("requires matching email confirmation and a reason for sensitive role changes", () => {
    assert.equal(roleAssignmentRequiresConfirmation(UserRole.ADMIN), true);
    assert.equal(roleAssignmentRequiresConfirmation(UserRole.USER), true);
    assert.equal(
      validateRoleAssignmentConfirmation({
        email: "editor@example.com",
        nextRole: UserRole.ADMIN,
        confirmation: "EDITOR@example.com",
        reason: "Backup admin",
      }),
      true,
    );
    assert.equal(
      validateRoleAssignmentConfirmation({
        email: "editor@example.com",
        nextRole: UserRole.USER,
        confirmation: "someone-else@example.com",
        reason: "Remove access",
      }),
      false,
    );
    assert.equal(
      validateRoleAssignmentConfirmation({
        email: "editor@example.com",
        nextRole: UserRole.ADMIN,
        confirmation: "editor@example.com",
        reason: "short",
      }),
      false,
    );
  });
});
