"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { EditorialCollectionType } from "@/generated/prisma/enums";
import { getAdminAccessState } from "@/lib/admin-session";
import { ensureDatabase } from "@/lib/database";
import { prisma } from "@/lib/prisma";

const releaseEditorialSchema = z.object({
  releaseId: z.string().min(1),
  slug: z.string().min(1),
  genreOverride: z.string().max(120).optional(),
  summaryOverride: z.string().max(420).optional(),
  imageUrlOverride: z.string().max(500).optional(),
  sourceUrlOverride: z.string().max(500).optional(),
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

export async function updateReleaseEditorialAction(formData: FormData) {
  const admin = await requireAdminActionUser();
  const parsed = releaseEditorialSchema.parse({
    releaseId: readString(formData, "releaseId"),
    slug: readString(formData, "slug"),
    genreOverride: readOptionalString(formData, "genreOverride"),
    summaryOverride: readOptionalString(formData, "summaryOverride"),
    imageUrlOverride: readOptionalString(formData, "imageUrlOverride"),
    sourceUrlOverride: readOptionalString(formData, "sourceUrlOverride"),
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
      editorialNotes: true,
      isHidden: true,
      hiddenReason: true,
      isFeatured: true,
      editorialRank: true,
    },
  });

  const nextData = {
    genreOverride: parsed.genreOverride?.trim() || null,
    summaryOverride: parsed.summaryOverride?.trim() || null,
    imageUrlOverride: parsed.imageUrlOverride?.trim() || null,
    sourceUrlOverride: parsed.sourceUrlOverride?.trim() || null,
    editorialNotes: parsed.editorialNotes?.trim() || null,
    isHidden: parsed.isHidden,
    hiddenReason: parsed.isHidden ? parsed.hiddenReason?.trim() || "Hidden by editor." : null,
    isFeatured: parsed.isFeatured,
    editorialRank: parsed.editorialRank,
    featuredAt: parsed.isFeatured ? new Date() : null,
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
  redirect(`/admin?q=${encodeURIComponent(release?.slug || parsed.releaseId)}#collections`);
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

function revalidateReleaseSurfaces(slug: string) {
  revalidatePath("/");
  revalidatePath("/radar");
  revalidatePath("/admin");
  if (slug) {
    revalidatePath(`/releases/${slug}`);
  }
  revalidateTag("releases", "max");
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

async function readFallbackAuditReleaseId() {
  const release = await prisma.release.findFirst({
    orderBy: [{ publishedAt: "desc" }],
    select: { id: true },
  });

  return release?.id || "";
}
