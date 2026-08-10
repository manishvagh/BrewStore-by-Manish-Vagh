import type { BrewPackage } from "../types";
import { PackageIcon } from "./PackageIcon";

interface Props {
  pkg: BrewPackage;
  featured?: boolean;
  busy: boolean;
  progressLabel?: string;
  onOpen: (pkg: BrewPackage) => void;
  onAction: (action: "install" | "uninstall" | "upgrade", pkg: BrewPackage) => void;
}

export function PackageCard({
  pkg,
  featured,
  busy,
  progressLabel,
  onOpen,
  onAction,
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
      className={`package-card glass-card ${featured ? "featured" : ""} ${busy ? "busy" : ""}`}
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
        </div>
      </div>
      <div className="pkg-actions" onClick={(e) => e.stopPropagation()}>
        {busy ? (
          <div className="update-progress compact">
            <span className="progress-ring" />
            <span>{progressLabel || "Working"}</span>
          </div>
        ) : pkg.installed && !pkg.outdated ? (
          <button type="button" className="btn soft" onClick={() => onOpen(pkg)}>
            Details
          </button>
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
