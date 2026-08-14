import { ExternalLink, Heart } from "lucide-react";
import { UpdateBanner } from "./UpdateBanner";
import { PAYPAL_SUPPORT_URL } from "../lib/donate";
import type { AppUpdateInfo } from "../types";

interface Props {
  appVersion: string;
  brewVersion: string;
  counts: { casks: number; formulae: number; total: number };
  appUpdate: AppUpdateInfo | null;
  checkingUpdate: boolean;
  applyingUpdate?: boolean;
  progress?: number;
  onCheckUpdate: () => void;
  onDownloadUpdate: (update: AppUpdateInfo) => void;
  onDismissUpdate: () => void;
  onOpenExternal: (url: string) => void;
}

const OFFICIAL_REPO =
  "https://github.com/manishvagh/BrewStore-by-Manish-Vagh";
const OFFICIAL_SITE = "https://brewstore.app/";
const AUTHOR_SITE = "https://manishvagh.in/";

export function CreditsView({
  appVersion,
  brewVersion,
  counts,
  appUpdate,
  checkingUpdate,
  applyingUpdate,
  progress,
  onCheckUpdate,
  onDownloadUpdate,
  onDismissUpdate,
  onOpenExternal,
}: Props) {
  return (
    <section className="page credits">
      <header className="page-header">
        <h1>Credits</h1>
        <p>BrewStore and the software it installs</p>
      </header>

      <div className="credit-panel">
        <h2>BrewStore</h2>
        <p>
          Developed by <strong>Manish Vagh</strong>. BrewStore is an independent
          GUI for discovering and managing Homebrew packages. It is not
          affiliated with Apple or the App Store.
        </p>
        <p className="muted">Version {appVersion}</p>
        <UpdateBanner
          update={appUpdate}
          checking={checkingUpdate}
          applying={applyingUpdate}
          progress={progress}
          onCheck={onCheckUpdate}
          onDownload={onDownloadUpdate}
          onDismiss={onDismissUpdate}
        />
        <p className="muted">
          Official product by Manish Vagh — not a third-party rebrand.
        </p>
        <button
          type="button"
          className="link-btn"
          onClick={() => onOpenExternal(OFFICIAL_SITE)}
        >
          brewstore.app <ExternalLink size={14} />
        </button>
        <button
          type="button"
          className="link-btn"
          onClick={() => onOpenExternal(AUTHOR_SITE)}
        >
          manishvagh.in <ExternalLink size={14} />
        </button>
        <button
          type="button"
          className="link-btn"
          onClick={() => onOpenExternal(OFFICIAL_REPO)}
        >
          Official GitHub repository <ExternalLink size={14} />
        </button>
      </div>

      <div className="credit-panel">
        <h2>Support</h2>
        <p>
          BrewStore is free — no account, no ads. If it saves you time, you
          can send an optional PayPal payment to help cover Apple developer,
          hosting, and build costs.
        </p>
        <button
          type="button"
          className="btn soft donate-btn"
          onClick={() => onOpenExternal(PAYPAL_SUPPORT_URL)}
        >
          <Heart size={16} /> Support with PayPal
        </button>
        <p className="muted">Optional — every feature stays free either way.</p>
      </div>

      <div className="credit-panel">
        <h2>Name &amp; trademark</h2>
        <p>
          The software is open source under the MIT License. The{" "}
          <strong>BrewStore</strong> name and attribution to{" "}
          <strong>Manish Vagh</strong> identify the official product.
        </p>
        <p>
          Modified or redistributed builds must not claim to be the official
          BrewStore. Forks should use a different product name and may state
          that they are based on BrewStore by Manish Vagh.
        </p>
        <button
          type="button"
          className="link-btn"
          onClick={() =>
            onOpenExternal(`${OFFICIAL_REPO}/blob/main/TRADEMARKS.md`)
          }
        >
          Trademark guidelines <ExternalLink size={14} />
        </button>
      </div>

      <div className="credit-panel">
        <h2>Homebrew</h2>
        <p>
          Package management powered by <strong>Homebrew</strong> — the missing
          package manager for macOS. Created by Max Howell; maintained by Mike
          McQuaid and the Homebrew project contributors.
        </p>
        <p className="muted">{brewVersion}</p>
        <button
          type="button"
          className="link-btn"
          onClick={() => onOpenExternal("https://brew.sh")}
        >
          brew.sh <ExternalLink size={14} />
        </button>
        <button
          type="button"
          className="link-btn"
          onClick={() => onOpenExternal("https://github.com/Homebrew/brew")}
        >
          Homebrew on GitHub <ExternalLink size={14} />
        </button>
      </div>

      <div className="credit-panel">
        <h2>Package authors & repositories</h2>
        <p>
          Every app and formula shown in BrewStore belongs to its respective
          owners — including public open-source projects and proprietary /
          private-repo vendors distributed via Homebrew Cask.
        </p>
        <ul className="credit-list">
          <li>
            Open each package’s detail view for homepage, license, source URL,
            and Homebrew formula links.
          </li>
          <li>
            Catalog metadata comes from the official Homebrew formulae API
            ({counts.total.toLocaleString()} packages:{" "}
            {counts.casks.toLocaleString()} casks ·{" "}
            {counts.formulae.toLocaleString()} formulae).
          </li>
          <li>
            Installing a package does not transfer ownership; always review the
            upstream license and terms.
          </li>
        </ul>
        <button
          type="button"
          className="link-btn"
          onClick={() => onOpenExternal("https://formulae.brew.sh")}
        >
          formulae.brew.sh <ExternalLink size={14} />
        </button>
      </div>

      <div className="credit-panel soft">
        <p>
          © {new Date().getFullYear()} Manish Vagh · BrewStore · All third-party
          software remains © its respective owners.
        </p>
      </div>
    </section>
  );
}
