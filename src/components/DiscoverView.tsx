import type { BrewPackage } from "../types";
import type { Collection } from "../discovery/collections";
import { PackageCard } from "./PackageCard";

interface Props {
  featured: BrewPackage[];
  forYou: BrewPackage[];
  trending: BrewPackage[];
  collections: Array<{ collection: Collection; packages: BrewPackage[] }>;
  activeCollectionId: string | null;
  packages: BrewPackage[];
  query: string;
  filtering: boolean;
  busyId: string | null;
  onOpen: (pkg: BrewPackage) => void;
  onAction: (action: "install" | "uninstall" | "upgrade", pkg: BrewPackage) => void;
  onOpenCategory: (id: string) => void;
  onOpenCollection: (id: string | null) => void;
}

const QUICK_CATEGORIES: { id: string; name: string }[] = [
  { id: "developer-tools", name: "Developer Tools" },
  { id: "productivity", name: "Productivity" },
  { id: "browsers", name: "Browsers" },
  { id: "utilities", name: "Utilities" },
  { id: "photo-video", name: "Photo & Video" },
  { id: "communication", name: "Communication" },
];

function PackageRow({
  packages,
  busyId,
  onOpen,
  onAction,
  featured,
}: {
  packages: BrewPackage[];
  busyId: string | null;
  onOpen: Props["onOpen"];
  onAction: Props["onAction"];
  featured?: boolean;
}) {
  return (
    <div className={featured ? "featured-row" : "package-grid"}>
      {packages.map((pkg) => (
        <PackageCard
          key={`${pkg.type}:${pkg.id}`}
          pkg={pkg}
          featured={featured}
          busy={busyId === pkg.id}
          onOpen={onOpen}
          onAction={onAction}
        />
      ))}
    </div>
  );
}

export function DiscoverView({
  featured,
  forYou,
  trending,
  collections,
  activeCollectionId,
  packages,
  query,
  filtering,
  busyId,
  onOpen,
  onAction,
  onOpenCategory,
  onOpenCollection,
}: Props) {
  const spotlight = packages.slice(0, 24);
  const activeCollection = collections.find(
    (row) => row.collection.id === activeCollectionId,
  );

  if (query || filtering) {
    return (
      <section className="page discover">
        <div className="section-head">
          <h2>{query ? "Search results" : "Filtered catalog"}</h2>
          <p>{packages.length.toLocaleString()} matches</p>
        </div>
        {packages.length === 0 ? (
          <div className="empty">No packages match these filters.</div>
        ) : (
          <PackageRow
            packages={packages.slice(0, query ? packages.length : 120)}
            busyId={busyId}
            onOpen={onOpen}
            onAction={onAction}
          />
        )}
      </section>
    );
  }

  if (activeCollection) {
    return (
      <section className="page discover">
        <button
          type="button"
          className="ghost-btn collection-back"
          onClick={() => onOpenCollection(null)}
        >
          ← Discover
        </button>
        <header className="page-header">
          <h1>{activeCollection.collection.name}</h1>
          <p>{activeCollection.collection.blurb}</p>
        </header>
        <PackageRow
          packages={activeCollection.packages}
          busyId={busyId}
          onOpen={onOpen}
          onAction={onAction}
        />
      </section>
    );
  }

  return (
    <section className="page discover">
      <header className="hero">
        <div className="hero-copy">
          <p className="eyebrow">Homebrew App Store</p>
          <h1 className="hero-brand">BrewStore</h1>
          <p className="hero-sub">
            Discover apps and tools in Homebrew’s huge catalog — including ones
            you’d never think to search for.
          </p>
        </div>
        <div className="hero-visual" aria-hidden>
          <div className="hero-orb" />
          <div className="hero-orb secondary" />
        </div>
      </header>

      {forYou.length > 0 && (
        <>
          <div className="section-head">
            <h2>For you</h2>
            <p>Suggested from what’s already on this Mac</p>
          </div>
          <PackageRow
            packages={forYou}
            busyId={busyId}
            onOpen={onOpen}
            onAction={onAction}
            featured
          />
        </>
      )}

      <div className="section-head">
        <h2>Collections</h2>
        <p>Curated lists to explore by job, not by package name</p>
      </div>
      <div className="collection-grid">
        {collections.map(({ collection, packages: items }) => (
          <button
            key={collection.id}
            type="button"
            className="collection-card glass-card"
            onClick={() => onOpenCollection(collection.id)}
          >
            <h3>{collection.name}</h3>
            <p>{collection.blurb}</p>
            <span className="collection-count">
              {items.length} package{items.length === 1 ? "" : "s"}
            </span>
          </button>
        ))}
      </div>

      {trending.length > 0 && (
        <>
          <div className="section-head">
            <h2>Trending</h2>
            <p>Popular installs across Homebrew (last 30 days)</p>
          </div>
          <PackageRow
            packages={trending}
            busyId={busyId}
            onOpen={onOpen}
            onAction={onAction}
            featured
          />
        </>
      )}

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
      <PackageRow
        packages={featured}
        busyId={busyId}
        onOpen={onOpen}
        onAction={onAction}
        featured
      />

      <div className="section-head">
        <h2>Browse</h2>
        <p>A slice of the catalog — use search or collections for more</p>
      </div>
      <PackageRow
        packages={spotlight}
        busyId={busyId}
        onOpen={onOpen}
        onAction={onAction}
      />
    </section>
  );
}
