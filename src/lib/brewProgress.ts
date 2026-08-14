/** Current brew job fill, keyed by package id (`cask:firefox`) or action name. */
export type JobProgress = { key: string; percent: number } | null;

export function parseBrewPercent(text: string): number | null {
  if (!text) return null;

  const percents = [...text.matchAll(/(\d{1,3}(?:\.\d+)?)\s*%/g)];
  if (percents.length > 0) {
    const n = Number(percents[percents.length - 1][1]);
    if (Number.isFinite(n) && n >= 0 && n <= 100) return Math.round(n);
  }

  const bar = text.match(/^\s*([#=\s]{10,})\s*$/m);
  if (bar) {
    const hashes = (bar[1].match(/#/g) || []).length;
    const width = bar[1].replace(/\s+$/, "").length;
    if (hashes >= 4 && width >= 10) {
      return Math.min(100, Math.round((hashes / Math.max(width, 72)) * 100));
    }
  }

  return null;
}

export function jobProgressKey(id?: string | null, action?: string | null) {
  return id || action || "";
}

export function progressFor(
  job: JobProgress,
  ...keys: Array<string | null | undefined>
): number | undefined {
  if (!job) return undefined;
  return keys.some((key) => key && key === job.key) ? job.percent : undefined;
}
