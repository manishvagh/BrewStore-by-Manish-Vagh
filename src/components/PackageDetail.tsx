import { useEffect } from "react";
import { ExternalLink, X } from "lucide-react";
import type { BrewPackage } from "../types";
import { getCategory } from "../categories";
import { PackageIcon } from "./PackageIcon";

interface Props {
  pkg: BrewPackage;
  similar: BrewPackage[];
  busy: boolean;
  onClose: () => void;
  onAction: (action: "install" | "uninstall" | "upgrade", pkg: BrewPackage) => void;
  onOpenExternal: (url: string) => void;
  onOpenPackage: (pkg: BrewPackage) => void;
}

export function PackageDetail({
  pkg,
  similar,
  busy,
  onClose,
  onAction,
  onOpenExternal,
  onOpenPackage,
}: Props) {
  const category = pkg.category ? getCategory(pkg.category) : undefined;
  const sourceUrl = pkg.urls.head || pkg.urls.stable || pkg.homepage;

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

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
            <h2 id="package-detail-title">{pkg.name}</h2>
            <p className="drawer-desc">{pkg.desc || "No description available."}</p>
          </div>
        </div>

        <div className="drawer-actions">
          {busy ? (
            <div className="update-progress">
              <span className="progress-ring" />
              <span>
                {pkg.outdated ? "Updating…" : pkg.installed ? "Working…" : "Installing…"}
              </span>
            </div>
          ) : (
            <>
              {!pkg.installed && (
                <button
                  type="button"
                  className="btn primary"
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
                  className="btn danger"
                  onClick={() => void onAction("uninstall", pkg)}
                >
                  Uninstall
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
            <dt>Category</dt>
            <dd>{category?.name || "Utilities"}</dd>
          </div>
          <div>
            <dt>Tap</dt>
            <dd>{pkg.tap}</dd>
          </div>
          {pkg.license && (
            <div>
              <dt>License</dt>
              <dd>{pkg.license}</dd>
            </div>
          )}
        </dl>

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
      </aside>
    </div>
  );
}
