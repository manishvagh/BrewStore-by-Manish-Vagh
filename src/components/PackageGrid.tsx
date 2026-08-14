import type { BrewPackage } from "../types";
import { useVirtualGrid } from "../hooks/useVirtualGrid";
import { PackageCard } from "./PackageCard";

interface Props {
  packages: BrewPackage[];
  busyId: string | null;
  busyKeys?: Set<string>;
  queuedKeys?: Set<string>;
  pinnedIds?: Set<string>;
  diskUsage?: Record<string, number>;
  resetKey?: string | number;
  onOpen: (pkg: BrewPackage) => void;
  onAction: (action: "install" | "uninstall" | "upgrade", pkg: BrewPackage) => void;
  onOpenApp?: (pkg: BrewPackage) => void;
  onCopyInstall?: (pkg: BrewPackage) => void;
}

function keyOf(pkg: BrewPackage) {
  return `${pkg.type}:${pkg.id}`;
}

export function PackageGrid({
  packages,
  busyId,
  busyKeys,
  queuedKeys,
  pinnedIds,
  diskUsage,
  resetKey,
  onOpen,
  onAction,
  onOpenApp,
  onCopyInstall,
}: Props) {
  const { wrapRef, gridRef, start, end, pad } = useVirtualGrid(
    packages.length,
    resetKey,
  );

  if (packages.length === 0) {
    return <div className="empty">Nothing here yet.</div>;
  }

  const visible = packages.slice(start, end);

  return (
    <div
      ref={wrapRef}
      className="package-grid-virt"
      style={{ paddingTop: pad.top, paddingBottom: pad.bottom }}
    >
      <div ref={gridRef} className="package-grid">
        {visible.map((pkg) => {
          const key = keyOf(pkg);
          const busy = busyId === pkg.id || Boolean(busyKeys?.has(key));
          return (
            <PackageCard
              key={key}
              pkg={pkg}
              busy={busy}
              queued={Boolean(queuedKeys?.has(key)) && !busy}
              pinned={pinnedIds?.has(pkg.id)}
              diskBytes={diskUsage?.[key]}
              onOpen={onOpen}
              onAction={onAction}
              onOpenApp={onOpenApp}
              onCopyInstall={onCopyInstall}
            />
          );
        })}
      </div>
    </div>
  );
}
