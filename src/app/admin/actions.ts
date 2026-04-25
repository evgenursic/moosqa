"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { EditorialCollectionType, ReleaseExternalSourceType, UserRole } from "@/generated/prisma/enums";
import { validateRoleAssignmentConfirmation } from "@/lib/admin-role-policy";
import { getAdminAccessState } from "@/lib/admin-session";
import { ensureDatabase } from "@/lib/database";
import { prisma } from "@/lib/prisma";
import { assessReleaseQuality } from "@/lib/release-quality";
import { normalizePublicHttpUrl } from "@/lib/safe-url";
import { runWeakCardReprocess } from "@/lib/sync-releases";

const releaseEditorialSchema = z.object({
  releaseId: z.string().min(1),
  slug: z.string().min(1),
  genreOverride: z.string().max(120).optional(),
  summaryOverride: z.string().max(420).optional(),
  imageUrlOverride: z.string().max(500).optional(),
  sourceUrlOverride: z.string().max(500).optional(),
  youtubeUrl: z.string().max(500).optional(),
  youtubeMusicUrl: z.string().max(500).optional(),
  youtubeViewCount: z.coerce.number().int().min(0).max(2_147_483_647).optional(),
  youtubePublishedAt: z.date().optional(),
  bandcampUrl: z.string().max(500).optional(),
  bandcampSupporterCount: z.coerce.number().int().min(0).max(2_147_483_647).optional(),
  bandcampFollowerCount: z.coerce.number().int().min(0).max(2_147_483_647).optional(),
  officialWebsiteUrl: z.string().max(500).optional(),
  officialStoreUrl: z.string().max(500).optional(),
  editorialNotes: z.string().max(800).optional(),
  hiddenReason: z.string().max(200).optional(),
  isHidden: z.boolean(),
  isFeatured: z.boolean(),
  editorialRank: z.coerce.number().int().min(0).max(999),
});

const collectionSchema = z.object({
  slug: z.string().min(2).max(80),
  title: z.string().min(2).max(120),
  description: z.string().max(400).optional(),
  type: z.nativeEnum(EditorialCollectionType),
  isPublished: z.boolean(),
});

const collectionEntrySchema = z.object({
  collectionId: z.string().min(1),
  releaseId: z.string().min(1),
  position: z.coerce.number().int().min(0).max(999).default(0),
  note: z.string().max(200).optional(),
});

const collectionEntryUpdateSchema = z.object({
  entryId: z.string().min(1),
  position: z.coerce.number().int().min(0).max(999).default(0),
  note: z.string().max(200).optional(),
});

const collectionEntryDeleteSchema = z.object({
  entryId: z.string().min(1),
});

const externalSourceSchema = z.object({
  sourceId: z.string().optional(),
  releaseId: z.string().min(1),
  slug: z.string().min(1),
  sourceName: z.string().min(2).max(120),
  sourceUrl: z.string().max(500),
  title: z.string().min(2).max(180),
  summary: z.string().max(420).optional(),
  sourceType: z.nativeEnum(ReleaseExternalSourceType),
  publishedAt: z.date().optional(),
  isVisible: z.boolean(),
});

const bootstrapSchema = z.object({
  bootstrapSecret: z.string().min(1).max(200),
  reason: z.string().max(200).optional(),
});

const roleAssignmentSchema = z.object({
  email: z.string().email().max(160),
  role: z.nativeEnum(UserRole),
  confirmation: z.string().max(160).optional(),
  reason: z.string().max(200).optional(),
});

const weakCardRepairSchema = z.object({
  limit: z.coerce.number().int().min(1).max(8).default(4),
  reason: z.string().max(200).optional(),
});

