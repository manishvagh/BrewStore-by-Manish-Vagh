import { ArrowLeft } from "lucide-react";
import type { Category } from "../categories";
import type { BrewPackage } from "../types";
import { PackageGrid } from "./PackageGrid";

interface Props {
  category: Category;
  packages: BrewPackage[];
  busyId: string | null;
  busyKeys?: Set<string>;
  queuedKeys?: Set<string>;
  onBack: () => void;
  onOpen: (pkg: BrewPackage) => void;
  onAction: (action: "install" | "uninstall" | "upgrade", pkg: BrewPackage) => void;
}

export function CategoryDetail({
  category,
  packages,
  busyId,
  busyKeys,
  queuedKeys,
  onBack,
  onOpen,
  onAction,
}: Props) {
  return (
    <section className="page">
      <button type="button" className="back-btn" onClick={onBack}>
        <ArrowLeft size={16} />
        Categories
      </button>
      <header className="page-header">
        <h1 style={{ color: category.accent }}>{category.name}</h1>
        <p>
          {category.blurb} · {packages.length.toLocaleString()} packages
        </p>
      </header>
      <PackageGrid
        packages={packages.slice(0, 200)}
        onOpen={onOpen}
        onAction={onAction}
        busyId={busyId}
        busyKeys={busyKeys}
        queuedKeys={queuedKeys}
      />
      {packages.length > 200 && (
        <p className="hint">Showing first 200 — refine with search.</p>
      )}
    </section>
  );
}
