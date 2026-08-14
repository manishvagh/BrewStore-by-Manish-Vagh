import { Package } from "lucide-react";
import type { AppUpdateInfo, BrewFreshness, BrewPackage } from "../types";
import { PackageIcon } from "./PackageIcon";
import { VerifiedName } from "./VerifiedName";
import { formatAge } from "../lib/format";
import { isOfficialCurrent } from "../lib/trust";

interface Props {
  packages: BrewPackage[];
  busyId: string | null;
  updatingIds: Set<string>;
  dismissingIds: Set<string>;
  updatingAll: boolean;
  freshness: BrewFreshness | null;
  updatingBrew: boolean;
  brewUpdateQueued?: boolean;
  appVersion: string;
  appUpdate: AppUpdateInfo | null;
  checkingAppUpdate: boolean;
  applyingAppUpdate?: boolean;
  onOpen: (pkg: BrewPackage) => void;
  onUpdate: (pkg: BrewPackage) => void;
  onUpdateAll: () => void;
  onBrewUpdate: () => void;
  onApplyAppUpdate: (update: AppUpdateInfo) => void;
}

export function UpdatesView({
  packages,
  busyId,
  updatingIds,
  dismissingIds,
  updatingAll,
  freshness,
  updatingBrew,
  brewUpdateQueued,
  appVersion,
  appUpdate,
  checkingAppUpdate,
  applyingAppUpdate,
  onOpen,
  onUpdate,
  onUpdateAll,
  onBrewUpdate,
  onApplyAppUpdate,
}: Props) {
  const pending = packages.filter((p) => !dismissingIds.has(`${p.type}:${p.id}`));
  const allBusy = updatingAll || busyId === "__all__";
  const currentVersion = appUpdate?.currentVersion || appVersion;
  const appUpdateAvailable = Boolean(appUpdate?.updateAvailable);
  const latestVersion = appUpdate?.latestVersion;

  let appStatus = `Version ${currentVersion}`;
  if (checkingAppUpdate && !appUpdateAvailable) {
    appStatus = "Checking for updates…";
  } else if (applyingAppUpdate) {
    appStatus = `Installing ${latestVersion || "update"}…`;
  } else if (appUpdateAvailable) {
    appStatus = `Version ${latestVersion} is available — you have ${currentVersion}`;
  }

  let brewStatus = `Last updated ${formatAge(freshness?.ageMs)}`;
  if (updatingBrew) {
    brewStatus = brewUpdateQueued
      ? "Waiting for the current Homebrew job to finish…"
      : "Fetching taps — live output is in Activity.";
  } else if (freshness?.stale) {
    brewStatus = `Formulae look stale (${formatAge(freshness.ageMs)}). Update before trusting outdated lists.`;
  }

  return (
    <section className="page updates-page">
      <header className="page-header">
        <h1>Updates</h1>
        <p>BrewStore, Homebrew, then installed packages</p>
      </header>

      <section className="update-sources glass-card" aria-label="BrewStore and Homebrew">
        <div className={`update-source-row ${appUpdateAvailable ? "available" : ""}`}>
          <div className="update-source-main">
            <div className="update-source-icon" aria-hidden>
              <img src="./icon.png" alt="" width={40} height={40} />
            </div>
            <div className="update-source-copy">
              <h3>BrewStore</h3>
              <p>{appStatus}</p>
            </div>
          </div>
          <div className="update-source-action">
            {applyingAppUpdate ? (
              <div className="update-progress" aria-live="polite">
                <span className="progress-ring" />
                <span>Installing</span>
              </div>
            ) : appUpdateAvailable && appUpdate ? (
              <button
                type="button"
                className="btn primary"
                onClick={() => onApplyAppUpdate(appUpdate)}
              >
                Update
              </button>
            ) : checkingAppUpdate ? (
              <span className="update-source-idle">Checking…</span>
            ) : (
              <span className="update-source-idle ok">Up to date</span>
            )}
          </div>
        </div>

        <div className={`update-source-row ${freshness?.stale && !updatingBrew ? "stale" : ""}`}>
          <div className="update-source-main">
            <div className="update-source-icon mark" aria-hidden>
              <Package size={18} strokeWidth={2.2} />
            </div>
            <div className="update-source-copy">
              <h3>Homebrew</h3>
              <p>{brewStatus}</p>
            </div>
          </div>
          <div className="update-source-action">
            <button
              type="button"
              className="btn soft"
              disabled={updatingBrew || allBusy || applyingAppUpdate}
              onClick={onBrewUpdate}
            >
              {updatingBrew
                ? brewUpdateQueued
                  ? "Waiting…"
                  : "Updating…"
                : "Update Homebrew"}
            </button>
          </div>
        </div>
      </section>

      <header className="section-head row">
        <div>
          <h2>Packages</h2>
          <p>
            {pending.length === 0
              ? "All packages are up to date"
              : `${pending.length} update${pending.length === 1 ? "" : "s"} available`}
          </p>
        </div>
        {pending.length > 0 && (
          <button
            type="button"
            className="btn primary"
            disabled={allBusy || updatingIds.size > 0 || updatingBrew || applyingAppUpdate}
            onClick={onUpdateAll}
          >
            {allBusy ? (
              <span className="btn-progress">
                <span className="mini-spinner" />
                Updating All…
              </span>
            ) : (
              "Update All"
            )}
          </button>
        )}
      </header>

      {pending.length === 0 ? (
        <div className="empty glass-card">
          <p>You’re all set — nothing left to update.</p>
        </div>
      ) : (
        <div className="updates-list">
          {packages.map((pkg) => {
            const key = `${pkg.type}:${pkg.id}`;
            const isUpdating = updatingIds.has(key) || (allBusy && !dismissingIds.has(key));
            const isDismissing = dismissingIds.has(key);
            const official = isOfficialCurrent(pkg);

            return (
              <article
                key={key}
                className={`update-row glass-card ${isDismissing ? "dismissing" : ""} ${isUpdating ? "updating" : ""}`}
              >
                <button
                  type="button"
                  className="update-row-main"
                  onClick={() => onOpen(pkg)}
                >
                  <PackageIcon pkg={pkg} />
                  <div className="pkg-meta">
                    <VerifiedName name={pkg.name} official={official} />
                    <p>{pkg.desc || "Homebrew package"}</p>
                    <div className="pkg-tags">
                      <span className="tag">{pkg.type}</span>
                      {official && <span className="tag official">Official</span>}
                      {isUpdating ? (
                        <span className="tag soft">Updating…</span>
                      ) : (
                        <span className="tag soft">Update available</span>
                      )}
                    </div>
                  </div>
                </button>

                <div className="update-row-action">
                  {isUpdating ? (
                    <div className="update-progress" aria-live="polite">
                      <span className="progress-ring" />
                      <span>Updating</span>
                    </div>
                  ) : (
                    <button
                      type="button"
                      className="btn primary"
                      disabled={updatingIds.size > 0 || allBusy}
                      onClick={() => onUpdate(pkg)}
                    >
                      Update
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
