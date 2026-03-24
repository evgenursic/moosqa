const FALLBACK_SITE_URL = "https://moosqa-ci4e.vercel.app";

export function getSiteUrl() {
  const configured =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.VERCEL_PROJECT_PRODUCTION_URL ||
    process.env.VERCEL_URL ||
    FALLBACK_SITE_URL;

  if (configured.startsWith("http://") || configured.startsWith("https://")) {
    return configured;
  }

  return `https://${configured}`;
}

export function getSiteHostLabel() {
  try {
    return new URL(getSiteUrl()).hostname;
  } catch {
    return "moosqa-ci4e.vercel.app";
  }
}
