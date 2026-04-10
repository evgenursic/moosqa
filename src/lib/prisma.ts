import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { PrismaClient as PrismaClientClass } from "@/generated/prisma/client";
import type { PrismaClient as PrismaClientInstance } from "@/generated/prisma/client";

const PRISMA_CLIENT_SCHEMA_VERSION = "postgres-production-v2";
const runtimeDatabaseUrl =
  process.env.DATABASE_RUNTIME_URL || process.env.DATABASE_URL;

declare global {
  var prismaGlobal: PrismaClientInstance | undefined;
  var prismaGlobalVersion: string | undefined;
  var prismaPoolGlobal: Pool | undefined;
}

const shouldCreateClient =
  !globalThis.prismaGlobal ||
  globalThis.prismaGlobalVersion !== PRISMA_CLIENT_SCHEMA_VERSION;

const prismaPool =
  globalThis.prismaPoolGlobal ||
  new Pool({
    connectionString: runtimeDatabaseUrl || "",
    max: 1,
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 10_000,
    allowExitOnIdle: true,
  });

const prismaClient: PrismaClientInstance = shouldCreateClient
  ? new PrismaClientClass({
      adapter: new PrismaPg(prismaPool),
      log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
    })
  : (globalThis.prismaGlobal as PrismaClientInstance);

export const prisma: PrismaClientInstance = prismaClient;

if (process.env.NODE_ENV !== "production") {
  globalThis.prismaGlobal = prisma;
  globalThis.prismaGlobalVersion = PRISMA_CLIENT_SCHEMA_VERSION;
  globalThis.prismaPoolGlobal = prismaPool;
}
