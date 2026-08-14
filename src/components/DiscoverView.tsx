import type { BrewPackage } from "../types";
import type { Collection } from "../discovery/collections";
import { PackageCard } from "./PackageCard";
import { PackageGrid } from "./PackageGrid";
import { PackageIcon } from "./PackageIcon";
import { VerifiedName } from "./VerifiedName";
import { isOfficialCurrent } from "../lib/trust";
import { BeerMeter } from "./BeerMeter";
import { progressFor, type JobProgress } from "../lib/brewProgress";

interface Props {
  featured: BrewPackage[];
  forYou: BrewPackage[];
  forYouBlurb: string;
  trending: BrewPackage[];
  collections: Array<{ collection: Collection; packages: BrewPackage[] }>;
  activeCollectionId: string | null;
  packages: BrewPackage[];
  query: string;
  filtering: boolean;
  updateCount: number;
  busyId: string | null;
  busyKeys?: Set<string>;
  queuedKeys?: Set<string>;
  jobProgress?: JobProgress;
  onOpen: (pkg: BrewPackage) => void;
  onAction: (action: "install" | "uninstall" | "upgrade", pkg: BrewPackage) => void;
  onOpenCollection: (id: string | null) => void;
  onOpenUpdates: () => void;
}

function PackageRow({
  packages,
  busyId,
  busyKeys,
  queuedKeys,
  jobProgress,
  onOpen,
  onAction,
}: {
  packages: BrewPackage[];
  busyId: string | null;
  busyKeys?: Set<string>;
  queuedKeys?: Set<string>;
  jobProgress?: JobProgress;
  onOpen: Props["onOpen"];
  onAction: Props["onAction"];
}) {
  return (
    <div className="package-grid">
      {packages.map((pkg) => {
        const key = `${pkg.type}:${pkg.id}`;
        return (
          <PackageCard
            key={key}
            pkg={pkg}
            busy={busyId === pkg.id || Boolean(busyKeys?.has(key))}
            queued={Boolean(queuedKeys?.has(key))}
            progress={progressFor(jobProgress ?? null, key, pkg.id)}
            onOpen={onOpen}
            onAction={onAction}
          />
        );
      })}
    </div>
  );
}

function Spotlight({
  pkg,
  busy,
  queued,
  progress,
  onOpen,
  onAction,
}: {
  pkg: BrewPackage;
  busy: boolean;
  queued: boolean;
  progress?: number;
  onOpen: Props["onOpen"];
  onAction: Props["onAction"];
}) {
  const official = isOfficialCurrent(pkg);
  let actionLabel = "Get";
  let action: "install" | "uninstall" | "upgrade" = "install";
  if (pkg.outdated) {
    actionLabel = "Update";
    action = "upgrade";
  } else if (pkg.installed) {
    actionLabel = "Details";
  }

  return (
    <article
      className="spotlight glass-card"
      onClick={() => onOpen(pkg)}
      onKeyDown={(e) => {
        if (e.key === "Enter") onOpen(pkg);
      }}
      role="button"
      tabIndex={0}
    >
      <PackageIcon pkg={pkg} />
      <div className="pkg-meta">
        <p className="eyebrow">Featured</p>
        <VerifiedName name={pkg.name} official={official} />
        <p>{pkg.desc || "Popular GUI app available via Homebrew Cask"}</p>
      </div>
      <div className="pkg-actions" onClick={(e) => e.stopPropagation()}>
        {pkg.installed && !pkg.outdated ? (
          <button type="button" className="btn soft" onClick={() => onOpen(pkg)}>
            Details
          </button>
        ) : busy ? (
          <BeerMeter
            size="sm"
            label={pkg.outdated ? "Updating" : "Installing"}
            value={progress}
          />
        ) : (
          <button
            type="button"
            className="btn primary"
            disabled={Boolean(pkg.disabled) || queued}
            onClick={() => void onAction(action, pkg)}
          >
            {queued ? "Queued" : actionLabel}
          </button>
        )}
      </div>
    </article>
  );
}

export function DiscoverView({
  featured,
  forYou,
  forYouBlurb,
  trending,
  collections,
  activeCollectionId,
  packages,
  query,
  filtering,
  updateCount,
  busyId,
  busyKeys,
  queuedKeys,
  jobProgress,
  onOpen,
  onAction,
  onOpenCollection,
  onOpenUpdates,
}: Props) {
  const browse = packages.slice(0, 8);
  const activeCollection = collections.find(
    (row) => row.collection.id === activeCollectionId,
  );
  const rowProps = { busyId, busyKeys, queuedKeys, jobProgress, onOpen, onAction };
  const featuredLead =
    featured.find((pkg) => !pkg.installed) || featured[0] || null;
  const featuredRest = featured.filter((pkg) => pkg.id !== featuredLead?.id);

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
          <PackageGrid
            key={query || "filtered"}
            packages={packages}
            resetKey={query || "filtered"}
            {...rowProps}
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
        <PackageGrid
          key={activeCollection.collection.id}
          packages={activeCollection.packages}
          resetKey={activeCollection.collection.id}
          {...rowProps}
        />
      </section>
    );
  }

  return (
    <section className="page discover">
      <header className="discover-intro">
        <div>
          <h1>Discover</h1>
          <p>Browse by job, popularity, or what’s already on this Mac.</p>
        </div>
        {updateCount > 0 && (
          <button type="button" className="btn primary" onClick={onOpenUpdates}>
            {updateCount} update{updateCount === 1 ? "" : "s"}
          </button>
        )}
      </header>

      {collections.length > 0 && (
        <div className="collection-chips" role="list">
          {collections.map(({ collection, packages: items }) => (
            <button
              key={collection.id}
              type="button"
              className="chip"
              role="listitem"
              onClick={() => onOpenCollection(collection.id)}
            >
              {collection.name}
              <span className="chip-count">{items.length}</span>
            </button>
          ))}
        </div>
      )}

      {forYou.length > 0 && (
        <>
          <div className="section-head">
            <h2>For you</h2>
            <p>{forYouBlurb}</p>
          </div>
          <PackageRow packages={forYou.slice(0, 6)} {...rowProps} />
        </>
      )}

      {featuredLead && (
        <>
          <div className="section-head">
            <h2>Featured</h2>
            <p>Popular GUI apps available via Homebrew Cask</p>
          </div>
          <Spotlight
            pkg={featuredLead}
            busy={
              busyId === featuredLead.id ||
              Boolean(busyKeys?.has(`${featuredLead.type}:${featuredLead.id}`))
            }
            queued={Boolean(queuedKeys?.has(`${featuredLead.type}:${featuredLead.id}`))}
            progress={progressFor(
              jobProgress ?? null,
              `${featuredLead.type}:${featuredLead.id}`,
              featuredLead.id,
            )}
            onOpen={onOpen}
            onAction={onAction}
          />
          {featuredRest.length > 0 && (
            <PackageRow packages={featuredRest.slice(0, 6)} {...rowProps} />
          )}
        </>
      )}

      {trending.length > 0 && (
        <>
          <div className="section-head">
            <h2>Trending</h2>
            <p>Popular installs across Homebrew (last 30 days)</p>
          </div>
          <PackageRow packages={trending.slice(0, 6)} {...rowProps} />
        </>
      )}

      <div className="section-head">
        <h2>Browse</h2>
        <p>A slice of the catalog — search or open a collection for more</p>
      </div>
      <PackageRow packages={browse} {...rowProps} />
    </section>
  );
}