export async function updateReleaseEditorialAction(formData: FormData) {
  const admin = await requireAdminActionUser();
  const parsed = releaseEditorialSchema.parse({
    releaseId: readString(formData, "releaseId"),
    slug: readString(formData, "slug"),
    genreOverride: readOptionalString(formData, "genreOverride"),
    summaryOverride: readOptionalString(formData, "summaryOverride"),
    imageUrlOverride: readOptionalString(formData, "imageUrlOverride"),
    sourceUrlOverride: readOptionalString(formData, "sourceUrlOverride"),
    youtubeUrl: readOptionalString(formData, "youtubeUrl"),
    youtubeMusicUrl: readOptionalString(formData, "youtubeMusicUrl"),
    youtubeViewCount: readOptionalString(formData, "youtubeViewCount") || undefined,
    youtubePublishedAt: readOptionalDate(formData, "youtubePublishedAt") || undefined,
    bandcampUrl: readOptionalString(formData, "bandcampUrl"),
    bandcampSupporterCount: readOptionalString(formData, "bandcampSupporterCount") || undefined,
    bandcampFollowerCount: readOptionalString(formData, "bandcampFollowerCount") || undefined,
    officialWebsiteUrl: readOptionalString(formData, "officialWebsiteUrl"),
    officialStoreUrl: readOptionalString(formData, "officialStoreUrl"),
    editorialNotes: readOptionalString(formData, "editorialNotes"),
    hiddenReason: readOptionalString(formData, "hiddenReason"),
    isHidden: readCheckbox(formData, "isHidden"),
    isFeatured: readCheckbox(formData, "isFeatured"),
    editorialRank: readOptionalString(formData, "editorialRank") || "0",
  });
  await ensureDatabase();

  const before = await prisma.release.findUnique({
    where: { id: parsed.releaseId },
    select: {
      genreOverride: true,
      summaryOverride: true,
      imageUrlOverride: true,
      sourceUrlOverride: true,
      youtubeUrl: true,
      youtubeMusicUrl: true,
      youtubeViewCount: true,
      youtubePublishedAt: true,
      youtubeMetadataUpdatedAt: true,
      bandcampUrl: true,
      bandcampSupporterCount: true,
      bandcampFollowerCount: true,
      bandcampMetadataUpdatedAt: true,
      officialWebsiteUrl: true,
      officialStoreUrl: true,
      editorialNotes: true,
      isHidden: true,
      hiddenReason: true,
      isFeatured: true,
      editorialRank: true,
      releaseType: true,
      genreName: true,
      imageUrl: true,
      thumbnailUrl: true,
      releaseDate: true,
      publishedAt: true,
      metadataEnrichedAt: true,
      qualityCheckedAt: true,
      genreConfidence: true,
    },
  });

  if (!before) {
    redirect(`/admin?q=${encodeURIComponent(parsed.slug)}&editorial=missing#search`);
  }

  const nextYoutubeUrl = readNormalizedOptionalPublicUrl(parsed.youtubeUrl, parsed.slug);
  const nextYoutubeMusicUrl = readNormalizedOptionalPublicUrl(parsed.youtubeMusicUrl, parsed.slug);
  const nextBandcampUrl = readNormalizedOptionalPublicUrl(parsed.bandcampUrl, parsed.slug);
  const nextOfficialWebsiteUrl = readNormalizedOptionalPublicUrl(parsed.officialWebsiteUrl, parsed.slug);
  const nextOfficialStoreUrl = readNormalizedOptionalPublicUrl(parsed.officialStoreUrl, parsed.slug);
  const nextImageOverride = readNormalizedOptionalPublicUrl(parsed.imageUrlOverride, parsed.slug);
  const nextSourceOverride = readNormalizedOptionalPublicUrl(parsed.sourceUrlOverride, parsed.slug);

  const checkedAt = new Date();
  const youtubeMetadataChanged =
    nextYoutubeUrl !== before.youtubeUrl ||
    nextYoutubeMusicUrl !== before.youtubeMusicUrl ||
    (parsed.youtubeViewCount ?? null) !== before.youtubeViewCount ||
    !datesEqual(parsed.youtubePublishedAt ?? null, before.youtubePublishedAt);
  const bandcampMetadataChanged =
    nextBandcampUrl !== before.bandcampUrl ||
    (parsed.bandcampSupporterCount ?? null) !== before.bandcampSupporterCount ||
    (parsed.bandcampFollowerCount ?? null) !== before.bandcampFollowerCount;
  const qualitySnapshot = assessReleaseQuality({
    releaseType: before.releaseType,
    genreName: parsed.genreOverride?.trim() || before.genreName,
    imageUrl: nextImageOverride || before.imageUrl,
    thumbnailUrl: before.thumbnailUrl,
    youtubeUrl: nextYoutubeUrl,
    youtubeMusicUrl: nextYoutubeMusicUrl,
    bandcampUrl: nextBandcampUrl,
    officialWebsiteUrl: nextOfficialWebsiteUrl,
    officialStoreUrl: nextOfficialStoreUrl,
    releaseDate: before.releaseDate,
    publishedAt: before.publishedAt,
    metadataEnrichedAt: before.metadataEnrichedAt,
    qualityCheckedAt: checkedAt,
    genreConfidence: before.genreConfidence,
  });

  const nextData = {
    genreOverride: parsed.genreOverride?.trim() || null,
    summaryOverride: parsed.summaryOverride?.trim() || null,
    imageUrlOverride: nextImageOverride || null,
    sourceUrlOverride: nextSourceOverride || null,
    youtubeUrl: nextYoutubeUrl || null,
    youtubeMusicUrl: nextYoutubeMusicUrl || null,
    youtubeViewCount: parsed.youtubeViewCount ?? null,
    youtubePublishedAt: parsed.youtubePublishedAt ?? null,
    youtubeMetadataUpdatedAt: youtubeMetadataChanged
      ? checkedAt
      : before.youtubeMetadataUpdatedAt,
    bandcampUrl: nextBandcampUrl || null,
    bandcampSupporterCount: parsed.bandcampSupporterCount ?? null,
    bandcampFollowerCount: parsed.bandcampFollowerCount ?? null,
    bandcampMetadataUpdatedAt: bandcampMetadataChanged
      ? checkedAt
      : before.bandcampMetadataUpdatedAt,
    officialWebsiteUrl: nextOfficialWebsiteUrl || null,
    officialStoreUrl: nextOfficialStoreUrl || null,
    editorialNotes: parsed.editorialNotes?.trim() || null,
    isHidden: parsed.isHidden,
    hiddenReason: parsed.isHidden ? parsed.hiddenReason?.trim() || "Hidden by editor." : null,
    isFeatured: parsed.isFeatured,
    editorialRank: parsed.editorialRank,
    featuredAt: parsed.isFeatured ? new Date() : null,
    artworkStatus: qualitySnapshot.artworkStatus,
    genreStatus: qualitySnapshot.genreStatus,
    linkStatus: qualitySnapshot.linkStatus,
    qualityScore: qualitySnapshot.qualityScore,
    qualityCheckedAt: checkedAt,
    editorialUpdatedAt: new Date(),
    editorialUpdatedBy: admin.id,
  };

  await prisma.release.update({
    where: { id: parsed.releaseId },
    data: nextData,
  });
  await prisma.releaseEditorialAudit.create({
    data: {
      releaseId: parsed.releaseId,
      editorUserId: admin.id,
      action: "release.update",
      detailsJson: JSON.stringify({
        before,
        after: nextData,
      }),
    },
  });

  revalidateReleaseSurfaces(parsed.slug);
  redirect(`/admin?q=${encodeURIComponent(parsed.slug)}#search`);
}

