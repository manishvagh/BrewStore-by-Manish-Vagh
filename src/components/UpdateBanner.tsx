import type { AppUpdateInfo } from "../types";

interface Props {
  update: AppUpdateInfo | null;
  checking: boolean;
  onCheck: () => void;
  onDownload: (update: AppUpdateInfo) => void;
  onDismiss: () => void;
}

export function UpdateBanner({
  update,
  checking,
  onCheck,
  onDownload,
  onDismiss,
}: Props) {
  if (!update?.updateAvailable) {
    return (
      <button
        type="button"
        className="ghost-btn update-check-btn"
        disabled={checking}
        onClick={onCheck}
      >
        {checking ? "Checking…" : "Check for BrewStore updates"}
      </button>
    );
  }

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
          onClick={() => onDownload(update)}
        >
          Download
        </button>
        <button type="button" className="btn soft" onClick={onDismiss}>
          Later
        </button>
      </div>
    </div>
  );
}
