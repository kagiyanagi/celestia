import { withSoftTimeout } from "@/lib/async";
import { getAniZipData, pickAniZipBanner } from "@/lib/providers/anizip";
import { getTmdbBackdrop, isTmdbConfigured } from "@/lib/providers/tmdb";
import type { AnimeSummary } from "@/types/anime";

/**
 * AniList has no banner for many titles. Fall back to ani.zip fanart/banner
 * artwork, then a TMDB backdrop. ani.zip is cached and request-deduped, so
 * repeated lookups across surfaces are effectively free once warm.
 */
export async function resolveBannerFallback(
  anilistId: number,
): Promise<string | null> {
  const aniZip = await getAniZipData(anilistId);
  const fromArtwork = pickAniZipBanner(aniZip?.images || []);
  if (fromArtwork) {
    return fromArtwork;
  }

  const tmdbId = aniZip?.mappings.themoviedbId ?? null;
  if (tmdbId && isTmdbConfigured()) {
    return getTmdbBackdrop(tmdbId, aniZip?.mappings.type ?? null);
  }

  return null;
}

/**
 * Fills missing banners on a list of summaries in place, with bounded
 * concurrency and an overall soft timeout. Summaries that already have a
 * banner are skipped, so warm/banner-complete lists cost nothing. On timeout
 * the partial result is kept and the rest keeps warming provider caches for
 * the next load (same trade-off as withSoftTimeout elsewhere).
 */
export async function enrichSummaryBanners<T extends AnimeSummary>(
  summaries: T[],
  options: { concurrency?: number; timeoutMs?: number } = {},
): Promise<T[]> {
  const missing = summaries.filter(
    (summary) => !summary.bannerImage && summary.id,
  );
  if (missing.length === 0) {
    return summaries;
  }

  const concurrency = Math.min(options.concurrency ?? 6, missing.length);

  const run = async () => {
    let cursor = 0;
    const worker = async () => {
      while (cursor < missing.length) {
        const summary = missing[cursor];
        cursor += 1;
        const banner = await resolveBannerFallback(summary.id).catch(
          () => null,
        );
        if (banner) {
          summary.bannerImage = banner;
        }
      }
    };
    await Promise.all(Array.from({ length: concurrency }, worker));
  };

  await withSoftTimeout<void>(run(), options.timeoutMs ?? 5_000, undefined);
  return summaries;
}
