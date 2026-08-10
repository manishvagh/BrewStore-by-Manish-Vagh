import type { BrewPackage } from "../types";
import { packageKey } from "../categories";

export interface TrendingPayload {
  cachedAt: number;
  casks: Array<{ token: string; count: number }>;
  formulae: Array<{ token: string; count: number }>;
}

const FALLBACK_TRENDING: Array<{ token: string; type: "cask" | "formula" }> = [
  { token: "visual-studio-code", type: "cask" },
  { token: "google-chrome", type: "cask" },
  { token: "firefox", type: "cask" },
  { token: "iterm2", type: "cask" },
  { token: "docker-desktop", type: "cask" },
  { token: "slack", type: "cask" },
  { token: "spotify", type: "cask" },
  { token: "rectangle", type: "cask" },
  { token: "node", type: "formula" },
  { token: "git", type: "formula" },
  { token: "python", type: "formula" },
  { token: "wget", type: "formula" },
];

export function resolveTrending(
  catalog: BrewPackage[],
  trending: TrendingPayload | null,
  limit = 16,
): BrewPackage[] {
  const byTokenType = new Map(
    catalog.map((pkg) => [`${pkg.type}:${pkg.token.toLowerCase()}`, pkg]),
  );
  const picks: BrewPackage[] = [];
  const seen = new Set<string>();

  const push = (pkg: BrewPackage | undefined) => {
    if (!pkg) return;
    const key = packageKey(pkg);
    if (seen.has(key)) return;
    seen.add(key);
    picks.push(pkg);
  };

  if (trending) {
    for (const row of trending.casks) {
      push(byTokenType.get(`cask:${row.token.toLowerCase()}`));
      if (picks.length >= limit) return picks;
    }
    for (const row of trending.formulae) {
      push(byTokenType.get(`formula:${row.token.toLowerCase()}`));
      if (picks.length >= limit) return picks;
    }
  }

  for (const row of FALLBACK_TRENDING) {
    push(byTokenType.get(`${row.type}:${row.token.toLowerCase()}`));
    if (picks.length >= limit) break;
  }

  return picks;
}
