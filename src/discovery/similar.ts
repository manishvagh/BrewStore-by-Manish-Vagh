import type { BrewPackage } from "../types";
import { packageKey } from "../categories";

/** Curated similarity clusters — packages in the same group are “similar”. */
export const SIMILAR_GROUPS: string[][] = [
  [
    "visual-studio-code",
    "cursor",
    "sublime-text",
    "atom",
    "zed",
    "nova",
    "bbedit",
    "vscode",
  ],
  ["google-chrome", "firefox", "brave-browser", "microsoft-edge", "opera", "arc", "vivaldi", "chromium"],
  ["iterm2", "warp", "alacritty", "kitty", "wezterm", "tabby", "hyper"],
  ["slack", "discord", "microsoft-teams", "zoom", "telegram", "signal", "whatsapp"],
  ["spotify", "vlc", "iina", "music", "audacity"],
  ["obsidian", "notion", "logseq", "bear", "typora", "ulysses", "craft"],
  ["rectangle", "magnet", "spectacle", "amethyst", "yabai", "betterdisplay"],
  ["docker", "docker-desktop", "orbstack", "podman", "rancher", "colima"],
  ["node", "python", "go", "rust", "ruby", "php", "java"],
  ["postgresql@16", "postgresql@15", "postgresql", "mysql", "mariadb", "mongodb-community", "redis", "sqlite"],
  ["figma", "sketch", "affinity-designer", "affinity-photo", "pixelmator-pro"],
  ["1password", "bitwarden", "keepassxc", "lastpass"],
];

function tokensInGroup(token: string): string[] | null {
  const needle = token.toLowerCase();
  for (const group of SIMILAR_GROUPS) {
    if (group.some((t) => t.toLowerCase() === needle)) {
      return group;
    }
  }
  return null;
}

function keywordOverlap(a: BrewPackage, b: BrewPackage): number {
  const words = (pkg: BrewPackage) =>
    new Set(
      `${pkg.name} ${pkg.desc}`
        .toLowerCase()
        .split(/[^a-z0-9+]+/)
        .filter((w) => w.length > 3),
    );
  const aw = words(a);
  const bw = words(b);
  let score = 0;
  for (const w of aw) {
    if (bw.has(w)) score += 1;
  }
  return score;
}

export function findSimilarPackages(
  pkg: BrewPackage,
  catalog: BrewPackage[],
  limit = 6,
): BrewPackage[] {
  const selfKey = packageKey(pkg);
  const group = tokensInGroup(pkg.token);
  const byToken = new Map(catalog.map((p) => [p.token.toLowerCase(), p]));

  const fromGroup: BrewPackage[] = [];
  if (group) {
    for (const token of group) {
      if (token.toLowerCase() === pkg.token.toLowerCase()) continue;
      const match = byToken.get(token.toLowerCase());
      if (match && packageKey(match) !== selfKey) {
        fromGroup.push(match);
      }
    }
  }

  if (fromGroup.length >= limit) {
    return fromGroup.slice(0, limit);
  }

  const seen = new Set(fromGroup.map((p) => packageKey(p)));
  seen.add(selfKey);

  const scored = catalog
    .filter((candidate) => !seen.has(packageKey(candidate)))
    .map((candidate) => {
      let score = 0;
      if (pkg.category && candidate.category === pkg.category) score += 4;
      if (pkg.type === candidate.type) score += 1;
      score += Math.min(keywordOverlap(pkg, candidate), 6);
      return { candidate, score };
    })
    .filter((row) => row.score >= 4)
    .sort((a, b) => b.score - a.score);

  for (const row of scored) {
    fromGroup.push(row.candidate);
    if (fromGroup.length >= limit) break;
  }

  return fromGroup.slice(0, limit);
}
