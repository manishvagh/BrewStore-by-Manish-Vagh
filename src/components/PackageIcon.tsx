import { useEffect, useRef, useState } from "react";
import type { BrewPackage } from "../types";
import { getCategory, packageKey } from "../categories";

const iconCache = new Map<string, string | null>();
const inflight = new Map<string, Promise<string | null>>();
const waiters = new Map<string, Array<(url: string | null) => void>>();
const pending = new Map<string, BrewPackage>();
let flushTimer: number | null = null;

function resolveWaiters(key: string, url: string | null) {
  iconCache.set(key, url);
  inflight.delete(key);
  const list = waiters.get(key) || [];
  waiters.delete(key);
  for (const fn of list) fn(url);
}

function flushBatch() {
  flushTimer = null;
  if (!window.brewStore?.resolveIcons || pending.size === 0) return;
  const batch = [...pending.values()].slice(0, 48);
  for (const pkg of batch) pending.delete(packageKey(pkg));
  const keys = batch.map((pkg) => packageKey(pkg));
  window.brewStore
    .resolveIcons(
      batch.map((pkg) => ({
        id: pkg.id,
        type: pkg.type,
        name: pkg.name,
        token: pkg.token,
        homepage: pkg.homepage,
        appNames: pkg.appNames || [],
      })),
    )
    .then((map) => {
      for (const key of keys) resolveWaiters(key, map[key] ?? null);
    })
    .catch(() => {
      for (const key of keys) resolveWaiters(key, null);
    });
  if (pending.size) scheduleFlush();
}

function scheduleFlush() {
  if (flushTimer != null) return;
  flushTimer = window.setTimeout(flushBatch, 40);
}

function fetchIcon(pkg: BrewPackage): Promise<string | null> {
  const key = packageKey(pkg);
  if (iconCache.has(key)) return Promise.resolve(iconCache.get(key) ?? null);
  if (inflight.has(key)) return inflight.get(key)!;
  if (!window.brewStore?.resolveIcons) return Promise.resolve(null);

  const promise = new Promise<string | null>((resolve) => {
    const list = waiters.get(key) || [];
    list.push(resolve);
    waiters.set(key, list);
  });
  inflight.set(key, promise);
  pending.set(key, pkg);
  scheduleFlush();
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
      { rootMargin: "180px" },
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
