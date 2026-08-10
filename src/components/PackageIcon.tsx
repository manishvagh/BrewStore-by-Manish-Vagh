import { useEffect, useRef, useState } from "react";
import type { BrewPackage } from "../types";
import { getCategory, packageKey } from "../categories";

const iconCache = new Map<string, string | null>();
const inflight = new Map<string, Promise<string | null>>();

async function fetchIcon(pkg: BrewPackage): Promise<string | null> {
  const key = packageKey(pkg);
  if (iconCache.has(key)) return iconCache.get(key) ?? null;
  if (inflight.has(key)) return inflight.get(key)!;
  if (!window.brewStore?.resolveIcons) return null;

  const promise = window.brewStore
    .resolveIcons([
      {
        id: pkg.id,
        type: pkg.type,
        name: pkg.name,
        token: pkg.token,
        homepage: pkg.homepage,
        appNames: pkg.appNames || [],
      },
    ])
    .then((map) => {
      const url = map[key] ?? null;
      iconCache.set(key, url);
      inflight.delete(key);
      return url;
    })
    .catch(() => {
      iconCache.set(key, null);
      inflight.delete(key);
      return null;
    });

  inflight.set(key, promise);
  return promise;
}

function initials(name: string) {
  return name
    .replace(/[^a-zA-Z0-9 ]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() || "")
    .join("");
}

interface Props {
  pkg: BrewPackage;
  size?: "sm" | "lg";
}

export function PackageIcon({ pkg, size = "sm" }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [src, setSrc] = useState<string | null>(() => iconCache.get(packageKey(pkg)) ?? null);
  const [visible, setVisible] = useState(false);
  const category = pkg.category ? getCategory(pkg.category) : undefined;
  const accent = category?.accent || "#0b6bcb";

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) setVisible(true);
      },
      { rootMargin: "120px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    void fetchIcon(pkg).then((url) => {
      if (!cancelled) setSrc(url);
    });
    return () => {
      cancelled = true;
    };
  }, [visible, pkg]);

  return (
    <div
      ref={ref}
      className={`pkg-icon ${size === "lg" ? "lg" : ""} ${src ? "has-image" : ""}`}
      style={src ? undefined : { background: `linear-gradient(145deg, ${accent}, rgba(30,41,59,0.85))` }}
      aria-hidden
    >
      {src ? <img src={src} alt="" draggable={false} /> : initials(pkg.name) || "HB"}
    </div>
  );
}
