import type { BrewPackage } from "../types";
import { PackageIcon } from "./PackageIcon";

interface Props {
  packages: BrewPackage[];
  busyId: string | null;
  updatingIds: Set<string>;
  dismissingIds: Set<string>;
  updatingAll: boolean;
  onOpen: (pkg: BrewPackage) => void;
  onUpdate: (pkg: BrewPackage) => void;
  onUpdateAll: () => void;
}

export function UpdatesView({
  packages,
  busyId,
  updatingIds,
  dismissingIds,
  updatingAll,
  onOpen,
  onUpdate,
  onUpdateAll,
}: Props) {
  const pending = packages.filter((p) => !dismissingIds.has(`${p.type}:${p.id}`));
  const allBusy = updatingAll || busyId === "__all__";

  return (
    <section className="page updates-page">
      <header className="page-header row">
        <div>
          <h1>Updates</h1>
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
            disabled={allBusy || updatingIds.size > 0}
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
                    <h3>{pkg.name}</h3>
                    <p>{pkg.desc || "Homebrew package"}</p>
                    <div className="pkg-tags">
                      <span className="tag">{pkg.type}</span>
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
