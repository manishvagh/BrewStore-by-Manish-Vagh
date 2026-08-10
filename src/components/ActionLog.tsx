import { useEffect, useRef } from "react";

interface Props {
  lines: string[];
  onClear: () => void;
}

export function ActionLog({ lines, onClear }: Props) {
  const preRef = useRef<HTMLPreElement>(null);

  useEffect(() => {
    const el = preRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [lines]);

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
      <pre ref={preRef}>
        {lines.length === 0
          ? "Install, update, or remove a package — live brew output shows here."
          : lines.slice(-40).join("\n")}
      </pre>
    </div>
  );
}
