import { ExternalLink } from "lucide-react";

interface Props {
  brewVersion: string;
  counts: { casks: number; formulae: number; total: number };
  onOpenExternal: (url: string) => void;
}

export function CreditsView({ brewVersion, counts, onOpenExternal }: Props) {
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
