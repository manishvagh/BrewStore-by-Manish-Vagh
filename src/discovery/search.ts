import type { BrewPackage, PackageType } from "../types";
import { trustRank } from "../lib/trust";

export interface SearchFilters {
  cask: boolean;
  formula: boolean;
  installed: boolean;
  notInstalled: boolean;
  outdated: boolean;
  gui: boolean;
  openSource: boolean;
}

export type SearchFilterKey = keyof SearchFilters;

export const DEFAULT_SEARCH_FILTERS: SearchFilters = {
  cask: false,
  formula: false,
  installed: false,
  notInstalled: false,
  outdated: false,
  gui: false,
  openSource: false,
};

export const SEARCH_FILTER_OPTIONS: {
  id: keyof SearchFilters;
  label: string;
}[] = [
  { id: "cask", label: "Casks" },
  { id: "formula", label: "Formulae" },
  { id: "installed", label: "Installed" },
  { id: "notInstalled", label: "Not installed" },
  { id: "outdated", label: "Outdated" },
  { id: "gui", label: "GUI apps" },
  { id: "openSource", label: "Open source" },
];

const SYNONYMS: Record<string, string[]> = {
  vscode: ["visual-studio-code", "code"],
  "vs code": ["visual-studio-code"],
  chrome: ["google-chrome", "chromium"],
  firefox: ["firefox"],
  node: ["node", "nodejs"],
  nodejs: ["node"],
  python: ["python", "python@3.12", "python@3.11"],
  postgres: ["postgresql@16", "postgresql@15", "postgresql", "postgres"],
  postgresql: ["postgresql@16", "postgresql@15", "postgresql"],
  docker: ["docker", "docker-desktop", "colima", "orbstack"],
  terminal: ["iterm2", "warp", "alacritty", "kitty", "wezterm"],
  iterm: ["iterm2"],
  editor: ["visual-studio-code", "cursor", "sublime-text", "zed"],
  ide: ["visual-studio-code", "cursor", "intellij-idea", "webstorm"],
  notes: ["obsidian", "notion", "logseq", "bear"],
  password: ["1password", "bitwarden", "keepassxc"],
  music: ["spotify", "vlc", "iina"],
  browser: ["google-chrome", "firefox", "brave-browser", "arc", "microsoft-edge"],
  git: ["git", "gh", "git-lfs"],
  k8s: ["kubernetes-cli", "kubectl", "helm", "minikube"],
  kubernetes: ["kubernetes-cli", "kubectl"],
};

const OPEN_SOURCE_RE =
  /\b(mit|apache|gpl|lgpl|agpl|bsd|mpl|isc|unlicense|artistic|zlib|boost|postgresql)\b/i;
const PROPRIETARY_RE = /\b(proprietary|commercial|closed[\s-]?source)\b/i;

function isOpenSource(pkg: BrewPackage): boolean {
  if (!pkg.license) {
    // Many casks omit license; treat unknown casks as not matching open-source filter
    return pkg.type === "formula";
  }
  if (PROPRIETARY_RE.test(pkg.license)) return false;
  return OPEN_SOURCE_RE.test(pkg.license) || /^(mit|apache-2\.0|bsd-2-clause|bsd-3-clause|gpl|mpl)/i.test(pkg.license);
}

function isGui(pkg: BrewPackage): boolean {
  return pkg.type === "cask" || Boolean(pkg.appNames && pkg.appNames.length > 0);
}

function expandQuery(query: string): string[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const terms = new Set<string>([q, ...q.split(/\s+/).filter(Boolean)]);
  for (const [key, values] of Object.entries(SYNONYMS)) {
    if (q === key || q.includes(key) || key.includes(q)) {
      for (const v of values) terms.add(v);
    }
  }
  return [...terms];
}

/** Lightweight subsequence fuzzy: all chars of needle appear in order in hay. */
function fuzzyMatch(hay: string, needle: string): boolean {
  if (!needle) return true;
  if (hay.includes(needle)) return true;
  let hi = 0;
  for (let ni = 0; ni < needle.length; ni++) {
    const ch = needle[ni];
    hi = hay.indexOf(ch, hi);
    if (hi === -1) return false;
    hi += 1;
  }
  return true;
}

