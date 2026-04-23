import { createHash, timingSafeEqual } from "node:crypto";

export function readRequestSecret(
  request: Request,
  options?: {
    queryParam?: string;
    headerName?: string;
  },
) {
  const queryParam = options?.queryParam || "secret";
  const headerName = options?.headerName;
  const { searchParams } = new URL(request.url);
  const authorizationHeader = request.headers.get("authorization");
  const bearerSecret =
    authorizationHeader?.startsWith("Bearer ")
      ? authorizationHeader.slice("Bearer ".length)
      : null;

  return (
    bearerSecret ||
    searchParams.get(queryParam) ||
    (headerName ? request.headers.get(headerName) : null)
  );
}

export function getRequiredDebugSecret() {
  return process.env.DEBUG_SECRET || "";
}

export function getRequiredCronSecret() {
  return process.env.CRON_SECRET || "";
}

export function isValidRequestSecret(secret: string | null, expectedSecret: string) {
  if (!secret || !expectedSecret) {
    return false;
  }

  return timingSafeEqual(hashSecret(secret), hashSecret(expectedSecret));
}

function hashSecret(value: string) {
  return createHash("sha256").update(value).digest();
}
