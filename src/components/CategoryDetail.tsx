import { ArrowLeft } from "lucide-react";
import type { Category } from "../categories";
import type { BrewPackage } from "../types";
import { PackageGrid } from "./PackageGrid";
import type { JobProgress } from "../lib/brewProgress";

interface Props {
  category: Category;
  packages: BrewPackage[];
  busyId: string | null;
  busyKeys?: Set<string>;
  queuedKeys?: Set<string>;
  jobProgress?: JobProgress;
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
  jobProgress,
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
          {category.blurb} · scroll to browse all{" "}
          {packages.length.toLocaleString()} packages
        </p>
      </header>
      <PackageGrid
        key={category.id}
        packages={packages}
        resetKey={category.id}
        onOpen={onOpen}
        onAction={onAction}
        busyId={busyId}
        busyKeys={busyKeys}
        queuedKeys={queuedKeys}
        jobProgress={jobProgress}
      />
    </section>
  );
}
