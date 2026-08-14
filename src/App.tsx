import { useCallback, useEffect, useMemo, useRef, useState, startTransition } from "react";
import {
  Compass,
  Grid2x2,
  Download,
  ArrowUpCircle,
  Info,
  Search,
  RefreshCw,
  Wrench,
} from "lucide-react";
import { CATEGORIES, getCategory, packageKey, withCategories } from "./categories";
import type {
  ActivitySnapshot,
  AppUpdateInfo,
  BrewFreshness,
  BrewPackage,
  BrewStatus,
  InstalledMap,
  OutdatedMap,
  PackageAction,
  TrendingPayload,
} from "./types";
import { DiscoverView } from "./components/DiscoverView";
import { CategoriesView } from "./components/CategoriesView";
import { CategoryDetail } from "./components/CategoryDetail";
import { PackageGrid } from "./components/PackageGrid";
import { PackageDetail } from "./components/PackageDetail";
import { CreditsView } from "./components/CreditsView";
import { UpdatesView } from "./components/UpdatesView";
import { ActionLog } from "./components/ActionLog";
import { ThemeToggle } from "./components/ThemeToggle";
import { BrewOnboarding } from "./components/BrewOnboarding";
import { MaintainView } from "./components/MaintainView";
import { CommandPalette, type PaletteAction } from "./components/CommandPalette";
import { UpdateBanner } from "./components/UpdateBanner";
import { useTheme } from "./hooks/useTheme";
import { COLLECTIONS, resolveCollection } from "./discovery/collections";
import { recommendForYou } from "./discovery/recommend";
import { findSimilarPackages } from "./discovery/similar";
import {
  DEFAULT_SEARCH_FILTERS,
  SEARCH_FILTER_OPTIONS,
  buildCatalogIndex,
  searchPackages,
  type SearchFilters,
} from "./discovery/search";
import { resolveTrending } from "./discovery/trending";
import { brewInstallCommand, formatAge } from "./lib/format";
import { PAYPAL_SUPPORT_URL } from "./lib/donate";
import "./App.css";

type NavId =
  | "discover"
  | "categories"
  | "installed"
  | "updates"
  | "maintain"
  | "credits";

const NAV: { id: NavId; label: string; icon: typeof Compass }[] = [
  { id: "discover", label: "Discover", icon: Compass },
  { id: "categories", label: "Categories", icon: Grid2x2 },
  { id: "installed", label: "Installed", icon: Download },
  { id: "updates", label: "Updates", icon: ArrowUpCircle },
  { id: "maintain", label: "Maintain", icon: Wrench },
  { id: "credits", label: "Credits", icon: Info },
];

const FALLBACK_BREW_MISSING: Pick<BrewStatus, "brewSite"> = {
  brewSite: "https://brew.sh",
};

