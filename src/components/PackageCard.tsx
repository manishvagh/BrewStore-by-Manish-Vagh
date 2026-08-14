import type { BrewPackage } from "../types";
import { PackageIcon } from "./PackageIcon";
import { VerifiedName } from "./VerifiedName";
import { formatBytes } from "../lib/format";
import { isOfficialCurrent, tokenChannel } from "../lib/trust";
import { BeerMeter } from "./BeerMeter";

interface Props {
  pkg: BrewPackage;
  featured?: boolean;
  pinned?: boolean;
  busy: boolean;
  queued?: boolean;
  diskBytes?: number | null;
  progressLabel?: string;
  progress?: number;
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
  progress,
  onOpen,
  onAction,
  onOpenApp,
  onCopyInstall,
}: Props) {
  const channel = tokenChannel(pkg.token);
  const official = isOfficialCurrent(pkg);
  const blocked = Boolean(pkg.disabled);
  const busyLabel =
    progressLabel ||
    (pkg.outdated ? "Updating" : pkg.installed ? "Working" : "Installing");

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
      className={`package-card glass-card ${featured ? "featured" : ""} ${busy ? "busy" : ""} ${queued ? "queued" : ""} ${pkg.deprecated || pkg.disabled ? "faded" : ""}`}
      onClick={() => onOpen(pkg)}
      onKeyDown={(e) => {
        if (e.key === "Enter") onOpen(pkg);
      }}
      role="button"
      tabIndex={0}
    >
      <PackageIcon pkg={pkg} />
      <div className="pkg-meta">
        <VerifiedName name={pkg.name} official={official} />
        <p className="pkg-token">{pkg.token}</p>
        <p>{pkg.desc || "No description"}</p>
        <div className="pkg-tags">
          <span className="tag">{pkg.type}</span>
          {official && <span className="tag official">Official</span>}
          {channel && <span className="tag soft">@{channel}</span>}
          {pkg.deprecated && <span className="tag warn">Deprecated</span>}
          {pkg.disabled && <span className="tag warn">Disabled</span>}
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
          <BeerMeter
            size="sm"
            label={busyLabel}
            value={progress}
          />
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
            disabled={blocked}
            title={blocked ? "Homebrew has disabled this package" : undefined}
            onClick={() => void onAction(action, pkg)}
          >
            {actionLabel}
          </button>
        )}
      </div>
    </article>
  );
}
