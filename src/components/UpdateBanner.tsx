import type { AppUpdateInfo } from "../types";
import { BeerMeter } from "./BeerMeter";

interface Props {
  update: AppUpdateInfo | null;
  checking: boolean;
  applying?: boolean;
  progress?: number;
  onCheck: () => void;
  onDownload: (update: AppUpdateInfo) => void;
  onDismiss: () => void;
}

export function UpdateBanner({
  update,
  checking,
  applying,
  progress,
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
        {applying ? (
          <BeerMeter size="sm" label="Installing" value={progress} />
        ) : (
          <button
            type="button"
            className="btn primary"
            onClick={() => onDownload(update)}
          >
            {canInstall ? "Install & relaunch" : "Download"}
          </button>
        )}
        <button type="button" className="btn soft" disabled={applying} onClick={onDismiss}>
          Later
        </button>
      </div>
    </div>
  );
}
