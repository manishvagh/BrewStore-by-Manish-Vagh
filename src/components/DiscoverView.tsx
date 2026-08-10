import type { BrewPackage } from "../types";
import { PackageCard } from "./PackageCard";

interface Props {
  featured: BrewPackage[];
  packages: BrewPackage[];
  query: string;
  busyId: string | null;
  onOpen: (pkg: BrewPackage) => void;
  onAction: (action: "install" | "uninstall" | "upgrade", pkg: BrewPackage) => void;
  onOpenCategory: (id: string) => void;
}

const QUICK_CATEGORIES: { id: string; name: string }[] = [
  { id: "developer-tools", name: "Developer Tools" },
  { id: "productivity", name: "Productivity" },
  { id: "browsers", name: "Browsers" },
  { id: "utilities", name: "Utilities" },
  { id: "photo-video", name: "Photo & Video" },
  { id: "communication", name: "Communication" },
];

export function DiscoverView({
  featured,
  packages,
  query,
  busyId,
  onOpen,
  onAction,
  onOpenCategory,
}: Props) {
  const spotlight = packages.slice(0, 24);

  return (
    <section className="page discover">
      <header className="hero">
        <div className="hero-copy">
          <p className="eyebrow">Homebrew App Store</p>
          <h1 className="hero-brand">BrewStore</h1>
          <p className="hero-sub">
            Browse, install, update, and remove Homebrew casks & formulae — with
            App Store–style categories.
          </p>
        </div>
        <div className="hero-visual" aria-hidden>
          <div className="hero-orb" />
          <div className="hero-orb secondary" />
        </div>
      </header>

      {!query && (
        <>
          <div className="section-head">
            <h2>Categories</h2>
          </div>
          <div className="category-chips">
            {QUICK_CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                type="button"
                className="chip"
                onClick={() => onOpenCategory(cat.id)}
              >
                {cat.name}
              </button>
            ))}
          </div>

          <div className="section-head">
            <h2>Featured</h2>
            <p>Popular GUI apps available via Homebrew Cask</p>
          </div>
          <div className="featured-row">
            {featured.map((pkg) => (
              <PackageCard
                key={`${pkg.type}:${pkg.id}`}
                pkg={pkg}
                featured
                busy={busyId === pkg.id}
                onOpen={onOpen}
                onAction={onAction}
              />
            ))}
          </div>
        </>
      )}

      <div className="section-head">
        <h2>{query ? "Search results" : "Browse"}</h2>
        <p>
          {query
            ? `${packages.length} matches`
            : "A slice of the catalog — use search or categories for more"}
        </p>
      </div>
      <div className="package-grid">
        {(query ? packages : spotlight).map((pkg) => (
          <PackageCard
            key={`${pkg.type}:${pkg.id}`}
            pkg={pkg}
            busy={busyId === pkg.id}
            onOpen={onOpen}
            onAction={onAction}
          />
        ))}
      </div>
    </section>
  );
}
