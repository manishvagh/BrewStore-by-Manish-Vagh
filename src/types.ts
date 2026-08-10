export type PackageType = "cask" | "formula";

export interface BrewPackage {
  id: string;
  token: string;
  name: string;
  desc: string;
  homepage: string;
  version: string;
  tap: string;
  type: PackageType;
  license: string | null;
  appNames?: string[];
  urls: {
    stable: string | null;
    head: string | null;
  };
  outdated?: boolean;
  installed?: boolean;
  category?: string;
}

export interface CatalogPayload {
  cachedAt: number;
  packages: BrewPackage[];
  counts: {
    casks: number;
    formulae: number;
    total: number;
  };
}

export interface TrendingPayload {
  cachedAt: number;
  casks: Array<{ token: string; count: number }>;
  formulae: Array<{ token: string; count: number }>;
  error?: string;
}

export interface InstalledMap {
  [key: string]: {
    id: string;
    type: PackageType;
    version: string;
  };
}

export interface OutdatedMap {
  [key: string]: {
    id: string;
    type: PackageType;
    current: string;
    latest: string;
  };
}

export interface BrewProgress {
  action: string;
  id?: string;
  text: string;
}

export type ThemePreference = "system" | "light" | "dark";

export interface BrewStatus {
  installed: boolean;
  brewPath?: string;
  version?: string;
  code?: string;
  installCommand: string;
  brewSite: string;
}

export interface BrewStoreApi {
  getBrewInfo: () => Promise<{ brewPath: string; version: string }>;
  getBrewStatus: () => Promise<BrewStatus>;
  recheckBrew: () => Promise<BrewStatus>;
  installHomebrew: () => Promise<BrewStatus>;
  writeClipboardText: (text: string) => Promise<{ ok: boolean }>;
  loadCatalog: (opts?: { force?: boolean }) => Promise<CatalogPayload>;
  loadTrending: (opts?: { force?: boolean }) => Promise<TrendingPayload>;
  getInstalled: () => Promise<InstalledMap>;
  getOutdated: () => Promise<OutdatedMap>;
  install: (pkg: { id: string; type: PackageType }) => Promise<{ ok: boolean }>;
  uninstall: (pkg: { id: string; type: PackageType }) => Promise<{ ok: boolean }>;
  upgrade: (pkg: { id: string; type: PackageType }) => Promise<{ ok: boolean }>;
  upgradeAll: () => Promise<{ ok: boolean }>;
  openExternal: (url: string) => Promise<{ ok: boolean }>;
  resolveIcons: (
    packages: Array<Pick<BrewPackage, "id" | "type" | "name" | "token" | "homepage" | "appNames">>,
  ) => Promise<Record<string, string | null>>;
  setTheme: (
    preference: ThemePreference,
  ) => Promise<{ ok: boolean; shouldUseDarkColors: boolean }>;
  onProgress: (callback: (data: BrewProgress) => void) => () => void;
}

declare global {
  interface Window {
    brewStore: BrewStoreApi;
  }
}
