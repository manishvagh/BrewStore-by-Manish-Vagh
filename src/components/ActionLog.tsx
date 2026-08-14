import { useEffect, useRef } from "react";
import type { ActivitySnapshot } from "../types";
import { BeerMeter } from "./BeerMeter";
import { progressFor, type JobProgress } from "../lib/brewProgress";

interface Props {
  lines: string[];
  snapshot?: ActivitySnapshot | null;
  jobProgress?: JobProgress;
  onClear: () => void;
  onRetry?: (id: string) => void;
}

export function ActionLog({ lines, snapshot, jobProgress, onClear, onRetry }: Props) {
  const preRef = useRef<HTMLPreElement>(null);
  const current = snapshot?.current;
  const failed = (snapshot?.recent || [])
    .filter((row) => row.status === "error")
    .slice(-4)
    .reverse();

  useEffect(() => {
    const el = preRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [lines, current]);

  const idle = !current && lines.length === 0 && failed.length === 0;

  return (
    <div className={`sidebar-activity glass-inset ${idle ? "idle" : ""}`}>
      <div className="action-log-head">
        <span>Activity</span>
        {lines.length > 0 && (
          <button type="button" onClick={onClear}>
            Clear
          </button>
        )}
      </div>
      {idle ? (
        <p className="activity-idle">Idle — brew output appears here.</p>
      ) : (
        <>
          {current && (
            <>
              <p className="queue-current">
                Running {current.action}
                {current.pkgId ? ` · ${current.pkgId}` : ""}
              </p>
              <BeerMeter
                size="sm"
                label="Pouring"
                value={progressFor(
                  jobProgress ?? null,
                  current.pkgId,
                  current.action,
                )}
              />
            </>
          )}
          <pre ref={preRef}>
            {lines.length === 0
              ? "Install, update, or remove a package — live brew output shows here."
              : lines.slice(-40).join("\n")}
          </pre>
        </>
      )}
      {failed.length > 0 && (
        <ul className="activity-failed">
          {failed.map((row) => (
            <li key={row.id}>
              <span>
                {row.action}
                {row.pkgId ? ` ${row.pkgId}` : ""} failed
              </span>
              {onRetry && (
                <button type="button" onClick={() => onRetry(row.id)}>
                  Retry
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