export async function upsertReleaseExternalSourceAction(formData: FormData) {
  const admin = await requireAdminActionUser();
  const parsed = externalSourceSchema.parse({
    sourceId: readOptionalString(formData, "sourceId") || undefined,
    releaseId: readString(formData, "releaseId"),
    slug: readString(formData, "slug"),
    sourceName: readString(formData, "sourceName"),
    sourceUrl: readString(formData, "sourceUrl"),
    title: readString(formData, "title"),
    summary: readOptionalString(formData, "summary"),
    sourceType: readString(formData, "sourceType"),
    publishedAt: readOptionalDate(formData, "publishedAt") || undefined,
    isVisible: readCheckbox(formData, "isVisible"),
  });
  await ensureDatabase();

  const release = await prisma.release.findUnique({
    where: { id: parsed.releaseId },
    select: { id: true, slug: true },
  });
  if (!release) {
    redirect(`/admin?q=${encodeURIComponent(parsed.slug)}&source=missing-release#search`);
  }

  const sourceUrl = readNormalizedOptionalPublicUrl(parsed.sourceUrl, parsed.slug);
  if (!sourceUrl) {
    redirect(`/admin?q=${encodeURIComponent(parsed.slug)}&source=invalid-url#search`);
  }

  const before = parsed.sourceId
    ? await prisma.releaseExternalSource.findFirst({
        where: {
          id: parsed.sourceId,
          releaseId: parsed.releaseId,
        },
      })
    : null;

  const nextData = {
    releaseId: parsed.releaseId,
    sourceName: parsed.sourceName.trim(),
    sourceUrl,
    title: parsed.title.trim(),
    summary: parsed.summary?.trim() || null,
    sourceType: parsed.sourceType,
    publishedAt: parsed.publishedAt ?? null,
    isVisible: parsed.isVisible,
    addedByUserId: admin.id,
  };

  const source = before
    ? await prisma.releaseExternalSource.update({
        where: { id: before.id },
        data: nextData,
      })
    : await prisma.releaseExternalSource.create({
        data: nextData,
      });

  await prisma.releaseEditorialAudit.create({
    data: {
      releaseId: parsed.releaseId,
      editorUserId: admin.id,
      action: before ? "external-source.update" : "external-source.create",
      detailsJson: JSON.stringify({
        sourceId: source.id,
        before,
        after: nextData,
      }),
    },
  });

  revalidateReleaseSurfaces(release.slug);
  redirect(`/admin?q=${encodeURIComponent(release.slug)}#sources-${release.id}`);
}

