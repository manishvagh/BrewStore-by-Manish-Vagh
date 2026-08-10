import { useCallback, useEffect, useMemo, useState, startTransition } from "react";
import {
  Compass,
  Grid2x2,
  Download,
  ArrowUpCircle,
  Info,
  Search,
  RefreshCw,
} from "lucide-react";
import { CATEGORIES, getCategory, packageKey, withCategories } from "./categories";
import type { BrewPackage, InstalledMap, OutdatedMap } from "./types";
import { DiscoverView } from "./components/DiscoverView";
import { CategoriesView } from "./components/CategoriesView";
import { CategoryDetail } from "./components/CategoryDetail";
import { PackageGrid } from "./components/PackageGrid";
import { PackageDetail } from "./components/PackageDetail";
import { CreditsView } from "./components/CreditsView";
import { UpdatesView } from "./components/UpdatesView";
import { ActionLog } from "./components/ActionLog";
import { ThemeToggle } from "./components/ThemeToggle";
import { useTheme } from "./hooks/useTheme";
import "./App.css";

type NavId = "discover" | "categories" | "installed" | "updates" | "credits";

const NAV: { id: NavId; label: string; icon: typeof Compass }[] = [
  { id: "discover", label: "Discover", icon: Compass },
  { id: "categories", label: "Categories", icon: Grid2x2 },
  { id: "installed", label: "Installed", icon: Download },
  { id: "updates", label: "Updates", icon: ArrowUpCircle },
  { id: "credits", label: "Credits", icon: Info },
];

function App() {
  const { preference: themePreference, setPreference: setThemePreference } = useTheme();
  const [nav, setNav] = useState<NavId>("discover");
  const [packages, setPackages] = useState<BrewPackage[]>([]);
  const [installed, setInstalled] = useState<InstalledMap>({});
  const [outdated, setOutdated] = useState<OutdatedMap>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<BrewPackage | null>(null);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [updatingIds, setUpdatingIds] = useState<Set<string>>(() => new Set());
  const [dismissingIds, setDismissingIds] = useState<Set<string>>(() => new Set());
  const [updatingAll, setUpdatingAll] = useState(false);
  const [log, setLog] = useState<string[]>([]);
  const [brewVersion, setBrewVersion] = useState("Homebrew");
  const [counts, setCounts] = useState({ casks: 0, formulae: 0, total: 0 });
  const api = typeof window !== "undefined" ? window.brewStore : undefined;

  const refreshStatus = useCallback(async () => {
    if (!api) return;
    const [inst, out] = await Promise.all([api.getInstalled(), api.getOutdated()]);
    setInstalled(inst);
    setOutdated(out);
  }, [api]);

  const loadAll = useCallback(
    async (force = false) => {
      setLoading(true);
      setError(null);
      try {
        if (!api) {
          throw new Error("Open BrewStore from Applications (Electron required).");
        }
        const [info, catalog] = await Promise.all([
          api.getBrewInfo(),
          api.loadCatalog({ force }),
        ]);
        setBrewVersion(info.version);
        setCounts(catalog.counts);
        startTransition(() => {
          setPackages(withCategories(catalog.packages));
        });
        await refreshStatus();
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
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
      const text = data.text.trim();
      if (!text) return;
      setLog((prev) => [...prev.slice(-100), text]);
    });
  }, [api]);

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

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return enriched;
    return enriched.filter(
      (pkg) =>
        pkg.name.toLowerCase().includes(q) ||
        pkg.token.toLowerCase().includes(q) ||
        pkg.desc.toLowerCase().includes(q),
    );
  }, [enriched, query]);

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

  async function runAction(
    action: "install" | "uninstall" | "upgrade",
    pkg: BrewPackage,
  ) {
    if (!api) return;
    const key = packageKey(pkg);
    setBusyId(pkg.id);
    if (action === "upgrade") {
      setUpdatingIds((prev) => new Set(prev).add(key));
    }
    setLog((prev) => [...prev, `→ brew ${action} ${pkg.id}`]);
    try {
      if (action === "install") await api.install(pkg);
      if (action === "uninstall") await api.uninstall(pkg);
      if (action === "upgrade") await api.upgrade(pkg);
      setLog((prev) => [...prev, `✓ ${action} finished: ${pkg.id}`]);
      if (action === "upgrade") {
        dismissFromUpdates(pkg);
      }
      await refreshStatus();
    } catch (err) {
      setUpdatingIds((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
      setLog((prev) => [
        ...prev,
        `✗ ${action} failed: ${err instanceof Error ? err.message : String(err)}`,
      ]);
    } finally {
      setBusyId(null);
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

  function renderMain() {
    if (loading) {
      return (
        <div className="state-panel glass-card">
          <div className="spinner" />
          <p>Loading Homebrew catalog…</p>
        </div>
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
        />
      );
    }

    if (nav === "discover") {
      return (
        <DiscoverView
          featured={featured}
          packages={filtered}
          query={query}
          onOpen={openPackage}
          onAction={runAction}
          onOpenCategory={(id) => {
            setNav("categories");
            setActiveCategory(id);
          }}
          busyId={busyId}
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
          onOpen={openPackage}
          onUpdate={(pkg) => void runAction("upgrade", pkg)}
          onUpdateAll={() => void upgradeAll()}
        />
      );
    }

    return (
      <CreditsView
        brewVersion={brewVersion}
        counts={counts}
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
          </div>
        </div>

        <nav className="nav">
          {NAV.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              className={`nav-item ${nav === id && !activeCategory ? "active" : ""}`}
              onClick={() => {
                setNav(id);
                setActiveCategory(null);
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
          <ThemeToggle value={themePreference} onChange={setThemePreference} />

          <button
            type="button"
            className="ghost-btn"
            onClick={() => void loadAll(true)}
            title="Refresh catalog"
          >
            <RefreshCw size={16} />
            Refresh catalog
          </button>

          <ActionLog lines={log} onClear={() => setLog([])} />
        </div>
      </aside>

      <main className="main">
        <div className="topbar">
          <div className="search glass-pill">
            <Search size={16} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search apps & formulae"
              aria-label="Search"
            />
          </div>
        </div>

        <div className="content">{renderMain()}</div>
      </main>

      {selected && (
        <PackageDetail
          pkg={
            enriched.find((p) => p.id === selected.id && p.type === selected.type) ||
            selected
          }
          busy={busyId === selected.id || updatingIds.has(packageKey(selected))}
          onClose={() => setSelected(null)}
          onAction={runAction}
          onOpenExternal={(url) => void api?.openExternal(url)}
        />
      )}
    </div>
  );
}

export default App;
