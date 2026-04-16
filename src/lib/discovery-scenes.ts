import { buildSceneArchiveHref } from "@/lib/archive-links";

export const SCENE_DISCOVERY_RULES = [
  {
    slug: "soft-focus",
    title: "Soft focus",
    description: "Dream-pop, shoegaze and blurred melodic releases with softer edges.",
    keywords: ["dream pop", "shoegaze", "ethereal", "slowcore", "bedroom pop"],
  },
  {
    slug: "night-drive",
    title: "Night drive",
    description: "Dark post-punk, synth-led and nocturnal guitar records with momentum.",
    keywords: ["post-punk", "darkwave", "synth-pop", "new wave", "gothic rock"],
  },
  {
    slug: "nervy-guitars",
    title: "Nervy guitars",
    description: "Math rock, emo and wiry indie bands built around tension and movement.",
    keywords: ["math rock", "emo", "midwest emo", "post-hardcore", "art rock"],
  },
  {
    slug: "quiet-drift",
    title: "Quiet drift",
    description: "Ambient folk, intimate songwriting and low-lit slower records.",
    keywords: ["folk", "ambient", "singer-songwriter", "chamber pop", "indie folk"],
  },
  {
    slug: "high-tension",
    title: "High tension",
    description: "Noise, punk and heavier guitar releases pushing harder energy.",
    keywords: ["noise rock", "punk", "hardcore", "grunge", "noise pop"],
  },
] as const;

export type DiscoverySceneDefinition = (typeof SCENE_DISCOVERY_RULES)[number];

export function matchSceneForGenre(genre: string) {
  const normalized = genre.toLowerCase();
  return (
    SCENE_DISCOVERY_RULES.find((rule) =>
      rule.keywords.some((keyword) => normalized.includes(keyword.toLowerCase())),
    ) || null
  );
}

export function getSceneDefinitionBySlug(sceneSlug: string) {
  return SCENE_DISCOVERY_RULES.find((rule) => rule.slug === sceneSlug) || null;
}

export function isDiscoverySceneSlug(value: string) {
  return SCENE_DISCOVERY_RULES.some((rule) => rule.slug === value);
}

export function buildSceneShareHref(sceneSlug: string) {
  return buildSceneArchiveHref(sceneSlug);
}
