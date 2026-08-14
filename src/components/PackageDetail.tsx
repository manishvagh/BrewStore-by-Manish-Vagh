import { useEffect, useRef, useState } from "react";
import { ExternalLink, X } from "lucide-react";
import type { BrewPackage, InstallPlan, PackageAction } from "../types";
import { getCategory } from "../categories";
import { PackageIcon } from "./PackageIcon";
import { VerifiedName } from "./VerifiedName";
import { brewInstallCommand, formatBytes } from "../lib/format";
import { isOfficialCurrent, tokenChannel } from "../lib/trust";
import { BeerMeter } from "./BeerMeter";
import { BeerScroll } from "./BeerScroll";

interface Props {
  pkg: BrewPackage;
  similar: BrewPackage[];
  pinned: boolean;
  busy: boolean;
  progress?: number;
  diskBytes?: number | null;
  onClose: () => void;
  onAction: (action: PackageAction, pkg: BrewPackage) => void;
  onOpenExternal: (url: string) => void;
  onOpenPackage: (pkg: BrewPackage) => void;
  onTogglePin?: (pkg: BrewPackage, pin: boolean) => Promise<void>;
  onOpenApp?: (pkg: BrewPackage) => void;
  onCopyInstall?: (pkg: BrewPackage) => void;
  loadDeps?: (pkg: BrewPackage) => Promise<string[]>;
  loadDependents?: (pkg: BrewPackage) => Promise<string[]>;
  loadInstallPlan?: (pkg: BrewPackage) => Promise<InstallPlan>;
  zapDryRun?: (pkg: BrewPackage) => Promise<{ items: string[]; raw: string }>;
}

