import type { AppUpdateInfo } from "../types";

interface Props {
  update: AppUpdateInfo | null;
  checking: boolean;
  applying?: boolean;
  onCheck: () => void;
  onDownload: (update: AppUpdateInfo) => void;
  onDismiss: () => void;
}

export function UpdateBanner({
  update,
  checking,
  applying,
  onCheck,
  onDownload,
  onDismiss,
}: Props) {
  if (!update?.updateAvailable) {
    return (
      <button
        type="button"
        className="ghost-btn update-check-btn"
        disabled={checking || applying}
        onClick={onCheck}
      >
        {checking ? "Checking…" : "Check for BrewStore updates"}
      </button>
    );
  }

  const canInstall = Boolean(update.zipUrl || update.downloadUrl || update.dmgUrl);

  return (
    <div className="update-banner" role="status">
      <div>
        <strong>BrewStore {update.latestVersion}</strong> is available
        <span className="muted"> (you have {update.currentVersion})</span>
      </div>
      <div className="update-banner-actions">
        <button
          type="button"
          className="btn primary"
          disabled={applying}
          onClick={() => onDownload(update)}
        >
          {applying ? "Installing…" : canInstall ? "Install & relaunch" : "Download"}
        </button>
        <button type="button" className="btn soft" disabled={applying} onClick={onDismiss}>
          Later
        </button>
      </div>
    </div>
  );
}
