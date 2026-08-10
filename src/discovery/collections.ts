import type { BrewPackage, PackageType } from "../types";
import { packageKey } from "../categories";

export interface CollectionItem {
  token: string;
  type: PackageType;
}

export interface Collection {
  id: string;
  name: string;
  blurb: string;
  items: CollectionItem[];
}

export const COLLECTIONS: Collection[] = [
  {
    id: "new-mac-setup",
    name: "New Mac setup",
    blurb: "Essentials to feel at home on a fresh Mac",
    items: [
      { token: "google-chrome", type: "cask" },
      { token: "visual-studio-code", type: "cask" },
      { token: "iterm2", type: "cask" },
      { token: "rectangle", type: "cask" },
      { token: "appcleaner", type: "cask" },
      { token: "the-unarchiver", type: "cask" },
      { token: "spotify", type: "cask" },
      { token: "slack", type: "cask" },
      { token: "git", type: "formula" },
      { token: "wget", type: "formula" },
    ],
  },
  {
    id: "designers",
    name: "Designers",
    blurb: "Illustration, UI, and creative tooling",
    items: [
      { token: "figma", type: "cask" },
      { token: "sketch", type: "cask" },
      { token: "affinity-designer", type: "cask" },
      { token: "affinity-photo", type: "cask" },
      { token: "blender", type: "cask" },
      { token: "inkscape", type: "cask" },
      { token: "gimp", type: "cask" },
      { token: "imageoptim", type: "cask" },
    ],
  },
  {
    id: "cli-essentials",
    name: "CLI essentials",
    blurb: "Everyday command-line tools developers reach for",
    items: [
      { token: "git", type: "formula" },
      { token: "gh", type: "formula" },
      { token: "curl", type: "formula" },
      { token: "jq", type: "formula" },
      { token: "ripgrep", type: "formula" },
      { token: "fd", type: "formula" },
      { token: "bat", type: "formula" },
      { token: "eza", type: "formula" },
      { token: "htop", type: "formula" },
      { token: "tmux", type: "formula" },
      { token: "wget", type: "formula" },
      { token: "tree", type: "formula" },
    ],
  },
  {
    id: "dev-stack",
    name: "Dev stack",
    blurb: "Languages, runtimes, and containers",
    items: [
      { token: "node", type: "formula" },
      { token: "python", type: "formula" },
      { token: "go", type: "formula" },
      { token: "rust", type: "formula" },
      { token: "docker", type: "formula" },
      { token: "docker-desktop", type: "cask" },
      { token: "postgresql@16", type: "formula" },
      { token: "redis", type: "formula" },
      { token: "visual-studio-code", type: "cask" },
      { token: "cursor", type: "cask" },
    ],
  },
];

export function resolveCollection(
  collection: Collection,
  packages: BrewPackage[],
): BrewPackage[] {
  const byKey = new Map(packages.map((pkg) => [packageKey(pkg), pkg]));
  const byTokenType = new Map(
    packages.map((pkg) => [`${pkg.type}:${pkg.token}`, pkg]),
  );
  const resolved: BrewPackage[] = [];
  for (const item of collection.items) {
    const pkg =
      byTokenType.get(`${item.type}:${item.token}`) ||
      byKey.get(`${item.type}:${item.token}`);
    if (pkg) resolved.push(pkg);
  }
  return resolved;
}