function App() {
  const { preference: themePreference, setPreference: setThemePreference } = useTheme();
  const [nav, setNav] = useState<NavId>("discover");
  const [packages, setPackages] = useState<BrewPackage[]>([]);
  const [installed, setInstalled] = useState<InstalledMap>({});
  const [outdated, setOutdated] = useState<OutdatedMap>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [brewMissing, setBrewMissing] = useState<Pick<BrewStatus, "brewSite"> | null>(
    null,
  );
  const [checkingBrew, setCheckingBrew] = useState(false);
  const [installingBrew, setInstallingBrew] = useState(false);
  const [brewSetupLog, setBrewSetupLog] = useState<string[]>([]);
  const [brewCheckError, setBrewCheckError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [searchFilters, setSearchFilters] = useState<SearchFilters>(DEFAULT_SEARCH_FILTERS);
  const [trendingData, setTrendingData] = useState<TrendingPayload | null>(null);
  const [activeCollectionId, setActiveCollectionId] = useState<string | null>(null);
  const [selected, setSelected] = useState<BrewPackage | null>(null);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [busyKeys, setBusyKeys] = useState<Set<string>>(() => new Set());
  const [queuedKeys, setQueuedKeys] = useState<Set<string>>(() => new Set());
  const [updatingIds, setUpdatingIds] = useState<Set<string>>(() => new Set());
  const [dismissingIds, setDismissingIds] = useState<Set<string>>(() => new Set());
  const [updatingAll, setUpdatingAll] = useState(false);
  const [log, setLog] = useState<string[]>([]);
  const [brewVersion, setBrewVersion] = useState("Homebrew");
  const [appVersion, setAppVersion] = useState("1.3.4");
  const [pinnedIds, setPinnedIds] = useState<Set<string>>(() => new Set());
  const [counts, setCounts] = useState({ casks: 0, formulae: 0, total: 0 });
  const [diskUsage, setDiskUsage] = useState<Record<string, number>>({});
  const [appUpdate, setAppUpdate] = useState<AppUpdateInfo | null>(null);
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const [updateDismissed, setUpdateDismissed] = useState(false);
  const [applyingUpdate, setApplyingUpdate] = useState(false);
  const [freshness, setFreshness] = useState<BrewFreshness | null>(null);
  const [updatingBrew, setUpdatingBrew] = useState(false);
  const [activity, setActivity] = useState<ActivitySnapshot | null>(null);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const actionQueueRef = useRef<
    Array<{ action: PackageAction; pkg: BrewPackage }>
  >([]);
  const queueRunningRef = useRef(false);
  const api = typeof window !== "undefined" ? window.brewStore : undefined;

  const refreshStatus = useCallback(async () => {
    if (!api) return;
    const [inst, out, pinned] = await Promise.all([
      api.getInstalled(),
      api.getOutdated(),
      api.listPinned().catch(() => [] as string[]),
    ]);
    setInstalled(inst);
    setOutdated(out);
    setPinnedIds(new Set(pinned));
  }, [api]);

  const loadAll = useCallback(
    async (force = false) => {
      if (!force) setLoading(true);
      setError(null);
      setBrewCheckError(null);
      try {
        if (!api) {
          throw new Error("Open BrewStore from Applications (Electron required).");
        }

        const status = await api.getBrewStatus();
        if (!status.installed) {
          setBrewMissing({
            brewSite: status.brewSite || FALLBACK_BREW_MISSING.brewSite,
          });
          setPackages([]);
          setInstalled({});
          setOutdated({});
          return;
        }

        setBrewMissing(null);
        const [info, catalog] = await Promise.all([
          api.getBrewInfo(),
          api.loadCatalog({ force }),
        ]);
        setBrewVersion(info.version);
        setCounts(catalog.counts);
        if (api.getAppVersion) {
          void api.getAppVersion().then((v) => setAppVersion(v.version));
        }
        startTransition(() => {
          setPackages(withCategories(catalog.packages));
        });
        await refreshStatus();
        if (api.getFreshness) {
          void api.getFreshness().then(setFreshness).catch(() => {});
        }
        if (api.getActivity) {
          void api.getActivity().then(setActivity).catch(() => {});
        }
        void api
          .loadTrending({ force })
          .then((trending) => setTrendingData(trending))
          .catch(() => setTrendingData(null));
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        if (/homebrew is not installed|brew_not_found|homebrew not found/i.test(message)) {
          setBrewMissing(FALLBACK_BREW_MISSING);
          return;
        }
        setError(message);
      } finally {
        setLoading(false);
      }
    },
    [api, refreshStatus],
  );

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  useEffect(() => {
    if (!api) return;
    return api.onProgress((data) => {
      const text = data.text.trimEnd();
      if (!text && !data.text) return;
      if (data.action === "setup-homebrew") {
        setBrewSetupLog((prev) => [...prev.slice(-200), data.text]);
        return;
      }
      const line = data.text.trim();
      if (!line) return;
      if (data.action === "app-update") {
        setApplyingUpdate(true);
      }
      setLog((prev) => [...prev.slice(-100), line]);
    });
  }, [api]);

  useEffect(() => {
    if (!api?.onQueue) return;
    return api.onQueue((data) => setActivity(data));
  }, [api]);

  useEffect(() => {
    if (!api?.checkForUpdate || brewMissing) return;
    const timer = window.setTimeout(() => {
      void checkAppUpdate(false);
    }, 2500);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api, brewMissing]);

  useEffect(() => {
    if (!api?.getDiskUsage || nav !== "installed" || brewMissing) return;
    const packages = Object.values(installed).map((item) => ({
      id: item.id,
      type: item.type,
    }));
    if (packages.length === 0) {
      setDiskUsage({});
      return;
    }
    let cancelled = false;
    void api
      .getDiskUsage(packages)
      .then((map) => {
        if (cancelled) return;
        const next: Record<string, number> = {};
        for (const [key, info] of Object.entries(map)) {
          if (info?.bytes) next[key] = info.bytes;
        }
        setDiskUsage(next);
      })
      .catch(() => {
        if (!cancelled) setDiskUsage({});
      });
    return () => {
      cancelled = true;
    };
  }, [api, nav, installed, brewMissing]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing =
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable);

      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setPaletteOpen((open) => !open);
        return;
      }

      if (event.key === "/" && !typing && !paletteOpen && !brewMissing) {
        event.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
        return;
      }

      if (
        (event.metaKey || event.ctrlKey) &&
        event.key.toLowerCase() === "i" &&
        selected &&
        !selected.installed &&
        !typing
      ) {
        event.preventDefault();
        void runAction("install", selected);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paletteOpen, brewMissing, selected]);

  const handleInstallHomebrew = useCallback(async () => {
    if (!api) return;
    setInstallingBrew(true);
    setBrewCheckError(null);
    setBrewSetupLog([]);
    try {
      const status = await api.installHomebrew();
      if (!status.installed) {
        setBrewMissing({
          brewSite: status.brewSite || FALLBACK_BREW_MISSING.brewSite,
        });
        setBrewCheckError(
          "Homebrew setup didn’t complete. Try again, or visit brew.sh.",
        );
        return;
      }
      setBrewMissing(null);
      setCheckingBrew(true);
      await loadAll(true);
    } catch (err) {
      setBrewCheckError(err instanceof Error ? err.message : String(err));
    } finally {
      setInstallingBrew(false);
      setCheckingBrew(false);
    }
  }, [api, loadAll]);

  const enriched = useMemo(() => {
    return packages.map((pkg) => {
      const key = packageKey(pkg);
      return {
        ...pkg,
        installed: Boolean(installed[key]),
        outdated: Boolean(outdated[key]),
        version: installed[key]?.version || pkg.version,
      };
    });
  }, [packages, installed, outdated]);

  const catalogIndex = useMemo(() => buildCatalogIndex(enriched), [enriched]);

  const filtered = useMemo(() => {
    return searchPackages(enriched, query, searchFilters, catalogIndex);
  }, [enriched, query, searchFilters, catalogIndex]);

  const forYou = useMemo(() => recommendForYou(enriched, 8), [enriched]);

  const trendingPackages = useMemo(
    () => resolveTrending(enriched, trendingData, 16),
    [enriched, trendingData],
  );

  const collectionRows = useMemo(
    () =>
      COLLECTIONS.map((collection) => ({
        collection,
        packages: resolveCollection(collection, enriched),
      })).filter((row) => row.packages.length > 0),
    [enriched],
  );

  const similarForSelected = useMemo(() => {
    if (!selected) return [];
    const current =
      enriched.find((p) => p.id === selected.id && p.type === selected.type) ||
      selected;
    return findSimilarPackages(current, enriched, 6);
  }, [selected, enriched]);

  const installedPackages = useMemo(
    () => enriched.filter((pkg) => pkg.installed),
    [enriched],
  );

  const outdatedPackages = useMemo(() => {
    return enriched.filter((pkg) => {
      const key = packageKey(pkg);
      return pkg.outdated || updatingIds.has(key) || dismissingIds.has(key);
    });
  }, [enriched, updatingIds, dismissingIds]);

  const updateBadgeCount = useMemo(() => {
    return enriched.filter((pkg) => {
      const key = packageKey(pkg);
      return pkg.outdated && !dismissingIds.has(key);
    }).length;
  }, [enriched, dismissingIds]);

  const featured = useMemo(() => {
    const picks = [
      "visual-studio-code",
      "firefox",
      "google-chrome",
      "slack",
      "spotify",
      "iterm2",
      "rectangle",
      "obsidian",
    ];
    const byToken = new Map(
      enriched.filter((p) => p.type === "cask").map((p) => [p.token, p]),
    );
    return picks.map((t) => byToken.get(t)).filter(Boolean) as BrewPackage[];
  }, [enriched]);

  function dismissFromUpdates(pkg: BrewPackage) {
    const key = packageKey(pkg);
    setDismissingIds((prev) => new Set(prev).add(key));
    setUpdatingIds((prev) => {
      const next = new Set(prev);
      next.delete(key);
      return next;
    });
    setOutdated((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
    window.setTimeout(() => {
      setDismissingIds((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }, 420);
  }

  async function runAction(action: PackageAction, pkg: BrewPackage) {
    if (!api) return;
    const key = packageKey(pkg);
    const already =
      busyKeys.has(key) ||
      queuedKeys.has(key) ||
      actionQueueRef.current.some(
        (item) => packageKey(item.pkg) === key && item.action === action,
      );
    if (already) {
      setLog((prev) => [...prev.slice(-100), `… already queued: ${pkg.id}`]);
      return;
    }

    if (action === "install" && pkg.disabled) {
      setLog((prev) => [...prev.slice(-100), `✗ ${pkg.token} is disabled in Homebrew`]);
      return;
    }

    if (action === "install" && api.getInstallPlan) {
      try {
        const plan = await api.getInstallPlan(pkg);
        if (plan.missing.length > 0) {
          const ok = window.confirm(
            `Install ${pkg.name}?\n\nHomebrew will also install:\n${plan.missing.slice(0, 16).join(", ")}`,
          );
          if (!ok) return;
        }
      } catch {
        // Proceed without a plan if brew is busy or the lookup fails.
      }
    }

    if (action === "uninstall" && api.getUninstallPlan) {
      try {
        const plan = await api.getUninstallPlan(pkg);
        if (plan.dependents.length > 0) {
          const ok = window.confirm(
            `${plan.dependents.slice(0, 8).join(", ")}${
              plan.dependents.length > 8 ? "…" : ""
            } need this package.\n\nUninstall ${pkg.name} anyway?`,
          );
          if (!ok) return;
        }
      } catch {
        // Fall through to uninstall.
      }
    }

    actionQueueRef.current.push({ action, pkg });
    setQueuedKeys((prev) => new Set(prev).add(key));
    setLog((prev) => [
      ...prev.slice(-100),
      `＋ queued ${action} ${pkg.id} (${actionQueueRef.current.length} in queue)`,
    ]);
    void processActionQueue();
  }

  async function processActionQueue() {
    if (!api || queueRunningRef.current) return;
    queueRunningRef.current = true;

    while (actionQueueRef.current.length > 0) {
      const item = actionQueueRef.current.shift();
      if (!item) break;
      const { action, pkg } = item;
      const key = packageKey(pkg);

      setQueuedKeys((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
      setBusyId(pkg.id);
      setBusyKeys((prev) => new Set(prev).add(key));
      if (action === "upgrade") {
        setUpdatingIds((prev) => new Set(prev).add(key));
      }
      setLog((prev) => [...prev.slice(-100), `→ brew ${action} ${pkg.id}`]);

      try {
        if (action === "install") await api.install(pkg);
        if (action === "uninstall") await api.uninstall(pkg);
        if (action === "upgrade") await api.upgrade(pkg);
        if (action === "reinstall") await api.reinstall(pkg);
        if (action === "zap") await api.zap(pkg);
        setLog((prev) => [...prev.slice(-100), `✓ ${action} finished: ${pkg.id}`]);
        if (action === "upgrade") dismissFromUpdates(pkg);
        await refreshStatus();
      } catch (err) {
        setUpdatingIds((prev) => {
          const next = new Set(prev);
          next.delete(key);
          return next;
        });
        setLog((prev) => [
          ...prev.slice(-100),
          `✗ ${action} failed: ${err instanceof Error ? err.message : String(err)}`,
        ]);
      } finally {
        setBusyKeys((prev) => {
          const next = new Set(prev);
          next.delete(key);
          return next;
        });
        setBusyId(null);
      }
    }

    queueRunningRef.current = false;
  }

  async function checkAppUpdate(manual = false) {
    if (!api?.checkForUpdate) return;
    setCheckingUpdate(true);
    try {
      const info = await api.checkForUpdate();
      setAppUpdate(info);
      if (manual && !info.updateAvailable) {
        setLog((prev) => [
          ...prev.slice(-100),
          `✓ BrewStore is up to date (v${info.currentVersion})`,
        ]);
      } else if (info.updateAvailable) {
        setUpdateDismissed(false);
        setLog((prev) => [
          ...prev.slice(-100),
          `↑ BrewStore ${info.latestVersion} available`,
        ]);
      }
    } catch (err) {
      if (manual) {
        setLog((prev) => [
          ...prev.slice(-100),
          `✗ update check failed: ${err instanceof Error ? err.message : String(err)}`,
        ]);
      }
    } finally {
      setCheckingUpdate(false);
    }
  }

  async function applyAppUpdate(update: AppUpdateInfo) {
    if (!api) return;
    const url = update.zipUrl || update.downloadUrl || update.dmgUrl;
    if (!url) {
      void api.openExternal(update.releaseUrl);
      return;
    }
    if (!api.applyAppUpdate) {
      void api.openExternal(url);
      return;
    }
    const ok = window.confirm(
      `Install BrewStore ${update.latestVersion} and relaunch?\n\nBrewStore downloads the update, then quits to copy the new build into Applications.`,
    );
    if (!ok) return;
    setApplyingUpdate(true);
    setUpdateDismissed(false);
    setLog((prev) => [
      ...prev.slice(-100),
      `→ installing BrewStore ${update.latestVersion}`,
    ]);
    try {
      await api.applyAppUpdate(update);
      setLog((prev) => [...prev.slice(-100), "✓ update ready — quitting to install"]);
    } catch (err) {
      setApplyingUpdate(false);
      setLog((prev) => [
        ...prev.slice(-100),
        `✗ update failed: ${err instanceof Error ? err.message : String(err)}`,
      ]);
    }
  }

  async function runBrewUpdate() {
    if (!api?.brewUpdate) return;
    setUpdatingBrew(true);
    setLog((prev) => [...prev.slice(-100), "→ brew update"]);
    try {
      const next = await api.brewUpdate();
      setFreshness(next);
      setLog((prev) => [...prev.slice(-100), "✓ Homebrew formulae updated"]);
      setUpdatingBrew(false);
      void refreshStatus();
    } catch (err) {
      setLog((prev) => [
        ...prev.slice(-100),
        `✗ brew update failed: ${err instanceof Error ? err.message : String(err)}`,
      ]);
      setUpdatingBrew(false);
    }
  }

  async function retryActivity(id: string) {
    if (!api?.retryActivity) return;
    setLog((prev) => [...prev.slice(-100), "→ retry last failed job"]);
    try {
      await api.retryActivity(id);
      await refreshStatus();
    } catch (err) {
      setLog((prev) => [
        ...prev.slice(-100),
        `✗ retry failed: ${err instanceof Error ? err.message : String(err)}`,
      ]);
    }
  }

  async function openInstalledApp(pkg: BrewPackage) {
    if (!api?.openInstalledApp || pkg.type !== "cask") return;
    try {
      const result = await api.openInstalledApp(pkg);
      setLog((prev) => [
        ...prev.slice(-100),
        result.ok
          ? `✓ opened ${result.app || pkg.name}`
          : `✗ open failed: ${result.error || "unknown"}`,
      ]);
    } catch (err) {
      setLog((prev) => [
        ...prev.slice(-100),
        `✗ open failed: ${err instanceof Error ? err.message : String(err)}`,
      ]);
    }
  }

  async function copyInstallCommand(pkg: BrewPackage) {
    const cmd = brewInstallCommand(pkg);
    try {
      await api?.writeClipboardText(cmd);
      setLog((prev) => [...prev.slice(-100), `✓ copied: ${cmd}`]);
    } catch (err) {
      setLog((prev) => [
        ...prev.slice(-100),
        `✗ copy failed: ${err instanceof Error ? err.message : String(err)}`,
      ]);
    }
  }

  function handlePaletteAction(action: PaletteAction) {
    if (action.kind === "nav") {
      setNav(action.id as NavId);
      setActiveCategory(null);
      setActiveCollectionId(null);
      setSelected(null);
      return;
    }
    if (action.kind === "focus-search") {
      searchInputRef.current?.focus();
      searchInputRef.current?.select();
      return;
    }
    if (action.kind === "check-update") {
      void checkAppUpdate(true);
      setNav("credits");
      return;
    }
    if (action.kind === "donate") {
      void api?.openExternal(PAYPAL_SUPPORT_URL);
      return;
    }
    if (action.kind === "pkg") {
      if (action.action === "open") openPackage(action.pkg);
      if (action.action === "install") void runAction("install", action.pkg);
      if (action.action === "upgrade") void runAction("upgrade", action.pkg);
      if (action.action === "copy") void copyInstallCommand(action.pkg);
    }
  }

  async function upgradeAll() {
    if (!api) return;
    const targets = outdatedPackages.filter((pkg) => !dismissingIds.has(packageKey(pkg)));
    if (targets.length === 0) return;

    setBusyId("__all__");
    setUpdatingAll(true);
    setUpdatingIds(new Set(targets.map((pkg) => packageKey(pkg))));
    setLog((prev) => [...prev, "→ brew upgrade"]);

    try {
      await api.upgradeAll();
      setLog((prev) => [...prev, "✓ upgrade finished"]);
      for (const pkg of targets) dismissFromUpdates(pkg);
      await refreshStatus();
    } catch (err) {
      setLog((prev) => [
        ...prev,
        `✗ upgrade failed: ${err instanceof Error ? err.message : String(err)}`,
      ]);
      setUpdatingIds(new Set());
      await refreshStatus();
    } finally {
      setUpdatingAll(false);
      setBusyId(null);
    }
  }

  function openPackage(pkg: BrewPackage) {
    setSelected(pkg);
  }

  const loadInstallPlan = useCallback(
    (pkg: BrewPackage) => {
      if (!api) return Promise.reject(new Error("Electron required"));
      return api.getInstallPlan(pkg);
    },
    [api],
  );

  const loadPackageDeps = useCallback(
    (pkg: BrewPackage) => {
      if (!api) return Promise.resolve([] as string[]);
      return api.getDeps(pkg);
    },
    [api],
  );

  const loadPackageDependents = useCallback(
    (pkg: BrewPackage) => {
      if (!api) return Promise.resolve([] as string[]);
      return api.getDependents(pkg);
    },
    [api],
  );

  function renderMain() {
    if (loading) {
      return (
        <div className="state-panel glass-card">
          <div className="spinner" />
          <p>Loading BrewStore…</p>
        </div>
      );
    }

    if (brewMissing) {
      return (
        <BrewOnboarding
          installing={installingBrew}
          checking={checkingBrew}
          logLines={brewSetupLog}
          error={brewCheckError}
          onInstall={handleInstallHomebrew}
          onOpenSite={() => {
            void api?.openExternal(brewMissing.brewSite);
          }}
        />
      );
    }

    if (error) {
      return (
        <div className="state-panel glass-card">
          <h2>Couldn’t load BrewStore</h2>
          <p>{error}</p>
          <button type="button" className="btn primary" onClick={() => void loadAll(true)}>
            Retry
          </button>
        </div>
      );
    }

    if (activeCategory) {
      const category = getCategory(activeCategory);
      const items = filtered.filter((pkg) => pkg.category === activeCategory);
      return (
        <CategoryDetail
          category={category!}
          packages={items}
          onBack={() => setActiveCategory(null)}
          onOpen={openPackage}
          onAction={runAction}
          busyId={busyId}
          busyKeys={busyKeys}
          queuedKeys={queuedKeys}
        />
      );
    }

    if (nav === "discover") {
      return (
        <DiscoverView
          featured={featured}
          forYou={forYou.packages}
          forYouBlurb={forYou.blurb}
          trending={trendingPackages}
          collections={collectionRows}
          activeCollectionId={activeCollectionId}
          packages={filtered}
          query={query}
          filtering={Object.values(searchFilters).some(Boolean)}
          updateCount={updateBadgeCount}
          onOpen={openPackage}
          onAction={runAction}
          onOpenCollection={setActiveCollectionId}
          onOpenUpdates={() => {
            setNav("updates");
            setActiveCollectionId(null);
            setSelected(null);
          }}
          busyId={busyId}
          busyKeys={busyKeys}
          queuedKeys={queuedKeys}
        />
      );
    }

    if (nav === "categories") {
      return (
        <CategoriesView
          categories={CATEGORIES}
          packages={enriched}
          onOpenCategory={setActiveCategory}
        />
      );
    }

    if (nav === "installed") {
      return (
        <section className="page">
          <header className="page-header">
            <h1>Installed</h1>
            <p>{installedPackages.length} packages on this Mac</p>
          </header>
          <PackageGrid
            packages={installedPackages}
            onOpen={openPackage}
            onAction={runAction}
            busyId={busyId}
            busyKeys={busyKeys}
            queuedKeys={queuedKeys}
            pinnedIds={pinnedIds}
            diskUsage={diskUsage}
            onOpenApp={(pkg) => void openInstalledApp(pkg)}
            onCopyInstall={(pkg) => void copyInstallCommand(pkg)}
          />
        </section>
      );
    }

    if (nav === "updates") {
      return (
        <UpdatesView
          packages={outdatedPackages}
          busyId={busyId}
          updatingIds={updatingIds}
          dismissingIds={dismissingIds}
          updatingAll={updatingAll}
          freshness={freshness}
          updatingBrew={updatingBrew}
          brewUpdateQueued={
            updatingBrew && activity?.current?.action !== "brew-update"
          }
          appVersion={appVersion}
          appUpdate={appUpdate}
          checkingAppUpdate={checkingUpdate}
          applyingAppUpdate={applyingUpdate}
          onOpen={openPackage}
          onUpdate={(pkg) => void runAction("upgrade", pkg)}
          onUpdateAll={() => void upgradeAll()}
          onBrewUpdate={() => void runBrewUpdate()}
          onApplyAppUpdate={(update) => void applyAppUpdate(update)}
        />
      );
    }

    if (nav === "maintain") {
      if (!api) {
        return (
          <div className="state-panel glass-card">
            <p>Open BrewStore from Applications (Electron required).</p>
          </div>
        );
      }
      return (
        <MaintainView
          api={api}
          onLog={(line) => setLog((prev) => [...prev.slice(-100), line])}
          onRefreshInstalled={refreshStatus}
        />
      );
    }

    return (
      <CreditsView
        appVersion={appVersion}
        brewVersion={brewVersion}
        counts={counts}
        appUpdate={updateDismissed ? null : appUpdate}
        checkingUpdate={checkingUpdate}
        applyingUpdate={applyingUpdate}
        onCheckUpdate={() => void checkAppUpdate(true)}
        onDownloadUpdate={(update) => void applyAppUpdate(update)}
        onDismissUpdate={() => setUpdateDismissed(true)}
        onOpenExternal={(url) => void api?.openExternal(url)}
      />
    );
  }

  return (
    <div className="app-shell">
      <div className="ambient" aria-hidden>
        <span className="blob b1" />
        <span className="blob b2" />
        <span className="blob b3" />
      </div>

      <aside className="sidebar glass-sidebar">
        <div className="brand">
          <div className="brand-mark" aria-hidden>
            <img src="./icon.png" alt="" width={42} height={42} />
          </div>
          <div>
            <div className="brand-name">BrewStore</div>
            <div className="brand-by">by Manish Vagh</div>
            <div className="brand-version">v{appVersion}</div>
          </div>
        </div>

        <nav className="nav">
          {NAV.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              className={`nav-item ${nav === id && !activeCategory ? "active" : ""}`}
              disabled={Boolean(brewMissing)}
              onClick={() => {
                setNav(id);
                setActiveCategory(null);
                setActiveCollectionId(null);
                setSelected(null);
              }}
            >
              <Icon size={18} />
              <span>{label}</span>
              {id === "updates" && updateBadgeCount > 0 && (
                <span className="badge">{updateBadgeCount}</span>
              )}
            </button>
          ))}
        </nav>

        <div className="sidebar-foot">
          {!brewMissing && !updateDismissed && appUpdate?.updateAvailable && (
            <UpdateBanner
              update={appUpdate}
              checking={checkingUpdate}
              applying={applyingUpdate}
              onCheck={() => void checkAppUpdate(true)}
              onDownload={(update) => void applyAppUpdate(update)}
              onDismiss={() => setUpdateDismissed(true)}
            />
          )}

          <ThemeToggle value={themePreference} onChange={setThemePreference} />

          <button
            type="button"
            className="ghost-btn"
            disabled={Boolean(brewMissing) || loading}
            onClick={() => void loadAll(true)}
            title="Refresh catalog"
          >
            <RefreshCw size={16} />
            Refresh catalog
          </button>

          <button
            type="button"
            className="ghost-btn"
            disabled={Boolean(brewMissing)}
            onClick={() => setPaletteOpen(true)}
            title="Command palette (⌘K)"
          >
            <Search size={16} />
            Commands ⌘K
          </button>

          {freshness && (
            <p className={`queue-status ${freshness.stale ? "stale" : ""}`}>
              Homebrew {freshness.stale ? "stale" : "fresh"} · {formatAge(freshness.ageMs)}
            </p>
          )}

          {(queuedKeys.size > 0 || activity?.current) && (
            <p className="queue-status">
              {activity?.current
                ? `Engine: ${activity.current.action}${
                    activity.current.pkgId ? ` ${activity.current.pkgId}` : ""
                  }`
                : `Queue: ${queuedKeys.size + busyKeys.size} package${
                    queuedKeys.size + busyKeys.size === 1 ? "" : "s"
                  }`}
            </p>
          )}

          <ActionLog
            lines={log}
            snapshot={activity}
            onClear={() => setLog([])}
            onRetry={(id) => void retryActivity(id)}
          />
        </div>
      </aside>

      <main className="main">
        {!brewMissing && (
          <div className="topbar">
            <div className="search glass-pill">
              <Search size={16} />
              <input
                ref={searchInputRef}
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setActiveCollectionId(null);
                }}
                placeholder="Search apps & formulae  (/)"
                aria-label="Search"
              />
            </div>
            {(query.trim() || Object.values(searchFilters).some(Boolean)) && (
              <div className="search-filters" role="group" aria-label="Search filters">
                {SEARCH_FILTER_OPTIONS.map(({ id, label }) => (
                  <button
                    key={id}
                    type="button"
                    className={`filter-chip ${searchFilters[id] ? "active" : ""}`}
                    aria-pressed={searchFilters[id]}
                    onClick={() =>
                      setSearchFilters((prev) => ({
                        ...prev,
                        [id]: !prev[id],
                      }))
                    }
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        <div className={`content ${brewMissing ? "content-onboarding" : ""}`}>
          {renderMain()}
        </div>
      </main>

      {selected && (
        <PackageDetail
          pkg={
            enriched.find((p) => p.id === selected.id && p.type === selected.type) ||
            selected
          }
          similar={similarForSelected}
          pinned={pinnedIds.has(selected.id)}
          busy={
            busyId === selected.id ||
            busyKeys.has(packageKey(selected)) ||
            updatingIds.has(packageKey(selected))
          }
          diskBytes={diskUsage[packageKey(selected)]}
          onClose={() => setSelected(null)}
          onAction={runAction}
          onOpenExternal={(url) => void api?.openExternal(url)}
          onOpenPackage={(pkg) => setSelected(pkg)}
          onOpenApp={(pkg) => void openInstalledApp(pkg)}
          onCopyInstall={(pkg) => void copyInstallCommand(pkg)}
          loadInstallPlan={api ? loadInstallPlan : undefined}
          zapDryRun={
            api
              ? async (pkg) => {
                  const result = await api.zapDryRun(pkg);
                  return { items: result.items || [], raw: result.raw || "" };
                }
              : undefined
          }
          onTogglePin={
            api
              ? async (pkg, pin) => {
                  const result = pin ? await api.pin(pkg) : await api.unpin(pkg);
                  setPinnedIds(new Set(result.pinned));
                  setLog((prev) => [
                    ...prev.slice(-100),
                    `✓ ${pin ? "pinned" : "unpinned"} ${pkg.id}`,
                  ]);
                }
              : undefined
          }
          loadDeps={api ? loadPackageDeps : undefined}
          loadDependents={api ? loadPackageDependents : undefined}
        />
      )}

      <CommandPalette
        open={paletteOpen}
        packages={enriched}
        onClose={() => setPaletteOpen(false)}
        onRun={handlePaletteAction}
      />
    </div>
  );
}

export default App;
