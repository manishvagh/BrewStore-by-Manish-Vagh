import type { BrewPackage } from "../types";
import { getCategory, packageKey } from "../categories";
import { SIMILAR_GROUPS } from "./similar";
import { isCanonicalToken, trustRank } from "../lib/trust";

function groupForToken(token: string): string[] | null {
  const needle = token.toLowerCase();
  for (const group of SIMILAR_GROUPS) {
    if (group.some((t) => t.toLowerCase() === needle)) return group;
  }
  return null;
}

export interface ForYouResult {
  packages: BrewPackage[];
  blurb: string;
}

/**
 * Recommend uninstalled packages based on what is already installed.
 */
export function recommendForYou(
  catalog: BrewPackage[],
  limit = 8,
): ForYouResult {
  const installed = catalog.filter((pkg) => pkg.installed);
  if (installed.length === 0) {
    return { packages: [], blurb: "Similar to apps on this Mac" };
  }

  const installedKeys = new Set(installed.map((pkg) => packageKey(pkg)));
  const installedCategories = new Map<string, number>();
  const relatedTokens = new Set<string>();

  for (const pkg of installed) {
    if (pkg.category) {
      installedCategories.set(
        pkg.category,
        (installedCategories.get(pkg.category) || 0) + 1,
      );
    }
    const group = groupForToken(pkg.token);
    if (group) {
      for (const token of group) relatedTokens.add(token.toLowerCase());
    }
  }

  const topCategoryId = [...installedCategories.entries()].sort(
    (a, b) => b[1] - a[1],
  )[0]?.[0];
  const topCategory = topCategoryId ? getCategory(topCategoryId)?.name : null;
  const blurb = topCategory
    ? `Because you use ${topCategory}`
    : "Similar to apps on this Mac";

  const scored = catalog
    .filter((pkg) => {
      if (installedKeys.has(packageKey(pkg))) return false;
      if (pkg.deprecated || pkg.disabled) return false;
      if (!isCanonicalToken(pkg.token)) return false;
      return true;
    })
    .map((pkg) => {
      let score = 0;
      if (pkg.category && installedCategories.has(pkg.category)) {
        score += 3 + (installedCategories.get(pkg.category) || 0);
      }
      if (relatedTokens.has(pkg.token.toLowerCase())) {
        score += 10;
      }
      if (pkg.type === "cask") score += 0.5;
      score -= trustRank(pkg) / 20;
      return { pkg, score };
    })
    .filter((row) => row.score >= 3)
    .sort((a, b) => b.score - a.score);

  const picks: BrewPackage[] = [];
  const seen = new Set<string>();
  for (const row of scored) {
    const key = packageKey(row.pkg);
    if (seen.has(key)) continue;
    seen.add(key);
    picks.push(row.pkg);
    if (picks.length >= limit) break;
  }
  return { packages: picks, blurb };
}