export async function createEditorialCollectionAction(formData: FormData) {
  const admin = await requireAdminActionUser();
  const parsed = collectionSchema.parse({
    slug: readString(formData, "slug"),
    title: readString(formData, "title"),
    description: readOptionalString(formData, "description"),
    type: readString(formData, "type"),
    isPublished: readCheckbox(formData, "isPublished"),
  });
  await ensureDatabase();

  const collection = await prisma.editorialCollection.upsert({
    where: { slug: parsed.slug.trim().toLowerCase() },
    update: {
      title: parsed.title.trim(),
      description: parsed.description?.trim() || null,
      type: parsed.type,
      isPublished: parsed.isPublished,
      publishedAt: parsed.isPublished ? new Date() : null,
    },
    create: {
      slug: parsed.slug.trim().toLowerCase(),
      title: parsed.title.trim(),
      description: parsed.description?.trim() || null,
      type: parsed.type,
      isPublished: parsed.isPublished,
      publishedAt: parsed.isPublished ? new Date() : null,
    },
    select: {
      id: true,
      slug: true,
    },
  });

  await prisma.releaseEditorialAudit.create({
    data: {
      releaseId: await readFallbackAuditReleaseId(),
      editorUserId: admin.id,
      action: "collection.upsert",
      detailsJson: JSON.stringify({
        collectionId: collection.id,
        slug: collection.slug,
      }),
    },
  }).catch(() => undefined);

  revalidatePath("/admin");
  revalidatePath("/picks");
  revalidatePath(`/collections/${collection.slug}`);
  revalidateTag("editorial", "max");
  redirect(`/admin?collection=${encodeURIComponent(collection.slug)}#collections`);
}

