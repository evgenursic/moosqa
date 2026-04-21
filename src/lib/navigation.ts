export function sanitizeInternalHref(value: string | null | undefined) {
  const normalized = value?.trim() || "";
  if (!normalized || !normalized.startsWith("/") || normalized.startsWith("//")) {
    return null;
  }

  try {
    const parsed = new URL(normalized, "https://moosqa.local");
    if (parsed.origin !== "https://moosqa.local") {
      return null;
    }

    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return null;
  }
}

export function getPrefetchTarget(value: string | null | undefined) {
  const href = sanitizeInternalHref(value);
  if (!href) {
    return "/";
  }

  const [pathWithQuery] = href.split("#");
  return pathWithQuery || "/";
}

export function sanitizeExternalUrl(value: string | null | undefined) {
  const normalized = value?.trim() || "";
  if (!normalized) {
    return null;
  }

  try {
    const parsed = new URL(normalized);
    return parsed.protocol === "http:" || parsed.protocol === "https:" ? parsed.toString() : null;
  } catch {
    return null;
  }
}
