import { UserRole } from "@/generated/prisma/enums";
import { ensureDatabase } from "@/lib/database";
import { prisma } from "@/lib/prisma";
import { isSupabaseAuthConfigured } from "@/lib/supabase/config";
import { getSupabaseServerUser } from "@/lib/supabase/server";
import { ensureUserProfile } from "@/lib/user-product";

type EditableRole = "EDITOR" | "ADMIN";

export type AdminAccessState = {
  configured: boolean;
  authenticated: boolean;
  canAccess: boolean;
  isAdmin: boolean;
  bootstrapAllowed: boolean;
  adminCount: number;
  error: string | null;
  user: {
    id: string;
    email: string | null;
    role: UserRole;
  } | null;
};

export async function getAdminAccessState(): Promise<AdminAccessState> {
  if (!isSupabaseAuthConfigured()) {
    return {
      configured: false,
      authenticated: false,
      canAccess: false,
      isAdmin: false,
      bootstrapAllowed: false,
      adminCount: 0,
      error: null,
      user: null,
    };
  }

  const authState = await getSupabaseServerUser();
  if (authState.error) {
    return {
      configured: true,
      authenticated: false,
      canAccess: false,
      isAdmin: false,
      bootstrapAllowed: false,
      adminCount: 0,
      error: authState.error,
      user: null,
    };
  }

  if (!authState.user) {
    return {
      configured: true,
      authenticated: false,
      canAccess: false,
      isAdmin: false,
      bootstrapAllowed: false,
      adminCount: 0,
      error: null,
      user: null,
    };
  }

  await ensureUserProfile({
    id: authState.user.id,
    email: authState.user.email,
    displayName: getDisplayName(authState.user.user_metadata),
  });
  await ensureDatabase();

  const [profile, adminCount] = await Promise.all([
    prisma.userProfile.findUnique({
      where: { id: authState.user.id },
      select: {
        id: true,
        email: true,
        role: true,
      },
    }),
    prisma.userProfile.count({
      where: {
        role: UserRole.ADMIN,
      },
    }),
  ]);

  const role = profile?.role || UserRole.USER;

  return {
    configured: true,
    authenticated: true,
    canAccess: isEditorialRole(role),
    isAdmin: role === UserRole.ADMIN,
    bootstrapAllowed: adminCount === 0,
    adminCount,
    error: null,
    user: profile
      ? {
          id: profile.id,
          email: profile.email || null,
          role,
        }
      : {
          id: authState.user.id,
          email: authState.user.email || null,
          role,
        },
  };
}

export function isEditorialRole(role: UserRole): role is EditableRole {
  return role === UserRole.EDITOR || role === UserRole.ADMIN;
}

function getDisplayName(metadata: unknown) {
  if (!metadata || typeof metadata !== "object") {
    return null;
  }

  const record = metadata as Record<string, unknown>;
  const displayName = record.display_name || record.full_name || record.name;

  return typeof displayName === "string" ? displayName : null;
}
