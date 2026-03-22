import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "@/generated/prisma/client";

const PRISMA_CLIENT_SCHEMA_VERSION = "release-enrichment-v1";

const adapter = new PrismaBetterSqlite3({
  url: process.env.DATABASE_URL || "file:./prisma/dev.db",
});

declare global {
  var prismaGlobal: PrismaClient | undefined;
  var prismaGlobalVersion: string | undefined;
}

const shouldCreateClient =
  !globalThis.prismaGlobal ||
  globalThis.prismaGlobalVersion !== PRISMA_CLIENT_SCHEMA_VERSION;

const prismaClient: PrismaClient = shouldCreateClient
  ? new PrismaClient({
      adapter,
      log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
    })
  : (globalThis.prismaGlobal as PrismaClient);

export const prisma: PrismaClient = prismaClient;

if (process.env.NODE_ENV !== "production") {
  globalThis.prismaGlobal = prisma;
  globalThis.prismaGlobalVersion = PRISMA_CLIENT_SCHEMA_VERSION;
}
