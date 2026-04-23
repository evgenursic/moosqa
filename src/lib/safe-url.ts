const MAX_PUBLIC_HTTP_REDIRECTS = 4;

export function normalizePublicHttpUrl(value: string | null | undefined) {
  const raw = value?.trim() || "";
  if (!raw) {
    return null;
  }

  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return null;
    }

    if (!isPublicHostname(parsed.hostname)) {
      return null;
    }

    return parsed.toString();
  } catch {
    return null;
  }
}

export async function fetchPublicHttpUrl(
  value: string,
  init: Omit<RequestInit, "redirect"> = {},
) {
  let currentUrl = normalizePublicHttpUrl(value);
  if (!currentUrl) {
    return null;
  }

  for (let redirectCount = 0; redirectCount <= MAX_PUBLIC_HTTP_REDIRECTS; redirectCount += 1) {
    const response = await fetch(currentUrl, {
      ...init,
      redirect: "manual",
    });

    if (!isRedirectResponse(response.status)) {
      return response;
    }

    const location = response.headers.get("location");
    if (!location) {
      return response;
    }

    const nextUrl = normalizePublicHttpUrl(new URL(location, currentUrl).toString());
    if (!nextUrl) {
      return null;
    }

    currentUrl = nextUrl;
  }

  return null;
}

function isRedirectResponse(status: number) {
  return status >= 300 && status < 400;
}

function isPublicHostname(value: string) {
  const hostname = normalizeHostname(value);
  if (!hostname) {
    return false;
  }

  if (
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    hostname.endsWith(".local") ||
    hostname.endsWith(".internal") ||
    hostname === "metadata.google.internal"
  ) {
    return false;
  }

  const ipVersion = getIpVersion(hostname);
  if (ipVersion === 4) {
    return isPublicIpv4(hostname);
  }

  if (ipVersion === 6) {
    return isPublicIpv6(hostname);
  }

  return true;
}

function getIpVersion(value: string) {
  if (/^\d{1,3}(?:\.\d{1,3}){3}$/.test(value)) {
    return 4;
  }

  if (value.includes(":")) {
    return 6;
  }

  return 0;
}

function normalizeHostname(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/^\[/, "")
    .replace(/\]$/, "")
    .replace(/\.$/, "");
}

function isPublicIpv4(value: string) {
  const parts = value.split(".").map((part) => Number.parseInt(part, 10));
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
    return false;
  }

  const [first, second] = parts;

  if (first === 0 || first === 10 || first === 127) {
    return false;
  }

  if (first === 100 && second >= 64 && second <= 127) {
    return false;
  }

  if (first === 169 && second === 254) {
    return false;
  }

  if (first === 172 && second >= 16 && second <= 31) {
    return false;
  }

  if (first === 192 && second === 168) {
    return false;
  }

  if (first >= 224) {
    return false;
  }

  return true;
}

function isPublicIpv6(value: string) {
  const normalized = value.toLowerCase();
  if (
    normalized === "::" ||
    normalized === "::1" ||
    normalized.startsWith("fc") ||
    normalized.startsWith("fd") ||
    normalized.startsWith("fe80:")
  ) {
    return false;
  }

  const mappedIpv4 = normalized.match(/(?:^|:)ffff:(\d+\.\d+\.\d+\.\d+)$/)?.[1];
  if (mappedIpv4) {
    return isPublicIpv4(mappedIpv4);
  }

  return true;
}