export async function addReleaseToCollectionAction(formData: FormData) {
  const admin = await requireAdminActionUser();
  const parsed = collectionEntrySchema.parse({
    collectionId: readString(formData, "collectionId"),
    releaseId: readString(formData, "releaseId"),
    position: readOptionalString(formData, "position") || "0",
    note: readOptionalString(formData, "note"),
  });
  await ensureDatabase();

  const release = await prisma.release.findUnique({
    where: { id: parsed.releaseId },
    select: { slug: true },
  });
  const collection = await prisma.editorialCollection.findUnique({
    where: { id: parsed.collectionId },
    select: { slug: true },
  });

  await prisma.editorialCollectionEntry.upsert({
    where: {
      collectionId_releaseId: {
        collectionId: parsed.collectionId,
        releaseId: parsed.releaseId,
      },
    },
    update: {
      position: parsed.position,
      note: parsed.note?.trim() || null,
    },
    create: {
      collectionId: parsed.collectionId,
      releaseId: parsed.releaseId,
      position: parsed.position,
      note: parsed.note?.trim() || null,
    },
  });

  await prisma.releaseEditorialAudit.create({
    data: {
      releaseId: parsed.releaseId,
      editorUserId: admin.id,
      action: "collection.entry.upsert",
      detailsJson: JSON.stringify({
        collectionId: parsed.collectionId,
        position: parsed.position,
        note: parsed.note?.trim() || null,
      }),
    },
  });

  revalidateReleaseSurfaces(release?.slug || "");
  revalidatePath("/picks");
  if (collection?.slug) {
    revalidatePath(`/collections/${collection.slug}`);
  }
  redirect(`/admin?q=${encodeURIComponent(release?.slug || parsed.releaseId)}#collections`);
}

export async function updateCollectionEntryAction(formData: FormData) {
  const admin = await requireAdminActionUser();
  const parsed = collectionEntryUpdateSchema.parse({
    entryId: readString(formData, "entryId"),
    position: readOptionalString(formData, "position") || "0",
    note: readOptionalString(formData, "note"),
  });
  await ensureDatabase();

  const entry = await prisma.editorialCollectionEntry.findUnique({
    where: { id: parsed.entryId },
    select: {
      id: true,
      releaseId: true,
      position: true,
      note: true,
      collection: {
        select: {
          id: true,
          slug: true,
        },
      },
      release: {
        select: {
          slug: true,
        },
      },
    },
  });

  if (!entry) {
    redirect("/admin?collectionEntry=missing#collections");
  }

  await prisma.editorialCollectionEntry.update({
    where: { id: parsed.entryId },
    data: {
      position: parsed.position,
      note: parsed.note?.trim() || null,
    },
  });

  await prisma.releaseEditorialAudit.create({
    data: {
      releaseId: entry.releaseId,
      editorUserId: admin.id,
      action: "collection.entry.update",
      detailsJson: JSON.stringify({
        collectionId: entry.collection.id,
        collectionSlug: entry.collection.slug,
        before: {
          position: entry.position,
          note: entry.note,
        },
        after: {
          position: parsed.position,
          note: parsed.note?.trim() || null,
        },
      }),
    },
  });

  revalidateReleaseSurfaces(entry.release.slug);
  revalidatePath("/picks");
  revalidatePath(`/collections/${entry.collection.slug}`);
  revalidateTag("editorial", "max");
  redirect(`/admin?collection=${encodeURIComponent(entry.collection.slug)}#collections`);
}

export async function removeCollectionEntryAction(formData: FormData) {
  const admin = await requireAdminActionUser();
  const parsed = collectionEntryDeleteSchema.parse({
    entryId: readString(formData, "entryId"),
  });
  await ensureDatabase();

  const entry = await prisma.editorialCollectionEntry.findUnique({
    where: { id: parsed.entryId },
    select: {
      id: true,
      releaseId: true,
      position: true,
      note: true,
      collection: {
        select: {
          id: true,
          slug: true,
        },
      },
      release: {
        select: {
          slug: true,
        },
      },
    },
  });

  if (!entry) {
    redirect("/admin?collectionEntry=missing#collections");
  }

  await prisma.editorialCollectionEntry.delete({
    where: { id: parsed.entryId },
  });

  await prisma.releaseEditorialAudit.create({
    data: {
      releaseId: entry.releaseId,
      editorUserId: admin.id,
      action: "collection.entry.remove",
      detailsJson: JSON.stringify({
        collectionId: entry.collection.id,
        collectionSlug: entry.collection.slug,
        removed: {
          position: entry.position,
          note: entry.note,
        },
      }),
    },
  });

  revalidateReleaseSurfaces(entry.release.slug);
  revalidatePath("/picks");
  revalidatePath(`/collections/${entry.collection.slug}`);
  revalidateTag("editorial", "max");
  redirect(`/admin?collection=${encodeURIComponent(entry.collection.slug)}#collections`);
}

