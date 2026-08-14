import { useEffect, useRef } from "react";
import type { ActivitySnapshot } from "../types";

interface Props {
  lines: string[];
  snapshot?: ActivitySnapshot | null;
  onClear: () => void;
  onRetry?: (id: string) => void;
}

export function ActionLog({ lines, snapshot, onClear, onRetry }: Props) {
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

  return (
    <div className="sidebar-activity glass-inset">
      <div className="action-log-head">
        <span>Activity</span>
        {lines.length > 0 && (
          <button type="button" onClick={onClear}>
            Clear
          </button>
        )}
      </div>
      {current && (
        <p className="queue-current">
          Running {current.action}
          {current.pkgId ? ` · ${current.pkgId}` : ""}
        </p>
      )}
      <pre ref={preRef}>
        {lines.length === 0
          ? "Install, update, or remove a package — live brew output shows here."
          : lines.slice(-40).join("\n")}
      </pre>
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
