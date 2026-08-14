import type { BrewPackage, PackageType } from "../types";

export function tapIsOfficial(tap: string | undefined, type: PackageType): boolean {
  const value = (tap || "").toLowerCase();
  if (!value) return true;
  if (type === "cask") {
    return value === "homebrew/cask" || value.startsWith("homebrew/cask");
  }
  return value === "homebrew/core" || value.startsWith("homebrew/");
}

export function tokenChannel(token: string): string | null {
  const at = token.indexOf("@");
  if (at < 0 || at === token.length - 1) return null;
  return token.slice(at + 1);
}

export function isCanonicalToken(token: string): boolean {
  return !tokenChannel(token);
}

export function isOfficialTapPkg(
  pkg: Pick<BrewPackage, "tap" | "type" | "official">,
): boolean {
  return pkg.official ?? tapIsOfficial(pkg.tap, pkg.type);
}

export function isOfficialCurrent(
  pkg: Pick<BrewPackage, "token" | "tap" | "type" | "official" | "deprecated" | "disabled">,
): boolean {
  return isOfficialTapPkg(pkg) && isCanonicalToken(pkg.token) && !pkg.deprecated && !pkg.disabled;
}

/** Lower is better: current official first, then versioned Homebrew, then others. */
export function trustRank(
  pkg: Pick<BrewPackage, "token" | "tap" | "type" | "official" | "deprecated" | "disabled">,
): number {
  if (pkg.disabled) return 40;
  if (pkg.deprecated) return 30;
  if (isOfficialCurrent(pkg)) return 0;
  if (isOfficialTapPkg(pkg) && tokenChannel(pkg.token)) return 10;
  if (isOfficialTapPkg(pkg)) return 5;
  return 20;
}
