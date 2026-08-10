import type { BrewPackage } from "../types";
import { packageKey } from "../categories";
import { SIMILAR_GROUPS } from "./similar";

function groupForToken(token: string): string[] | null {
  const needle = token.toLowerCase();
  for (const group of SIMILAR_GROUPS) {
    if (group.some((t) => t.toLowerCase() === needle)) return group;
  }
  return null;
}

/**
 * Recommend uninstalled packages based on what is already installed.
 */
export function recommendForYou(
  catalog: BrewPackage[],
  limit = 12,
): BrewPackage[] {
  const installed = catalog.filter((pkg) => pkg.installed);
  if (installed.length === 0) return [];

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

  const scored = catalog
    .filter((pkg) => !installedKeys.has(packageKey(pkg)))
    .map((pkg) => {
      let score = 0;
      if (pkg.category && installedCategories.has(pkg.category)) {
        score += 3 + (installedCategories.get(pkg.category) || 0);
      }
      if (relatedTokens.has(pkg.token.toLowerCase())) {
        score += 10;
      }
      // Prefer GUI apps for discovery feel when score is otherwise tied
      if (pkg.type === "cask") score += 0.5;
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
  return picks;
}
