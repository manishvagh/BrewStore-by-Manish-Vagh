interface Props {
  label?: string;
  /** 0–100 from brew/curl output. Omit for an indeterminate pour. */
  value?: number | null;
  size?: "sm" | "md" | "lg";
  layout?: "bar" | "pint";
}

export function BeerMeter({
  label,
  value,
  size = "md",
  layout = "bar",
}: Props) {
  const determinate = typeof value === "number" && Number.isFinite(value);
  const pct = determinate ? Math.min(100, Math.max(0, Math.round(value))) : undefined;
  const caption = label
    ? determinate
      ? `${label.replace(/[.…]+$/, "")} ${pct}%`
      : label
    : determinate
      ? `${pct}%`
      : undefined;

  return (
    <div
      className={`beer-meter beer-meter-${layout} beer-meter-${size}${
        determinate ? " is-determinate" : " is-indeterminate"
      }`}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={pct}
      aria-label={caption || "Working"}
    >
      {layout === "pint" ? (
        <div className="beer-meter-glass" aria-hidden="true">
          <div
            className="beer-meter-liquid"
            style={
              determinate ? { transform: `translateY(${100 - (pct ?? 0)}%)` } : undefined
            }
          >
            <span className="beer-meter-foam" />
            <span className="beer-meter-bubble b1" />
            <span className="beer-meter-bubble b2" />
            <span className="beer-meter-bubble b3" />
          </div>
        </div>
      ) : (
        <div className="beer-meter-track" aria-hidden="true">
          <div
            className="beer-meter-liquid"
            style={
              determinate ? { transform: `scaleX(${(pct ?? 0) / 100})` } : undefined
            }
          >
            <span className="beer-meter-foam" />
          </div>
        </div>
      )}
      {caption ? <span className="beer-meter-label">{caption}</span> : null}
    </div>
  );
}
