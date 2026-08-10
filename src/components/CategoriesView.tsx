import type { Category } from "../categories";
import type { BrewPackage } from "../types";

interface Props {
  categories: Category[];
  packages: BrewPackage[];
  onOpenCategory: (id: string) => void;
}

export function CategoriesView({ categories, packages, onOpenCategory }: Props) {
  return (
    <section className="page">
      <header className="page-header">
        <h1>Categories</h1>
        <p>Browse Homebrew like the App Store</p>
      </header>
      <div className="category-grid">
        {categories.map((category) => {
          const count = packages.filter((p) => p.category === category.id).length;
          return (
            <button
              key={category.id}
              type="button"
              className="category-tile"
              style={{ ["--accent" as string]: category.accent }}
              onClick={() => onOpenCategory(category.id)}
            >
              <span className="category-tile-name">{category.name}</span>
              <span className="category-tile-blurb">{category.blurb}</span>
              <span className="category-tile-count">{count.toLocaleString()} apps</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
