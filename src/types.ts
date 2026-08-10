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

export interface BrewStoreApi {
  getBrewInfo: () => Promise<{ brewPath: string; version: string }>;
  loadCatalog: (opts?: { force?: boolean }) => Promise<CatalogPayload>;
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
  onProgress: (callback: (data: BrewProgress) => void) => () => void;
}

declare global {
  interface Window {
    brewStore: BrewStoreApi;
  }
}
