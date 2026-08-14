import {
  Atom,
  Camera,
  Clapperboard,
  Code2,
  Gamepad2,
  Globe,
  GraduationCap,
  ListTodo,
  MessageCircle,
  Music,
  Palette,
  Shield,
  Terminal,
  Wallet,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import type { Category } from "../categories";
import type { BrewPackage } from "../types";

const ICONS: Record<string, LucideIcon> = {
  "developer-tools": Terminal,
  productivity: ListTodo,
  utilities: Wrench,
  "graphics-design": Palette,
  "photo-video": Camera,
  music: Music,
  browsers: Globe,
  communication: MessageCircle,
  security: Shield,
  games: Gamepad2,
  education: GraduationCap,
  science: Atom,
  finance: Wallet,
  entertainment: Clapperboard,
};

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
          const Icon = ICONS[category.id] ?? Code2;
          return (
            <button
              key={category.id}
              type="button"
              className={`category-tile cat-${category.id}`}
              style={{ ["--accent" as string]: category.accent }}
              onClick={() => onOpenCategory(category.id)}
            >
              <span className="category-motif" aria-hidden />
              <span className="category-tile-icon">
                <Icon size={22} strokeWidth={2} />
              </span>
              <span className="category-tile-name">{category.name}</span>
              <span className="category-tile-blurb">{category.blurb}</span>
              <span className="category-tile-cues">
                {category.cues.map((cue) => (
                  <span key={cue} className="category-cue">
                    {cue}
                  </span>
                ))}
              </span>
              <span className="category-tile-count">
                {count.toLocaleString()} packages
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
