import type { BrewPackage } from "../types";
import { PackageCard } from "./PackageCard";

interface Props {
  packages: BrewPackage[];
  busyId: string | null;
  pinnedIds?: Set<string>;
  onOpen: (pkg: BrewPackage) => void;
  onAction: (action: "install" | "uninstall" | "upgrade", pkg: BrewPackage) => void;
}

export function PackageGrid({ packages, busyId, pinnedIds, onOpen, onAction }: Props) {
  if (packages.length === 0) {
    return <div className="empty">Nothing here yet.</div>;
  }

  return (
    <div className="package-grid">
      {packages.map((pkg) => (
        <PackageCard
          key={`${pkg.type}:${pkg.id}`}
          pkg={pkg}
          pinned={pinnedIds?.has(pkg.id)}
          busy={busyId === pkg.id}
          onOpen={onOpen}
          onAction={onAction}
        />
      ))}
    </div>
  );
}
