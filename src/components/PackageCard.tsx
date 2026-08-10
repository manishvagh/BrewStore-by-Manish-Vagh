import type { BrewPackage } from "../types";
import { PackageIcon } from "./PackageIcon";
import { formatBytes } from "../lib/format";

interface Props {
  pkg: BrewPackage;
  featured?: boolean;
  pinned?: boolean;
  busy: boolean;
  queued?: boolean;
  diskBytes?: number | null;
  progressLabel?: string;
  onOpen: (pkg: BrewPackage) => void;
  onAction: (action: "install" | "uninstall" | "upgrade", pkg: BrewPackage) => void;
  onOpenApp?: (pkg: BrewPackage) => void;
  onCopyInstall?: (pkg: BrewPackage) => void;
}

export function PackageCard({
  pkg,
  featured,
  pinned,
  busy,
  queued,
  diskBytes,
  progressLabel,
  onOpen,
  onAction,
  onOpenApp,
  onCopyInstall,
}: Props) {
  let actionLabel = "Get";
  let action: "install" | "uninstall" | "upgrade" = "install";
  if (pkg.outdated) {
    actionLabel = "Update";
    action = "upgrade";
  } else if (pkg.installed) {
    actionLabel = "Open";
  }

  return (
    <article
      className={`package-card glass-card ${featured ? "featured" : ""} ${busy ? "busy" : ""} ${queued ? "queued" : ""}`}
      onClick={() => onOpen(pkg)}
      onKeyDown={(e) => {
        if (e.key === "Enter") onOpen(pkg);
      }}
      role="button"
      tabIndex={0}
    >
      <PackageIcon pkg={pkg} />
      <div className="pkg-meta">
        <h3>{pkg.name}</h3>
        <p>{pkg.desc || "No description"}</p>
        <div className="pkg-tags">
          <span className="tag">{pkg.type}</span>
          {pkg.installed && !pkg.outdated && <span className="tag ok">Installed</span>}
          {pkg.outdated && <span className="tag soft">Update</span>}
          {pinned && <span className="tag soft">Pinned</span>}
          {queued && <span className="tag soft">Queued</span>}
          {typeof diskBytes === "number" && diskBytes > 0 && (
            <span className="tag">{formatBytes(diskBytes)}</span>
          )}
        </div>
      </div>
      <div className="pkg-actions" onClick={(e) => e.stopPropagation()}>
        {busy ? (
          <div className="update-progress compact">
            <span className="progress-ring" />
            <span>{progressLabel || "Working"}</span>
          </div>
        ) : queued ? (
          <button type="button" className="btn soft" disabled>
            Queued
          </button>
        ) : pkg.installed && !pkg.outdated ? (
          <div className="pkg-action-row">
            {pkg.type === "cask" && onOpenApp ? (
              <button
                type="button"
                className="btn primary"
                onClick={() => onOpenApp(pkg)}
              >
                Open
              </button>
            ) : null}
            {onCopyInstall ? (
              <button
                type="button"
                className="btn soft"
                title="Copy brew install command"
                onClick={() => onCopyInstall(pkg)}
              >
                Copy
              </button>
            ) : (
              <button type="button" className="btn soft" onClick={() => onOpen(pkg)}>
                Details
              </button>
            )}
          </div>
        ) : (
          <button
            type="button"
            className="btn primary"
            onClick={() => void onAction(action, pkg)}
          >
            {actionLabel}
          </button>
        )}
      </div>
    </article>
  );
}
