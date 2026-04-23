const AUTH_NEXT_FALLBACK = "/account";

export function normalizeAuthEmail(value: FormDataEntryValue | string | null) {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim().toLowerCase();
}

export function isValidAuthEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function normalizeAuthNextPath(
  value: FormDataEntryValue | string | null,
  fallback = AUTH_NEXT_FALLBACK,
) {
  if (typeof value !== "string") {
    return fallback;
  }

  const trimmed = value.trim();

  if (!trimmed || !trimmed.startsWith("/") || trimmed.startsWith("//") || trimmed.includes("\\")) {
    return fallback;
  }

  try {
    const parsed = new URL(trimmed, "https://moosqa.local");

    if (parsed.origin !== "https://moosqa.local") {
      return fallback;
    }

    if (parsed.pathname.startsWith("/auth/") || parsed.pathname.startsWith("/api/")) {
      return fallback;
    }

    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return fallback;
  }
}

export function getAccountAuthMessage(code: string | string[] | undefined) {
  const value = Array.isArray(code) ? code[0] : code;

  switch (value) {
    case "check-email":
      return "Check your email for a secure sign-in link.";
    case "invalid-email":
      return "Enter a valid email address.";
    case "send-failed":
      return "The sign-in link could not be sent. Try again in a moment.";
    case "callback-failed":
      return "The sign-in link could not be verified. Request a new one.";
    case "unconfigured":
      return "Account access is not configured for this deployment yet.";
    default:
      return null;
  }
}
