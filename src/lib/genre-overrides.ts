type GenreOverrideInput = {
  artistName?: string | null;
  projectTitle?: string | null;
  title?: string | null;
};

const RELEASE_GENRE_OVERRIDES = new Map<string, string>([
  ["ohuhitsshylo::toxic wrld", "melodic rap / emo rap / alternative pop"],
  ["yttling jazz bobby gillespie::strange", "cinematic jazz / indie pop / jazz-pop"],
  ["olive vox::14 years", "alternative rock / punk rock / progressive rock"],
  ["trip villain vixen maw::villain maw", "industrial metal / industrial techno / metal"],
  ["trip villain::villain maw", "industrial metal / industrial techno / metal"],
  ["jose gonzalez::against the dying of the light", "indie folk / singer-songwriter / acoustic folk"],
  ["dream sitch::3", "psychedelic folk / indie folk / cosmic Americana"],
  ["rich packman::symptoms of you", "alternative rock / punk rock / emo"],
  ["rogue wave::descended like vultures", "indie rock / folk rock / power pop"],
  ["butler blake grant::murmurs", "folk rock / chamber pop / singer-songwriter"],
  ["eilish constance::tethered", "indie folk / dream pop / alternative pop"],
  ["potionseller::sniper rifle", "alternative rock / emo / indie rock"],
  ["irreversible entanglements::future present past", "spiritual jazz / free jazz / avant-jazz"],
  ["actress and suzanne ciani::concrete waves", "experimental electronic / ambient / electroacoustic"],
  ["nerve agent::burlo la ley", "hardcore punk / melodic hardcore / punk rock"],
  ["give love::found you", "soulful house / alternative dance / sample-based house"],
  ["leon larregui::manifiesto de un tremendo delirio", "psychedelic pop / latin alternative / dream pop"],
  ["the clockworks::the entertainment", "post-punk / indie rock / garage rock"],
  ["heddy edwards::the other side of town", "dream pop / shoegaze / alternative pop"],
  ["julia cumming::please let me remember this", "baroque pop / singer-songwriter / indie pop"],
]);

const ARTIST_GENRE_OVERRIDES = new Map<string, string>([
  ["actress and suzanne ciani", "experimental electronic / ambient / electroacoustic"],
  ["arushi jain", "ambient electronic / indian classical / modular ambient"],
  ["butler blake grant", "folk rock / chamber pop / singer-songwriter"],
  ["don broco", "post-hardcore / alternative rock / hard rock"],
  ["dream sitch", "psychedelic folk / indie folk / cosmic Americana"],
  ["eilish constance", "indie folk / dream pop / alternative pop"],
  ["empress of", "alternative pop / synth-pop / electropop"],
  ["felicia atkinson", "ambient / electroacoustic / experimental electronic"],
  ["give love", "soulful house / alternative dance / sample-based house"],
  ["hannah jadagu", "bedroom pop / indie rock / alternative pop"],
  ["heddy edwards", "dream pop / shoegaze / alternative pop"],
  ["irreversible entanglements", "spiritual jazz / free jazz / avant-jazz"],
  ["jordan rakei", "neo-soul / jazz-funk / alternative r&b"],
  ["jose gonzalez", "indie folk / singer-songwriter / acoustic folk"],
  ["julia cumming", "baroque pop / singer-songwriter / indie pop"],
  ["keep shelly in athens", "dream pop / chillwave / synth-pop"],
  ["lava la rue", "psychedelic hip-hop / alternative r&b / neo-soul"],
  ["leon larregui", "psychedelic pop / latin alternative / dream pop"],
  ["luke black", "electropop / dance-pop / dark pop"],
  ["marshmello", "dance-pop / electronic pop / future bass"],
  ["marshmello and portugal the man", "dance-pop / alternative pop / indie pop"],
  ["nia archives", "jungle / drum and bass / breakbeat hardcore"],
  ["nerve agent", "hardcore punk / melodic hardcore / punk rock"],
  ["patrick watson", "chamber pop / art folk / singer-songwriter"],
  ["potionseller", "alternative rock / emo / indie rock"],
  ["rich packman", "alternative rock / punk rock / emo"],
  ["rogue wave", "indie rock / folk rock / power pop"],
  ["sophie may", "folk pop / singer-songwriter / chamber pop"],
  ["the boxer rebellion", "indie rock / alternative rock / post-britpop"],
  ["the clockworks", "post-punk / indie rock / garage rock"],
  ["the fall", "post-punk / indie rock / alternative dance"],
  ["tom misch", "neo-soul / jazz-funk / nu jazz"],
]);

export function getGenreOverride(input: GenreOverrideInput) {
  const normalizedArtist = normalizeKeyPart(resolveArtistHint(input));
  const normalizedProject = normalizeKeyPart(input.projectTitle || "");
  const normalizedTitle = normalizeKeyPart(extractWorkHint(input));

  if (normalizedArtist && normalizedProject) {
    const releaseMatch = RELEASE_GENRE_OVERRIDES.get(`${normalizedArtist}::${normalizedProject}`);
    if (releaseMatch) {
      return releaseMatch;
    }
  }

  if (normalizedArtist && normalizedTitle) {
    const titleMatch = RELEASE_GENRE_OVERRIDES.get(`${normalizedArtist}::${normalizedTitle}`);
    if (titleMatch) {
      return titleMatch;
    }
  }

  if (normalizedArtist) {
    const artistMatch = ARTIST_GENRE_OVERRIDES.get(normalizedArtist);
    if (artistMatch) {
      return artistMatch;
    }
  }

  return null;
}

function resolveArtistHint(input: GenreOverrideInput) {
  return input.artistName || splitArtistAndWork(input.projectTitle || "")?.artist || splitArtistAndWork(input.title || "")?.artist || "";
}

function extractWorkHint(input: GenreOverrideInput) {
  return (
    splitArtistAndWork(input.projectTitle || "")?.work ||
    splitArtistAndWork(input.title || "")?.work ||
    input.projectTitle ||
    input.title ||
    ""
  );
}

function splitArtistAndWork(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const dashMatch = trimmed.match(/^(.+?)\s*[-–—]\s*(.+)$/);
  if (dashMatch) {
    return {
      artist: dashMatch[1].trim(),
      work: dashMatch[2].trim(),
    };
  }

  const quoteMatch = trimmed.match(/^(.+?)\s["“](.+?)["”]$/);
  if (quoteMatch) {
    return {
      artist: quoteMatch[1].trim(),
      work: quoteMatch[2].trim(),
    };
  }

  return null;
}

function normalizeKeyPart(value: string) {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/\b(feat\.?|featuring|ft\.?)\b/g, " ")
    .replace(/\([^)]*\)/g, " ")
    .replace(/[()[\]{}]/g, " ")
    .replace(/[â€“â€”-]/g, " ")
    .replace(/\b20\d{2}\b/g, " ")
    .replace(/\b(expanded edition|expanded|deluxe edition|deluxe|director'?s cut|anniversary)\b/g, " ")
    .replace(/\bmarshmellow\b/g, "marshmello")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}
