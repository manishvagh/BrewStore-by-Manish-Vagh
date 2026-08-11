import { useEffect, useMemo, useRef, useState } from "react";
import { Search } from "lucide-react";
import type { BrewPackage } from "../types";
import { packageKey } from "../categories";
import { brewInstallCommand } from "../lib/format";

export type PaletteAction =
  | { kind: "nav"; id: string; label: string }
  | { kind: "focus-search"; label: string }
  | { kind: "check-update"; label: string }
  | { kind: "donate"; label: string }
  | { kind: "pkg"; pkg: BrewPackage; action: "open" | "install" | "upgrade" | "copy" };

interface Props {
  open: boolean;
  packages: BrewPackage[];
  onClose: () => void;
  onRun: (action: PaletteAction) => void;
}

const NAV_ACTIONS: PaletteAction[] = [
  { kind: "nav", id: "discover", label: "Go to Discover" },
  { kind: "nav", id: "categories", label: "Go to Categories" },
  { kind: "nav", id: "installed", label: "Go to Installed" },
  { kind: "nav", id: "updates", label: "Go to Updates" },
  { kind: "nav", id: "maintain", label: "Go to Maintain" },
  { kind: "nav", id: "credits", label: "Go to Credits" },
  { kind: "focus-search", label: "Focus search" },
  { kind: "check-update", label: "Check for BrewStore updates" },
  { kind: "donate", label: "Support with PayPal" },
];

export function CommandPalette({ open, packages, onClose, onRun }: Props) {
  const [query, setQuery] = useState("");
  const [index, setIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const items = useMemo(() => {
    const q = query.trim().toLowerCase();
    const cmds = NAV_ACTIONS.filter((item) => {
      if (item.kind === "pkg") return false;
      return !q || item.label.toLowerCase().includes(q);
    });
    if (!q) return cmds.slice(0, 8);

    const pkgHits = packages
      .filter((pkg) => {
        const hay = `${pkg.name} ${pkg.id} ${pkg.desc}`.toLowerCase();
        return hay.includes(q);
      })
      .slice(0, 10)
      .flatMap((pkg) => {
        const actions: PaletteAction[] = [
          { kind: "pkg", pkg, action: "open" },
        ];
        if (!pkg.installed) {
          actions.push({ kind: "pkg", pkg, action: "install" });
        } else if (pkg.outdated) {
          actions.push({ kind: "pkg", pkg, action: "upgrade" });
        }
        actions.push({ kind: "pkg", pkg, action: "copy" });
        return actions;
      });

    return [...cmds, ...pkgHits].slice(0, 20);
  }, [packages, query]);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setIndex(0);
    const id = window.setTimeout(() => inputRef.current?.focus(), 20);
    return () => window.clearTimeout(id);
  }, [open]);

  useEffect(() => {
    setIndex(0);
  }, [query]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      } else if (event.key === "ArrowDown") {
        event.preventDefault();
        setIndex((i) => Math.min(items.length - 1, i + 1));
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        setIndex((i) => Math.max(0, i - 1));
      } else if (event.key === "Enter") {
        event.preventDefault();
        const item = items[index];
        if (item) {
          onRun(item);
          onClose();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, items, index, onClose, onRun]);

  if (!open) return null;

  return (
    <div
      className="palette-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className="command-palette"
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
      >
        <div className="palette-search">
          <Search size={16} />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search commands and packages…"
            aria-label="Command palette search"
          />
          <kbd>esc</kbd>
        </div>
        <ul className="palette-list" role="listbox">
          {items.length === 0 && (
            <li className="palette-empty">No matches</li>
          )}
          {items.map((item, i) => {
            const key =
              item.kind === "pkg"
                ? `${packageKey(item.pkg)}:${item.action}`
                : item.label;
            const label =
              item.kind === "pkg"
                ? item.action === "open"
                  ? `Open ${item.pkg.name}`
                  : item.action === "install"
                    ? `Install ${item.pkg.name}`
                    : item.action === "upgrade"
                      ? `Update ${item.pkg.name}`
                      : `Copy “${brewInstallCommand(item.pkg)}”`
                : item.label;
            return (
              <li key={key}>
                <button
                  type="button"
                  className={i === index ? "active" : ""}
                  role="option"
                  aria-selected={i === index}
                  onMouseEnter={() => setIndex(i)}
                  onClick={() => {
                    onRun(item);
                    onClose();
                  }}
                >
                  <span>{label}</span>
                  {item.kind === "pkg" && (
                    <span className="tag">{item.pkg.type}</span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
        <p className="palette-hint">
          <kbd>⌘K</kbd> palette · <kbd>/</kbd> search · <kbd>⌘I</kbd> install
          selected
        </p>
      </div>
    </div>
  );
}