export async function bootstrapAdminAccessAction(formData: FormData) {
  const access = await getAdminAccessState();
  if (!access.configured) {
    redirect("/account?auth=unconfigured");
  }
  if (!access.authenticated || !access.user) {
    redirect("/account?next=%2Fadmin");
  }
  if (!access.bootstrapAllowed) {
    redirect("/admin?bootstrap=closed");
  }

  const parsed = bootstrapSchema.parse({
    bootstrapSecret: readString(formData, "bootstrapSecret"),
    reason: readOptionalString(formData, "reason"),
  });
  const expectedSecret = process.env.DEBUG_SECRET?.trim() || "";
  if (!expectedSecret || parsed.bootstrapSecret.trim() !== expectedSecret) {
    redirect("/admin?bootstrap=invalid");
  }

  await ensureDatabase();

  const result = await prisma.$transaction(async (tx) => {
    const adminCount = await tx.userProfile.count({
      where: {
        role: UserRole.ADMIN,
      },
    });
    if (adminCount > 0) {
      return { ok: false as const };
    }

    const current = await tx.userProfile.findUnique({
      where: { id: access.user!.id },
      select: { role: true },
    });

    await tx.userProfile.update({
      where: { id: access.user!.id },
      data: {
        role: UserRole.ADMIN,
      },
    });

    await tx.userRoleAssignmentAudit.create({
      data: {
        actorUserId: access.user!.id,
        targetUserId: access.user!.id,
        previousRole: current?.role || UserRole.USER,
        nextRole: UserRole.ADMIN,
        reason: parsed.reason?.trim() || "Initial admin bootstrap via debug secret.",
      },
    });

    return { ok: true as const };
  });

  if (!result.ok) {
    redirect("/admin?bootstrap=closed");
  }

  revalidatePath("/admin");
  redirect("/admin?bootstrap=granted");
}

export async function assignUserRoleAction(formData: FormData) {
  const admin = await requireAdminRoleActionUser();
  const parsed = roleAssignmentSchema.parse({
    email: readString(formData, "email").toLowerCase(),
    role: readString(formData, "role"),
    confirmation: readOptionalString(formData, "confirmation"),
    reason: readOptionalString(formData, "reason"),
  });
  await ensureDatabase();

  if (
    !validateRoleAssignmentConfirmation({
      email: parsed.email,
      nextRole: parsed.role,
      confirmation: parsed.confirmation,
      reason: parsed.reason,
    })
  ) {
    redirect(`/admin?roles=confirm-required&email=${encodeURIComponent(parsed.email)}#roles`);
  }

  const target = await prisma.userProfile.findUnique({
    where: {
      email: parsed.email,
    },
    select: {
      id: true,
      role: true,
    },
  });

  if (!target) {
    redirect(`/admin?roles=missing-user&email=${encodeURIComponent(parsed.email)}#roles`);
  }

  if (target.role === parsed.role) {
    redirect(`/admin?roles=unchanged&email=${encodeURIComponent(parsed.email)}#roles`);
  }

  await prisma.$transaction(async (tx) => {
    if (target.id === admin.id && parsed.role !== UserRole.ADMIN) {
      const adminCount = await tx.userProfile.count({
        where: {
          role: UserRole.ADMIN,
        },
      });

      if (adminCount <= 1) {
        throw new Error("Cannot demote the last admin.");
      }
    }

    await tx.userProfile.update({
      where: { id: target.id },
      data: {
        role: parsed.role,
      },
    });

    await tx.userRoleAssignmentAudit.create({
      data: {
        actorUserId: admin.id,
        targetUserId: target.id,
        previousRole: target.role,
        nextRole: parsed.role,
        reason: parsed.reason?.trim() || null,
      },
    });
  }).catch((error) => {
    console.error("Role assignment failed.", error);
    redirect(`/admin?roles=blocked&email=${encodeURIComponent(parsed.email)}#roles`);
  });

  revalidatePath("/admin");
  redirect(`/admin?roles=saved&email=${encodeURIComponent(parsed.email)}#roles`);
}

