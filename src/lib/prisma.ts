import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

const PRISMA_CLIENT_SCHEMA_VERSION = "postgres-production-v1";
const runtimeDatabaseUrl =
  process.env.DATABASE_RUNTIME_URL || process.env.DATABASE_URL;

declare global {
  var prismaGlobal: PrismaClient | undefined;
  var prismaGlobalVersion: string | undefined;
}

const shouldCreateClient =
  !globalThis.prismaGlobal ||
  globalThis.prismaGlobalVersion !== PRISMA_CLIENT_SCHEMA_VERSION;

const prismaClient: PrismaClient = shouldCreateClient
  ? new PrismaClient({
      adapter: new PrismaPg({
        connectionString: runtimeDatabaseUrl || "",
      }),
      log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
    })
  : (globalThis.prismaGlobal as PrismaClient);

export const prisma: PrismaClient = prismaClient;

if (process.env.NODE_ENV !== "production") {
  globalThis.prismaGlobal = prisma;
  globalThis.prismaGlobalVersion = PRISMA_CLIENT_SCHEMA_VERSION;
}
