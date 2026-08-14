import { useEffect, useRef } from "react";
import { ExternalLink } from "lucide-react";
import { BeerMeter } from "./BeerMeter";

interface Props {
  installing: boolean;
  checking: boolean;
  logLines: string[];
  error: string | null;
  progress?: number;
  onInstall: () => Promise<void>;
  onOpenSite: () => void;
}

export function BrewOnboarding({
  installing,
  checking,
  logLines,
  error,
  progress,
  onInstall,
  onOpenSite,
}: Props) {
  const logRef = useRef<HTMLPreElement>(null);
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    void onInstall();
  }, [onInstall]);

  useEffect(() => {
    const el = logRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [logLines]);

  const busy = installing || checking;

  return (
    <section className="onboarding" aria-labelledby="brew-onboard-title">
      <div className="onboarding-card glass-card">
        <p className="onboarding-kicker">BrewStore setup</p>
        <h1 id="brew-onboard-title">
          {busy ? "Finishing setup…" : error ? "Setup needs attention" : "Almost ready"}
        </h1>
        <p className="onboarding-lead">
          BrewStore needs Homebrew on this Mac. Setup runs inside BrewStore —
          macOS may ask for your password once. No Terminal window is opened.
        </p>

        <div className="onboarding-status" aria-live="polite">
          {busy && (
            <BeerMeter
              layout="pint"
              size="md"
              label={installing ? "Installing Homebrew" : "Checking Homebrew"}
              value={progress}
            />
          )}
          <pre ref={logRef} className="onboarding-log">
            {logLines.length ? logLines.join("") : "Preparing Homebrew setup…\n"}
          </pre>
        </div>

        {error && (
          <p className="onboarding-error" role="alert">
            {error}
          </p>
        )}

        <div className="onboarding-actions">
          {error && (
            <button
              type="button"
              className="btn primary"
              disabled={busy}
              onClick={() => void onInstall()}
            >
              Try again
            </button>
          )}
          <button type="button" className="link-btn onboarding-site" onClick={onOpenSite}>
            About Homebrew <ExternalLink size={14} />
          </button>
        </div>
      </div>
    </section>
  );
}