function scorePackage(pkg: BrewPackage, terms: string[]): number {
  const name = pkg.name.toLowerCase();
  const token = pkg.token.toLowerCase();
  const desc = (pkg.desc || "").toLowerCase();
  let best = 0;
  for (const term of terms) {
    if (!term) continue;
    if (token === term) best = Math.max(best, 100);
    else if (name === term) best = Math.max(best, 95);
    else if (token.startsWith(term)) best = Math.max(best, 80);
    else if (name.startsWith(term)) best = Math.max(best, 75);
    else if (token.includes(term)) best = Math.max(best, 60);
    else if (name.includes(term)) best = Math.max(best, 55);
    else if (desc.includes(term)) best = Math.max(best, 30);
    else if (fuzzyMatch(token, term) || fuzzyMatch(name, term)) best = Math.max(best, 20);
  }
  if (best > 0) {
    best += Math.max(0, 8 - trustRank(pkg));
  }
  return best;
}

function passesFilters(pkg: BrewPackage, filters: SearchFilters): boolean {
  const typeFilters: PackageType[] = [];
  if (filters.cask) typeFilters.push("cask");
  if (filters.formula) typeFilters.push("formula");
  if (typeFilters.length && !typeFilters.includes(pkg.type)) return false;

  if (filters.installed && filters.notInstalled) {
    // both = no restriction
  } else if (filters.installed && !pkg.installed) {
    return false;
  } else if (filters.notInstalled && pkg.installed) {
    return false;
  }

  if (filters.gui && !isGui(pkg)) return false;
  if (filters.outdated && !pkg.outdated) return false;
  if (filters.openSource && !isOpenSource(pkg)) return false;
  return true;
}

export interface CatalogIndex {
  packages: BrewPackage[];
  inv: Map<string, number[]>;
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9@.+-]+/)
    .filter((t) => t.length > 1);
}

export function buildCatalogIndex(packages: BrewPackage[]): CatalogIndex {
  const inv = new Map<string, number[]>();
  packages.forEach((pkg, i) => {
    const tokens = new Set([
      ...tokenize(pkg.token),
      ...tokenize(pkg.name),
      ...tokenize((pkg.desc || "").slice(0, 180)),
    ]);
    for (const token of tokens) {
      const list = inv.get(token);
      if (list) list.push(i);
      else inv.set(token, [i]);
    }
  });
  return { packages, inv };
}

export function searchPackages(
  packages: BrewPackage[],
  query: string,
  filters: SearchFilters = DEFAULT_SEARCH_FILTERS,
  index?: CatalogIndex | null,
): BrewPackage[] {
  const q = query.trim();
  let pool = packages;
  if (q && index && index.packages === packages) {
    const terms = expandQuery(q);
    const hits = new Set<number>();
    for (const term of terms) {
      const exact = index.inv.get(term);
      if (exact) for (const i of exact) hits.add(i);
      if (term.length >= 2) {
        for (const [token, ids] of index.inv) {
          if (token.startsWith(term)) {
            for (const i of ids) hits.add(i);
          }
        }
      }
    }
    if (hits.size) {
      pool = [...hits].map((i) => index.packages[i]).filter(Boolean);
    }
  }

  const filtered = pool.filter((pkg) => passesFilters(pkg, filters));
  if (!q) {
    return [...filtered].sort((a, b) => {
      const nameCmp = a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
      if (nameCmp) return nameCmp;
      const trustCmp = trustRank(a) - trustRank(b);
      if (trustCmp) return trustCmp;
      return a.token.localeCompare(b.token);
    });
  }

  const terms = expandQuery(q);
  return filtered
    .map((pkg) => ({ pkg, score: scorePackage(pkg, terms) }))
    .filter((row) => row.score > 0)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      const trustCmp = trustRank(a.pkg) - trustRank(b.pkg);
      if (trustCmp) return trustCmp;
      return a.pkg.token.localeCompare(b.pkg.token);
    })
    .map((row) => row.pkg);
}