export async function runWeakCardRepairAction(formData: FormData) {
  const admin = await requireAdminActionUser();
  const parsed = weakCardRepairSchema.parse({
    limit: readOptionalString(formData, "limit") || "4",
    reason: readOptionalString(formData, "reason"),
  });
  await ensureDatabase();

  const result = await runWeakCardReprocess(parsed.limit);

  await prisma.releaseEditorialAudit.create({
    data: {
      releaseId: await readFallbackAuditReleaseId(),
      editorUserId: admin.id,
      action: "quality.repair",
      detailsJson: JSON.stringify({
        limit: parsed.limit,
        reason: parsed.reason?.trim() || null,
        result,
      }),
    },
  }).catch(() => undefined);

  revalidatePath("/admin");
  revalidatePath("/debug");
  revalidateTag("releases", "max");
  revalidateTag("quality-dashboard", "max");
  revalidateTag("ops-dashboard", "max");
  redirect(`/admin?repair=queued-${result.queued}&checked=${result.checked}&improved=${result.improved}#repair`);
}

async function requireAdminActionUser() {
  const access = await getAdminAccessState();
  if (!access.configured) {
    redirect("/account?auth=unconfigured");
  }
  if (!access.authenticated) {
    redirect("/account?next=%2Fadmin");
  }
  if (!access.canAccess || !access.user) {
    redirect("/account?next=%2Fadmin");
  }

  return access.user;
}

async function requireAdminRoleActionUser() {
  const access = await getAdminAccessState();
  if (!access.configured) {
    redirect("/account?auth=unconfigured");
  }
  if (!access.authenticated || !access.user) {
    redirect("/account?next=%2Fadmin");
  }
  if (!access.isAdmin) {
    redirect("/admin?roles=forbidden#roles");
  }

  return access.user;
}

function revalidateReleaseSurfaces(slug: string) {
  revalidatePath("/");
  revalidatePath("/picks");
  revalidatePath("/radar");
  revalidatePath("/admin");
  if (slug) {
    revalidatePath(`/releases/${slug}`);
  }
  revalidateTag("releases", "max");
  revalidateTag("editorial", "max");
  revalidateTag("ops-dashboard", "max");
}

function readCheckbox(formData: FormData, key: string) {
  return formData.get(key) === "on";
}

function readString(formData: FormData, key: string) {
  const value = formData.get(key);
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${key} is required.`);
  }

  return value.trim();
}

function readOptionalString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function readOptionalDate(formData: FormData, key: string) {
  const value = readOptionalString(formData, key);
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function datesEqual(left: Date | null, right: Date | null) {
  if (!left && !right) {
    return true;
  }

  if (!left || !right) {
    return false;
  }

  return left.getTime() === right.getTime();
}

function readNormalizedOptionalPublicUrl(value: string | null | undefined, slug: string) {
  const normalized = value?.trim() || "";
  if (!normalized) {
    return null;
  }

  const publicUrl = normalizePublicHttpUrl(normalized);
  if (!publicUrl) {
    redirect(`/admin?q=${encodeURIComponent(slug)}&editorial=invalid-url#search`);
  }

  return publicUrl;
}

async function readFallbackAuditReleaseId() {
  const release = await prisma.release.findFirst({
    orderBy: [{ publishedAt: "desc" }],
    select: { id: true },
  });

  return release?.id || "";
}
