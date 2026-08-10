import { useState } from "react";
import { Check, Copy, ExternalLink, Terminal } from "lucide-react";

export interface BrewMissingInfo {
  installCommand: string;
  brewSite: string;
}

interface Props {
  info: BrewMissingInfo;
  checking: boolean;
  checkError: string | null;
  onOpenInstaller: () => Promise<void>;
  onCopyCommand: () => Promise<void>;
  onOpenSite: () => void;
  onRecheck: () => Promise<void>;
}

export function BrewOnboarding({
  info,
  checking,
  checkError,
  onOpenInstaller,
  onCopyCommand,
  onOpenSite,
  onRecheck,
}: Props) {
  const [copied, setCopied] = useState(false);
  const [opening, setOpening] = useState(false);
  const [openError, setOpenError] = useState<string | null>(null);

  async function handleInstall() {
    setOpening(true);
    setOpenError(null);
    try {
      await onOpenInstaller();
    } catch (err) {
      setOpenError(err instanceof Error ? err.message : String(err));
    } finally {
      setOpening(false);
    }
  }

  async function handleCopy() {
    await onCopyCommand();
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  return (
    <section className="onboarding" aria-labelledby="brew-onboard-title">
      <div className="onboarding-card glass-card">
        <p className="onboarding-kicker">Setup required</p>
        <h1 id="brew-onboard-title">Install Homebrew to use BrewStore</h1>
        <p className="onboarding-lead">
          BrewStore is a visual front end for Homebrew. It does not replace
          Homebrew — once brew is on this Mac, you can discover and manage the
          full catalog here.
        </p>

        <ol className="onboarding-steps">
          <li>Install Homebrew (opens Terminal with the official installer).</li>
          <li>Follow the prompts — you may need your Mac password.</li>
          <li>Come back here and tap Continue.</li>
        </ol>

        <div className="onboarding-actions">
          <button
            type="button"
            className="btn primary"
            disabled={opening || checking}
            onClick={() => void handleInstall()}
          >
            <Terminal size={16} aria-hidden />
            {opening ? "Opening Terminal…" : "Install Homebrew"}
          </button>
          <button
            type="button"
            className="btn soft"
            disabled={checking}
            onClick={() => void onRecheck()}
          >
            {checking ? "Checking…" : "I’ve installed it — Continue"}
          </button>
        </div>

        {(openError || checkError) && (
          <p className="onboarding-error" role="alert">
            {openError || checkError}
          </p>
        )}

        <div className="onboarding-command">
          <code>{info.installCommand}</code>
          <button
            type="button"
            className="btn soft onboarding-copy"
            onClick={() => void handleCopy()}
          >
            {copied ? <Check size={14} aria-hidden /> : <Copy size={14} aria-hidden />}
            {copied ? "Copied" : "Copy"}
          </button>
        </div>

        <button type="button" className="link-btn onboarding-site" onClick={onOpenSite}>
          Official instructions on brew.sh <ExternalLink size={14} />
        </button>
      </div>
    </section>
  );
}