export function PackageDetail({
  pkg,
  similar,
  pinned,
  busy,
  progress,
  diskBytes,
  onClose,
  onAction,
  onOpenExternal,
  onOpenPackage,
  onTogglePin,
  onOpenApp,
  onCopyInstall,
  loadDeps,
  loadDependents,
  loadInstallPlan,
  zapDryRun,
}: Props) {
  const category = pkg.category ? getCategory(pkg.category) : undefined;
  const sourceUrl = pkg.urls.head || pkg.urls.stable || pkg.homepage;
  const channel = tokenChannel(pkg.token);
  const official = isOfficialCurrent(pkg);
  const [deps, setDeps] = useState<string[]>([]);
  const [dependents, setDependents] = useState<string[]>([]);
  const [installPlan, setInstallPlan] = useState<InstallPlan | null>(null);
  const [relLoading, setRelLoading] = useState(false);
  const [pinBusy, setPinBusy] = useState(false);
  const [zapBusy, setZapBusy] = useState(false);
  const drawerScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  useEffect(() => {
    let cancelled = false;
    setInstallPlan(null);
    if (pkg.installed) {
      if (!loadDeps && !loadDependents) {
        setDeps([]);
        setDependents([]);
        return;
      }
      setRelLoading(true);
      void (async () => {
        try {
          const [nextDeps, nextDependents] = await Promise.all([
            loadDeps ? loadDeps(pkg) : Promise.resolve([]),
            loadDependents ? loadDependents(pkg) : Promise.resolve([]),
          ]);
          if (!cancelled) {
            setDeps(nextDeps);
            setDependents(nextDependents);
          }
        } catch {
          if (!cancelled) {
            setDeps([]);
            setDependents([]);
          }
        } finally {
          if (!cancelled) setRelLoading(false);
        }
      })();
    } else if (loadInstallPlan) {
      setRelLoading(true);
      void loadInstallPlan(pkg)
        .then((plan) => {
          if (!cancelled) setInstallPlan(plan);
        })
        .catch(() => {
          if (!cancelled) setInstallPlan(null);
        })
        .finally(() => {
          if (!cancelled) setRelLoading(false);
        });
    } else {
      setDeps([]);
      setDependents([]);
    }
    return () => {
      cancelled = true;
    };
  }, [pkg.id, pkg.type, pkg.installed, loadDeps, loadDependents, loadInstallPlan]);

  async function handleZap() {
    if (!zapDryRun) {
      if (!window.confirm(`Zap ${pkg.name}? This also deletes leftover app files.`)) return;
      onAction("zap", pkg);
      return;
    }
    setZapBusy(true);
    try {
      const preview = await zapDryRun(pkg);
      const sample = (preview.items.length ? preview.items : preview.raw.split("\n"))
        .filter(Boolean)
        .slice(0, 12)
        .join("\n");
      const ok = window.confirm(
        `Zap ${pkg.name}? This uninstalls the cask and leftover files.\n\n${sample || "Homebrew will remove associated files."}`,
      );
      if (ok) onAction("zap", pkg);
    } catch (err) {
      window.alert(err instanceof Error ? err.message : String(err));
    } finally {
      setZapBusy(false);
    }
  }

  return (
    <div
      className="drawer-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <aside
        className="drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="package-detail-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="drawer-scroll" ref={drawerScrollRef}>
        <div className="drawer-toolbar">
          <button
            type="button"
            className="drawer-close"
            aria-label="Close"
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              onClose();
            }}
          >
            <X size={18} />
          </button>
        </div>

        <div className="drawer-hero">
          <PackageIcon pkg={pkg} size="lg" />
          <div>
            <VerifiedName
              name={pkg.name}
              official={official}
              as="h2"
              id="package-detail-title"
            />
            <p className="pkg-token">{pkg.token}</p>
            <p className="drawer-desc">{pkg.desc || "No description available."}</p>
            <div className="pkg-tags">
              <span className="tag">{pkg.type}</span>
              {official && <span className="tag official">Official</span>}
              {channel && <span className="tag soft">@{channel}</span>}
              {pkg.deprecated && <span className="tag warn">Deprecated</span>}
              {pkg.disabled && <span className="tag warn">Disabled</span>}
            </div>
          </div>
        </div>

        <div className="drawer-actions">
          {busy ? (
            <BeerMeter
              size="md"
              label={
                pkg.outdated ? "Updating" : pkg.installed ? "Working" : "Installing"
              }
              value={progress}
            />
          ) : (
            <>
              {pkg.installed && pkg.type === "cask" && onOpenApp && (
                <button
                  type="button"
                  className="btn primary"
                  disabled={busy}
                  onClick={() => onOpenApp(pkg)}
                >
                  Open app
                </button>
              )}
              {onCopyInstall && (
                <button
                  type="button"
                  className="btn soft"
                  onClick={() => onCopyInstall(pkg)}
                  title={brewInstallCommand(pkg)}
                >
                  Copy install
                </button>
              )}
              {!pkg.installed && (
                <button
                  type="button"
                  className="btn primary"
                  disabled={Boolean(pkg.disabled)}
                  title={pkg.disabled ? "Homebrew has disabled this package" : undefined}
                  onClick={() => void onAction("install", pkg)}
                >
                  Install
                </button>
              )}
              {pkg.outdated && (
                <button
                  type="button"
                  className="btn primary"
                  onClick={() => void onAction("upgrade", pkg)}
                >
                  Update
                </button>
              )}
              {pkg.installed && (
                <button
                  type="button"
                  className="btn soft"
                  onClick={() => void onAction("reinstall", pkg)}
                >
                  Reinstall
                </button>
              )}
              {pkg.installed && pkg.type === "formula" && onTogglePin && (
                <button
                  type="button"
                  className="btn soft"
                  disabled={pinBusy}
                  onClick={() => {
                    void (async () => {
                      setPinBusy(true);
                      try {
                        await onTogglePin(pkg, !pinned);
                      } finally {
                        setPinBusy(false);
                      }
                    })();
                  }}
                >
                  {pinned ? "Unpin" : "Pin version"}
                </button>
              )}
              {pkg.installed && (
                <button
                  type="button"
                  className="btn danger"
                  onClick={() => void onAction("uninstall", pkg)}
                >
                  Uninstall
                </button>
              )}
              {pkg.installed && pkg.type === "cask" && (
                <button
                  type="button"
                  className="btn danger"
                  disabled={zapBusy}
                  onClick={() => void handleZap()}
                >
                  {zapBusy ? "Checking…" : "Zap"}
                </button>
              )}
            </>
          )}
        </div>

        <dl className="meta-list">
          <div>
            <dt>Version</dt>
            <dd>{pkg.version || "—"}</dd>
          </div>
          <div>
            <dt>Type</dt>
            <dd>{pkg.type}</dd>
          </div>
          <div>
            <dt>Token</dt>
            <dd>
              <code>{pkg.token}</code>
              {official ? " · current Homebrew package" : ""}
              {channel ? ` · @${channel}` : ""}
            </dd>
          </div>
          {(pkg.deprecated || pkg.disabled) && (
            <div>
              <dt>Status</dt>
              <dd>{pkg.disabled ? "Disabled by Homebrew" : "Deprecated"}</dd>
            </div>
          )}
          <div>
            <dt>Category</dt>
            <dd>{category?.name || "Utilities"}</dd>
          </div>
          <div>
            <dt>Tap</dt>
            <dd>{pkg.tap}</dd>
          </div>
          {pkg.installed && typeof diskBytes === "number" && diskBytes > 0 && (
            <div>
              <dt>Disk</dt>
              <dd>{formatBytes(diskBytes)}</dd>
            </div>
          )}
          {pkg.installed && pkg.type === "formula" && (
            <div>
              <dt>Pinned</dt>
              <dd>{pinned ? "Yes — upgrades skipped" : "No"}</dd>
            </div>
          )}
          {pkg.license && (
            <div>
              <dt>License</dt>
              <dd>{pkg.license}</dd>
            </div>
          )}
        </dl>

        {!pkg.installed && (
          <div className="deps-block">
            <h3>Install plan</h3>
            {relLoading ? (
              <BeerMeter size="sm" label="Checking dependencies" />
            ) : installPlan ? (
              <>
                <p className="deps-label">Will install</p>
                <p className="deps-values">
                  {installPlan.missing.length
                    ? installPlan.missing.join(", ")
                    : "No extra formulae — already satisfied"}
                </p>
                {installPlan.already.length > 0 && (
                  <>
                    <p className="deps-label">Already present</p>
                    <p className="deps-values">{installPlan.already.join(", ")}</p>
                  </>
                )}
              </>
            ) : (
              <p className="muted">Open this package to preview what Homebrew will install.</p>
            )}
          </div>
        )}

        {pkg.installed && (
          <div className="deps-block">
            <h3>Dependencies</h3>
            {relLoading ? (
              <BeerMeter size="sm" label="Loading" />
            ) : (
              <>
                <p className="deps-label">Depends on</p>
                <p className="deps-values">
                  {deps.length ? deps.join(", ") : "None listed"}
                </p>
                <p className="deps-label">Required by (installed)</p>
                <p className="deps-values">
                  {dependents.length ? dependents.join(", ") : "Nothing else needs this"}
                </p>
              </>
            )}
          </div>
        )}

        <div className="credit-box">
          <h3>Attribution</h3>
          <p>
            This software is owned by its respective authors and maintainers.
            BrewStore only installs packages through Homebrew and does not claim
            ownership of public or private repositories linked below.
          </p>
          <div className="link-row">
            {pkg.homepage && (
              <button type="button" className="link-btn" onClick={() => onOpenExternal(pkg.homepage)}>
                Homepage <ExternalLink size={14} />
              </button>
            )}
            {sourceUrl && sourceUrl !== pkg.homepage && (
              <button type="button" className="link-btn" onClick={() => onOpenExternal(sourceUrl)}>
                Source / download <ExternalLink size={14} />
              </button>
            )}
            <button
              type="button"
              className="link-btn"
              onClick={() =>
                onOpenExternal(
                  `https://github.com/Homebrew/${pkg.type === "cask" ? "homebrew-cask" : "homebrew-core"}/blob/master/${pkg.type === "cask" ? "Casks" : "Formula"}/${pkg.token}.rb`,
                )
              }
            >
              Homebrew formula <ExternalLink size={14} />
            </button>
          </div>
        </div>

        {similar.length > 0 && (
          <div className="similar-block">
            <h3>Similar packages</h3>
            <div className="similar-list">
              {similar.map((item) => (
                <button
                  key={`${item.type}:${item.id}`}
                  type="button"
                  className="similar-item"
                  onClick={() => onOpenPackage(item)}
                >
                  <PackageIcon pkg={item} size="sm" />
                  <span>
                    <strong>{item.name}</strong>
                    <small>{item.type}</small>
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
        </div>
        <BeerScroll scrollerRef={drawerScrollRef} />
      </aside>
    </div>
  );
}
