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

export interface BrewTap {
  name: string;
  official: boolean;
  removable: boolean;
}

export interface BrewService {
  name: string;
  status: string;
  user: string | null;
  file: string | null;
}

export interface CleanupPreview {
  items: Array<{ path: string; bytes: number }>;
  reclaimableBytes: number;
  raw: string;
}

export interface DoctorFinding {
  severity: "error" | "warning" | "note";
  message: string;
}

export interface DoctorReport {
  ok: boolean;
  code: number;
  findings: DoctorFinding[];
  raw: string;
}

export interface DiskUsageInfo {
  id: string;
  type: PackageType;
  bytes: number;
  path: string | null;
  missing?: boolean;
}

export interface AppUpdateInfo {
  updateAvailable: boolean;
  currentVersion: string;
  latestVersion: string;
  releaseUrl: string;
  downloadUrl: string | null;
  notes: string;
  publishedAt: string | null;
}

export interface BrewStoreApi {
  getBrewInfo: () => Promise<{ brewPath: string; version: string }>;
  getBrewStatus: () => Promise<BrewStatus>;
  recheckBrew: () => Promise<BrewStatus>;
  installHomebrew: () => Promise<BrewStatus>;
  getAppVersion: () => Promise<{ version: string; name: string }>;
  checkForUpdate: () => Promise<AppUpdateInfo>;
  writeClipboardText: (text: string) => Promise<{ ok: boolean }>;
  loadCatalog: (opts?: { force?: boolean }) => Promise<CatalogPayload>;
  loadTrending: (opts?: { force?: boolean }) => Promise<TrendingPayload>;
  getInstalled: () => Promise<InstalledMap>;
  getOutdated: () => Promise<OutdatedMap>;
  install: (pkg: { id: string; type: PackageType }) => Promise<{ ok: boolean }>;
  uninstall: (pkg: { id: string; type: PackageType }) => Promise<{ ok: boolean }>;
  upgrade: (pkg: { id: string; type: PackageType }) => Promise<{ ok: boolean }>;
  upgradeAll: () => Promise<{ ok: boolean }>;
  getDiskUsage: (
    packages: Array<{ id: string; type: PackageType }>,
  ) => Promise<Record<string, DiskUsageInfo>>;
  listTaps: () => Promise<BrewTap[]>;
  addTap: (name: string) => Promise<BrewTap[]>;
  removeTap: (name: string) => Promise<BrewTap[]>;
  listPinned: () => Promise<string[]>;
  pin: (pkg: { id: string; type: PackageType }) => Promise<{ ok: boolean; pinned: string[] }>;
  unpin: (pkg: { id: string; type: PackageType }) => Promise<{ ok: boolean; pinned: string[] }>;
  cleanupDryRun: () => Promise<CleanupPreview>;
  cleanup: () => Promise<{ ok: boolean }>;
  doctor: () => Promise<DoctorReport>;
  listServices: () => Promise<BrewService[]>;
  serviceAction: (payload: {
    name: string;
    action: "start" | "stop" | "restart";
  }) => Promise<BrewService[]>;
  getDeps: (pkg: { id: string; type: PackageType }) => Promise<string[]>;
  getDependents: (pkg: { id: string; type: PackageType }) => Promise<string[]>;
  bundleExport: () => Promise<{ ok: boolean; canceled?: boolean; path?: string }>;
  bundleImport: () => Promise<{ ok: boolean; canceled?: boolean; path?: string }>;
  openExternal: (url: string) => Promise<{ ok: boolean }>;
  openInstalledApp: (pkg: {
    id: string;
    type: PackageType;
    name?: string;
    appNames?: string[];
  }) => Promise<{ ok: boolean; app?: string; error?: string }>;
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
