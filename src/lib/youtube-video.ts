export function extractYouTubeVideoId(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  try {
    const parsed = new URL(value);
    const host = parsed.hostname.toLowerCase();

    if (host === "youtu.be") {
      return sanitizeYouTubeVideoId(parsed.pathname.replace(/^\/+/, "").split("/")[0]);
    }

    if (!host.includes("youtube.com")) {
      return null;
    }

    const directVideoId = sanitizeYouTubeVideoId(parsed.searchParams.get("v"));
    if (directVideoId) {
      return directVideoId;
    }

    const segments = parsed.pathname.split("/").filter(Boolean);
    for (const marker of ["live", "shorts", "embed"]) {
      const index = segments.findIndex((segment) => segment === marker);
      const id = sanitizeYouTubeVideoId(index >= 0 ? segments[index + 1] : null);
      if (id) {
        return id;
      }
    }
  } catch {
    return null;
  }

  return null;
}

export function buildCanonicalYouTubeWatchUrl(videoId: string | null | undefined) {
  const safeId = sanitizeYouTubeVideoId(videoId);
  return safeId ? `https://www.youtube.com/watch?v=${safeId}` : null;
}

export function sanitizeYouTubeVideoId(value: string | null | undefined) {
  const id = value?.trim();
  return id && /^[a-zA-Z0-9_-]{6,32}$/.test(id) ? id : null;
}
